import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);
const CHAT_MEDIA_MAX_SIZE_BYTES = 100 * 1024 * 1024;
const SOCKET_SEND_ACK_TIMEOUT_MS = 4000;
const isDev = import.meta.env.DEV;

export function ChatProvider({ children }) {
  const { user, isLoggedIn } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [presenceByUserId, setPresenceByUserId] = useState({});
  const [typingByConversation, setTypingByConversation] = useState({});
  const socketRef = useRef(null);
  const sendPathDebugRef = useRef({
    total: 0,
    socket: 0,
    fallbackHttp: 0,
    lastFallbackReason: null
  });
  const messagesByConversationRef = useRef({});
  const typingExpiryTimersRef = useRef(new Map()); // used to clear the typing state for the conversation and user
  const socketServerUrl = import.meta.env.DEV ? 'http://localhost:3000' : undefined;

  const incrementSendDebugCounter = useCallback((path, reason = null) => {
    const next = { ...sendPathDebugRef.current };
    next.total += 1;
    if (path === 'socket') next.socket += 1;
    if (path === 'fallbackHttp') {
      next.fallbackHttp += 1;
      next.lastFallbackReason = reason || 'unknown';
    }
    sendPathDebugRef.current = next;
    if (isDev && typeof window !== 'undefined') {
      window.__chatSendDebug = next;
      // Keeps local debugging cheap and visible in browser console.
      console.debug('[chat-debug] send-path', next);
    }
  }, []);

  const acknowledgeMessageDelivery = useCallback(async ({ conversationId, messageId }) => {
    if (!conversationId || !messageId) return;
    const socket = socketRef.current;
    if (!socket?.connected) return;

    await new Promise((resolve) => {
      socket.emit('message_delivery_ack', { conversationId, messageId }, () => resolve());
    });
  }, []);

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
    return Array.from(map.values()).sort((a, b) => {
      const aSequenceNumber = Number.isInteger(a?.sequenceNumber) ? a.sequenceNumber : null;
      const bSequenceNumber = Number.isInteger(b?.sequenceNumber) ? b.sequenceNumber : null;

      if (aSequenceNumber !== null && bSequenceNumber !== null && aSequenceNumber !== bSequenceNumber) {
        return aSequenceNumber - bSequenceNumber;
      }

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, []);

  useEffect(() => {
    messagesByConversationRef.current = messagesByConversation;
  }, [messagesByConversation]);

  const updateConversationWithMessage = useCallback((message, { incrementUnread = false } = {}) => {
    if (!message?.conversationId) return;

    const getActivityTime = (conversation) => {
      const activitySource = conversation?.lastMessage?.createdAt || conversation?.updatedAt;
      const activityTime = new Date(activitySource || 0).getTime();
      return Number.isFinite(activityTime) ? activityTime : 0;
    };

    const getMessageOrderValue = (value) => {
      if (Number.isInteger(value?.sequenceNumber)) {
        return { type: 'sequence', value: value.sequenceNumber };
      }

      const timestamp = new Date(value?.createdAt || 0).getTime();
      return {
        type: 'time',
        value: Number.isFinite(timestamp) ? timestamp : 0
      };
    };

    setConversations((prev) => {
      const conversationIndex = prev.findIndex((item) => item.id === message.conversationId);
      if (conversationIndex === -1) return prev;

      const existingConversation = prev[conversationIndex];
      const existingLastMessage = existingConversation.lastMessage || null;
      const incomingOrder = getMessageOrderValue(message);
      const existingOrder = getMessageOrderValue(existingLastMessage);
      const shouldReplaceLastMessage = (
        !existingLastMessage
        || existingLastMessage.id === message.id
        || (
          incomingOrder.type === existingOrder.type
            ? incomingOrder.value >= existingOrder.value
            : incomingOrder.type === 'sequence'
        )
      );

      const updatedConversation = {
        ...existingConversation,
        lastMessage: shouldReplaceLastMessage ? message : existingLastMessage,
        updatedAt: shouldReplaceLastMessage
          ? (message.createdAt || existingConversation.updatedAt)
          : existingConversation.updatedAt,
        unreadCount: incrementUnread
          ? Number(existingConversation.unreadCount || 0) + 1
          : Number(existingConversation.unreadCount || 0)
      };

      return prev
        .map((item, index) => (index === conversationIndex ? updatedConversation : item))
        .sort((a, b) => getActivityTime(b) - getActivityTime(a));
    });
  }, []);

  const getLatestLoadedMessageSequenceNumber = useCallback((conversationId) => {
    const conversationMessages = messagesByConversation[conversationId] || [];
    // get the latest message sequence number
    for (let index = conversationMessages.length - 1; index >= 0; index -= 1) {
      const sequenceNumber = conversationMessages[index]?.sequenceNumber;
      if (Number.isInteger(sequenceNumber)) {
        return sequenceNumber;
      }
    }

    return null;
  }, [messagesByConversation]);


  // Load messages for one conversation using sequence-number cursors.
  const loadMessages = useCallback(async (conversationId, options = {}) => {
    if (!isLoggedIn || !user?.id || !conversationId) return [];
    const {
      lastReceivedMessageSequenceNumber = '',
      oldestLoadedMessageSequenceNumber = '',
      limit = 100
    } = typeof options === 'number' || typeof options === 'string'
      ? { lastReceivedMessageSequenceNumber: options }
      : (options || {});
    const data = await api.getMessages({
      conversationId,
      lastReceivedMessageSequenceNumber,
      oldestLoadedMessageSequenceNumber,
      user,
      limit
    });
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
    const payload = { conversationId, type, content, mediaObjectKey, clientMessageId, recipientId };
    let persistedMessage = null;
    let deliveredViaSocket = false;
    if (socket?.connected) {
      try {
        const ack = await new Promise((resolve, reject) => {
          let settled = false;
          const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error('Socket acknowledgement timeout'));
          }, SOCKET_SEND_ACK_TIMEOUT_MS);
          
          socket.emit('send_message', payload, (ack) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            if (ack?.error) reject(new Error(ack.error));
            else resolve(ack);
          });
        });
        persistedMessage = ack?.message || null;
        deliveredViaSocket = true;
        incrementSendDebugCounter('socket');
      } catch (_error) {
        // Fall back to HTTP if socket delivery is unhealthy.
        deliveredViaSocket = false;
        incrementSendDebugCounter('fallbackHttp', _error?.message || 'socket emit failed');
      }
    }
    // if the message was not delivered via socket, fallback to HTTP
    if (!deliveredViaSocket) {
      if (!socket?.connected) {
        incrementSendDebugCounter('fallbackHttp', 'socket not connected');
      }
      const data = await api.sendMessage(conversationId, type, content, mediaObjectKey, clientMessageId, user);
      persistedMessage = data?.message || null;
    }

    if (persistedMessage?.conversationId) {
      setMessagesByConversation((prev) => ({
        ...prev,
        [persistedMessage.conversationId]: mergeMessages(prev[persistedMessage.conversationId], [persistedMessage])
      }));
      updateConversationWithMessage(persistedMessage);
    }

    return persistedMessage;
  }, [
    isLoggedIn,
    user,
    generateClientMessageId,
    mergeMessages,
    updateConversationWithMessage
  ]);

  // Withdraw own message (<= 2 minutes) via WebSocket when connected, otherwise HTTP.
  const withdrawMessageRealtime = useCallback(async ({ messageId, conversationId }) => {
    if (!isLoggedIn || !user?.id) throw new Error('Not authenticated');
    if (!messageId || !conversationId) throw new Error('messageId and conversationId are required');

    const socket = socketRef.current;
    let updatedMessage = null;
    if (socket?.connected) {
      const ack = await new Promise((resolve, reject) => {
        socket.emit('withdraw_message', { messageId }, (ack) => {
          if (ack?.error) {
            reject(new Error(ack.error));
            return;
          }
          resolve(ack);
        });
      });
      updatedMessage = ack?.message || null;
    } else {
      const data = await api.withdrawMessage(messageId, user);
      updatedMessage = data.message || null;
    }

    if (updatedMessage?.conversationId) {
      setMessagesByConversation((prev) => ({
        ...prev,
        [updatedMessage.conversationId]: mergeMessages(prev[updatedMessage.conversationId], [updatedMessage])
      }));
      updateConversationWithMessage(updatedMessage);
    }
    return updatedMessage;
  }, [isLoggedIn, user, mergeMessages, updateConversationWithMessage]);

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

  // request the presence and typing state for the conversation, used in ChatPage.jsx
  const requestConversationPresence = useCallback(async (conversationId) => {
    if (!conversationId) return null;
    const socket = socketRef.current;
    if (!socket?.connected) return null;

    // ACK can be swallowed when the Redis adapter is active, so add a timeout.
    const PRESENCE_ACK_TIMEOUT_MS = 3000;
    const snapshot = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), PRESENCE_ACK_TIMEOUT_MS);
      socket.emit('presence_subscribe', { conversationId }, (ack) => {
        clearTimeout(timer);
        resolve(ack || null);
      });
    });
    if (!snapshot || snapshot.error) return null;

    // update the presence for the users in the conversation
    if (snapshot.presenceByUserId) {
      setPresenceByUserId((prev) => ({ ...prev, ...snapshot.presenceByUserId }));
    }
    if (Array.isArray(snapshot.typingUserIds)) {
      // set the typing state for the conversation
      setTypingByConversation((prev) => ({
        ...prev,
        [conversationId]: Object.fromEntries(snapshot.typingUserIds.map((id) => [id, true]))
      }));
    }
    return snapshot;
  }, []);

  // set the typing state for the user in the conversation
  const setTypingState = useCallback(async (conversationId, isTyping) => {
    if (!conversationId) return;
    const socket = socketRef.current;
    if (!socket?.connected) return;
    await new Promise((resolve) => {
      socket.emit('typing', { conversationId, isTyping }, () => resolve());
    });
  }, []);

  // get the presence for the user, update when presence_changed event is received
  const getPresenceForUser = useCallback((userId) => Boolean(presenceByUserId[userId]), [presenceByUserId]);

  // get the typing users for the conversation, update when typing_changed event is received
  const getTypingUsersForConversation = useCallback((conversationId) => (
    Object.entries(typingByConversation[conversationId] || {})
      .filter(([, isTyping]) => Boolean(isTyping))
      .map(([userId]) => userId)
  ), [typingByConversation]);

  // Establish Socket.IO connection and reconnect sync.
  useEffect(() => {
    if (!isLoggedIn || !user?.id) {
      setConversations([]);
      setMessagesByConversation({});
      setPresenceByUserId({});
      setTypingByConversation({});
      typingExpiryTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      typingExpiryTimersRef.current.clear();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocketConnected(false);
      return;
    }

    // Initial conversation hydration.
    loadConversations().catch(() => {});
    // create socket when user is logged in and connected to the server
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

    socket.on('message', ({ message, delivery }) => {
      if (!message?.conversationId) return;
      const messageAlreadyLoaded = Boolean(
        messagesByConversationRef.current[message.conversationId]?.some((item) => item.id === message.id)
      );
      setMessagesByConversation((prev) => ({
        ...prev,
        [message.conversationId]: mergeMessages(prev[message.conversationId], [message])
      }));
      updateConversationWithMessage(message, {
        incrementUnread: (
          !messageAlreadyLoaded
          && message.senderId
          && message.senderId !== user?.id
          && !message.isWithdrawn
        )
      });
      if (
        delivery?.conversationId
        && delivery?.messageId
        && message.senderId
        && message.senderId !== user?.id
        && !message.isWithdrawn
      ) {
        acknowledgeMessageDelivery({
          conversationId: delivery.conversationId,
          messageId: delivery.messageId
        }).catch(() => {});
      }
    });

    socket.on('presence_changed', ({ userId: changedUserId, isOnline }) => {
      if (!changedUserId) return;
      setPresenceByUserId((prev) => ({ ...prev, [changedUserId]: Boolean(isOnline) }));
    });

    socket.on('typing_changed', ({ conversationId, userId: typingUserId, isTyping, expiresInSeconds }) => {
      if (!conversationId || !typingUserId) return;
      if (isTyping) {
        // A user who is actively typing is online even if a presence event was missed.
        setPresenceByUserId((prev) => ({ ...prev, [typingUserId]: true }));
      }
      const timerKey = `${conversationId}:${typingUserId}`;
      const existingTimer = typingExpiryTimersRef.current.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        typingExpiryTimersRef.current.delete(timerKey);
      }

      // update the typing state for the conversation
      setTypingByConversation((prev) => ({
        ...prev,
        [conversationId]: {
          ...(prev[conversationId] || {}),
          [typingUserId]: Boolean(isTyping)
        }
      }));

      if (isTyping) {
        // set the timeout to clear the typing state for the conversation and user
        const ttlMs = Math.max(Number(expiresInSeconds || 0) * 1000, 1000);
        const timeoutId = setTimeout(() => {
          setTypingByConversation((prev) => ({
            ...prev,
            [conversationId]: {
              ...(prev[conversationId] || {}),
              [typingUserId]: false
            }
          }));
          typingExpiryTimersRef.current.delete(timerKey);
        }, ttlMs + 200);
        typingExpiryTimersRef.current.set(timerKey, timeoutId);
      }
    });

    socket.io.on('reconnect', async () => {
      // Sync missed messages on reconnect for all known conversations.
      const currentConversations = await loadConversations().catch(() => []);
      for (const convo of currentConversations) {
        const lastReceivedMessageSequenceNumber = getLatestLoadedMessageSequenceNumber(convo.id);
        await loadMessages(
          convo.id,
          Number.isInteger(lastReceivedMessageSequenceNumber)
            ? { lastReceivedMessageSequenceNumber }
            : undefined
        ).catch(() => {});
      }
    });

    return () => {
      typingExpiryTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      typingExpiryTimersRef.current.clear();
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [
    acknowledgeMessageDelivery,
    getLatestLoadedMessageSequenceNumber,
    isLoggedIn,
    user?.id,
    user?.role,
    user?.name,
    user?.email,
    loadConversations,
    loadMessages,
    mergeMessages,
    updateConversationWithMessage,
    socketServerUrl
  ]);

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
      withdrawMessageRealtime,
      uploadMediaForConversation,
      signMediaDownload,
      markAsRead,
      getMessagesForConversation,
      getSendPathDebug: () => sendPathDebugRef.current,
      requestConversationPresence,
      setTypingState,
      getPresenceForUser,
      getTypingUsersForConversation
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