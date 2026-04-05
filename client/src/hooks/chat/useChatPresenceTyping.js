import { useCallback, useEffect, useRef } from 'react';

const TYPING_REFRESH_INTERVAL_MS = 2500;
const PRESENCE_REFRESH_INTERVAL_MS = 15000;

// Manage presence refreshes and the local user's typing lifecycle for the active chat.
export default function useChatPresenceTyping({
  canSendMessage,
  draft,
  requestConversationPresence,
  selectedChat,
  setTypingState,
  socketConnected
}) {
  const typingIdleTimeoutRef = useRef(null);
  const activeTypingConversationIdRef = useRef(null);
  const typingRefreshIntervalRef = useRef(null);

  // Stop the periodic typing refresh timer when it is no longer needed.
  const clearTypingRefreshInterval = useCallback(() => {
    if (typingRefreshIntervalRef.current) {
      clearInterval(typingRefreshIntervalRef.current);
      typingRefreshIntervalRef.current = null;
    }
  }, []);

  // Keep the typing indicator alive while the user continues drafting.
  const startTypingRefreshInterval = useCallback((conversationId) => {
    clearTypingRefreshInterval();
    if (!conversationId) return;
    typingRefreshIntervalRef.current = setInterval(() => {
      if (activeTypingConversationIdRef.current !== conversationId) return;
      setTypingState(conversationId, true).catch(() => {});
    }, TYPING_REFRESH_INTERVAL_MS);
  }, [clearTypingRefreshInterval, setTypingState]);

  // Clear the current typing state immediately, such as after sending a message.
  const stopTyping = useCallback(() => {
    if (activeTypingConversationIdRef.current) {
      setTypingState(activeTypingConversationIdRef.current, false).catch(() => {});
      activeTypingConversationIdRef.current = null;
    }
    clearTypingRefreshInterval();
    if (typingIdleTimeoutRef.current) {
      clearTimeout(typingIdleTimeoutRef.current);
      typingIdleTimeoutRef.current = null;
    }
  }, [clearTypingRefreshInterval, setTypingState]);

  useEffect(() => {
    if (!selectedChat || !socketConnected) return;
    // request the presence for the selected chat
    requestConversationPresence(selectedChat).catch(() => {});
  }, [selectedChat, socketConnected, requestConversationPresence]);

  useEffect(() => {
    if (!selectedChat || !socketConnected) return undefined;

    const handleFocus = () => {
      requestConversationPresence(selectedChat).catch(() => {});
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [selectedChat, socketConnected, requestConversationPresence]);

  useEffect(() => {
    if (!selectedChat || !socketConnected) return undefined;

    const intervalId = setInterval(() => {
      requestConversationPresence(selectedChat).catch(() => {});
    }, PRESENCE_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [selectedChat, socketConnected, requestConversationPresence]);

  useEffect(() => {
    if (!canSendMessage || !selectedChat) return undefined;

    const hasText = Boolean(draft.trim());
    if (hasText) {
      if (activeTypingConversationIdRef.current !== selectedChat) {
        if (activeTypingConversationIdRef.current) {
          setTypingState(activeTypingConversationIdRef.current, false).catch(() => {});
        }
        activeTypingConversationIdRef.current = selectedChat;
        setTypingState(selectedChat, true).catch(() => {});
        startTypingRefreshInterval(selectedChat);
      } else if (!typingRefreshIntervalRef.current) {
        startTypingRefreshInterval(selectedChat);
      }

      if (typingIdleTimeoutRef.current) clearTimeout(typingIdleTimeoutRef.current);
      typingIdleTimeoutRef.current = setTimeout(() => {
        if (!activeTypingConversationIdRef.current) return;
        setTypingState(activeTypingConversationIdRef.current, false).catch(() => {});
        activeTypingConversationIdRef.current = null;
        clearTypingRefreshInterval();
      }, 1600);
      return undefined;
    }

    stopTyping();
    return undefined;
  }, [
    canSendMessage,
    clearTypingRefreshInterval,
    draft,
    selectedChat,
    setTypingState,
    startTypingRefreshInterval,
    stopTyping
  ]);

  useEffect(() => () => {
    stopTyping();
  }, [stopTyping]);

  return { stopTyping };
}
