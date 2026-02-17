import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);
const CHAT_MEDIA_MAX_SIZE_BYTES = 100 * 1024 * 1024;

export function ChatProvider({ children }) {
  const { user, isLoggedIn } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);
  const socketServerUrl = import.meta.env.DEV ? 'http://localhost:3000' : undefined;

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
    mediaObjectKey = null,
    recipientId = null
  }) => {
    if (!isLoggedIn || !user?.id) throw new Error('Not authenticated');
    const clientMessageId = generateClientMessageId();

    const socket = socketRef.current;
    if (socket?.connected) {
      await new Promise((resolve, reject) => {
        socket.emit(
          'send_message',
          { conversationId, type, content, mediaObjectKey, clientMessageId, recipientId },
          (ack) => {
            if (ack?.error) reject(new Error(ack.error));
            else resolve(ack);
          }
        );
      });
    } else {
      await api.sendMessage(conversationId, type, content, mediaObjectKey, clientMessageId, user);
    }

    // Sync latest data after send for consistent local state.
    await loadMessages(conversationId);
    await loadConversations();
  }, [isLoggedIn, user, generateClientMessageId, loadMessages, loadConversations]);

  // Upload media file to S3 via presigned URL and return objectKey for message payload.
  const uploadMediaForConversation = useCallback(async (conversationId, file) => {
    if (!isLoggedIn || !user?.id) throw new Error('Not authenticated');
    if (!conversationId) throw new Error('conversationId is required');
    if (!file) throw new Error('No file selected');
    if (file.size > CHAT_MEDIA_MAX_SIZE_BYTES) {
      throw new Error('File size exceeds 100MB limit');
    }

    const fileName = String(file.name || '').trim();
    const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : undefined;

    // get the presigned URL to upload the media file to S3
    const presigned = await api.presignChatUpload(
      conversationId,
      file.type || 'application/octet-stream',
      file.size,
      extension,
      user
    );

    const uploadRes = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    if (!uploadRes.ok) {
      throw new Error('Failed to upload media to storage');
    }

    return {
      objectKey: presigned.objectKey,
      expiresIn: presigned.expiresIn
    };
  }, [isLoggedIn, user]);

  // Resolve a short-lived media download URL from an object key.
  const signMediaDownload = useCallback(async (objectKey) => {
    if (!isLoggedIn || !user?.id) throw new Error('Not authenticated');
    if (!objectKey) throw new Error('Media key is required');
    return api.signChatDownload(objectKey, user);
  }, [isLoggedIn, user]);

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

    const socket = io(socketServerUrl, {
      path: '/socket.io',
      auth: {
        token: user?.token,
        userId: user?.id,
        role: user?.role,
        name: user?.name,
        email: user?.email
      },
      // Use websocket-only transport in dev to avoid proxy noise from polling aborts on refresh.
      transports: ['websocket'],
      reconnectionAttempts: 5,
      timeout: 10000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('connect_error', () => {
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
  }, [isLoggedIn, user?.id, user?.role, user?.name, user?.email, loadConversations, loadMessages, mergeMessages, socketServerUrl]);

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
      uploadMediaForConversation,
      signMediaDownload,
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