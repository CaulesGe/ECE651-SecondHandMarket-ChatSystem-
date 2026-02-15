import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, isLoggedIn } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);

   // Load all conversations for the authenticated user.
  const loadConversations = useCallback(async () => {
    if (!isLoggedIn || !user?.id) return [];
    setLoadingConversations(true);
    try {
      const data = await api.getConversations(user);
      const items = data.items || [];
      setConversations(items);
      return items;
    } finally {
      setLoadingConversations(false);
    }
  }, [isLoggedIn, user]);

    // Create a conversation and refresh conversation list.
  const createConversation = useCallback(async (otherUserId, context = {}) => {
    if (!isLoggedIn || !user?.id) throw new Error('Not authenticated');
    const data = await api.createConversation(otherUserId, context, user);
    await loadConversations();
    return data.conversation;
  }, [isLoggedIn, user, loadConversations]);

  // Safe UUID generation for client message id (idempotency).
  const generateClientMessageId = useCallback(() => {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
    return `cm_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }, []);


  // Merge new messages by id to avoid duplicates from reconnect/sync.
  const mergeMessages = useCallback((existing = [], incoming = []) => {
    const map = new Map(existing.map((m) => [m.id, m]));
    incoming.forEach((m) => map.set(m.id, m));
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, []);


  // Load messages for one conversation (optionally after cursor).
  const loadMessages = useCallback(async (conversationId, cursorMessageId = '') => {
    if (!isLoggedIn || !user?.id || !conversationId) return [];
    const data = await api.getMessages(conversationId, cursorMessageId, user);
    const items = data.items || [];
    // update the conversation with the new messages
    setMessagesByConversation((prev) => ({
      ...prev,
      [conversationId]: mergeMessages(prev[conversationId], items)
    }));
    return items;
  }, [isLoggedIn, user, mergeMessages]);


  // Send message via WebSocket when connected, otherwise fallback to HTTP.
  const sendMessageRealtime = useCallback(async ({
    conversationId,
    type = 'text',
    content = '',
    mediaUrl = null,
    recipientId = null
  }) => {
    if (!isLoggedIn || !user?.id) throw new Error('Not authenticated');
    const clientMessageId = generateClientMessageId();

    const socket = socketRef.current;
    if (socket?.connected) {
      await new Promise((resolve, reject) => {
        socket.emit(
          'send_message',
          { conversationId, type, content, mediaUrl, clientMessageId, recipientId },
          (ack) => {
            if (ack?.error) reject(new Error(ack.error));
            else resolve(ack);
          }
        );
      });
    } else {
      await api.sendMessage(conversationId, type, content, mediaUrl, clientMessageId, user);
    }

    // Sync latest data after send for consistent local state.
    await loadMessages(conversationId);
    await loadConversations();
  }, [isLoggedIn, user, generateClientMessageId, loadMessages, loadConversations]);

  // Mark conversation read at latest message id and refresh unread counts.
  const markAsRead = useCallback(async (conversationId, lastReadMessageId = null) => {
    if (!isLoggedIn || !user?.id || !conversationId) return;
    await api.markAsRead(conversationId, lastReadMessageId, user);
    await loadConversations();
  }, [isLoggedIn, user, loadConversations]);

  // Read from cache (UI helper).
  const getMessagesForConversation = useCallback((conversationId) => (
    messagesByConversation[conversationId] || []
  ), [messagesByConversation]);

  // Establish Socket.IO connection and reconnect sync.
  useEffect(() => {
    if (!isLoggedIn || !user?.id) {
      setConversations([]);
      setMessagesByConversation({});
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocketConnected(false);
      return;
    }

    // Initial conversation hydration.
    loadConversations().catch(() => {});

    const socket = io('/', {
      path: '/socket.io',
      auth: {
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email
      },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('message', ({ message }) => {
      if (!message?.conversationId) return;
      setMessagesByConversation((prev) => ({
        ...prev,
        [message.conversationId]: mergeMessages(prev[message.conversationId], [message])
      }));
      // Refresh list so last message and unread counts stay current.
      loadConversations().catch(() => {});
    });

    socket.io.on('reconnect', async () => {
      // Sync missed messages on reconnect for all known conversations.
      const currentConversations = await loadConversations().catch(() => []);
      for (const convo of currentConversations) {
        await loadMessages(convo.id).catch(() => {});
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [isLoggedIn, user?.id, user?.role, user?.name, user?.email, loadConversations, loadMessages, mergeMessages]);

  const chatCount = useMemo(
    () => conversations.reduce((sum, convo) => sum + Number(convo.unreadCount || 0), 0),
    [conversations]
  );

  return (
    <ChatContext.Provider value={{
      chatCount,
      conversations,
      loadingConversations,
      socketConnected,
      loadConversations,
      loadMessages,
      createConversation,
      sendMessageRealtime,
      markAsRead,
      getMessagesForConversation
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}