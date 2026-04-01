import { useCallback, useEffect, useState } from 'react';

// Manage initial thread loading, read markers, and infinite-scroll pagination.
export default function useChatThreadController({
  conversationId,
  currentMessages,
  loadMessages,
  markAsRead,
  messagesContainerRef,
  pageSize = 100
}) {
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreOlderByConversation, setHasMoreOlderByConversation] = useState({});
  const hasMoreOlderMessages = conversationId
    ? (hasMoreOlderByConversation[conversationId] ?? true)
    : false;
  const lastMessageId = currentMessages[currentMessages.length - 1]?.id;

  // Keep the active thread pinned to the latest message when a conversation opens.
  const scrollThreadToBottom = useCallback((behavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  }, [messagesContainerRef]);

  useEffect(() => {
    if (!conversationId) return;

    setLoadingOlderMessages(false);
    loadMessages(conversationId, { limit: pageSize }).then((items) => {
      setHasMoreOlderByConversation((prev) => ({
        ...prev,
        [conversationId]: items.length >= pageSize
      }));
      const latest = items[items.length - 1];
      markAsRead(conversationId, latest?.id || null).catch(() => {});
      requestAnimationFrame(() => scrollThreadToBottom('auto'));
    }).catch(() => {});
  }, [conversationId, loadMessages, markAsRead, pageSize, scrollThreadToBottom]);

  useEffect(() => {
    scrollThreadToBottom('auto');
    if (!conversationId || currentMessages.length === 0) return;
    const latest = currentMessages[currentMessages.length - 1];
    markAsRead(conversationId, latest?.id || null).catch(() => {});
  }, [conversationId, currentMessages, lastMessageId, markAsRead, scrollThreadToBottom]);

  // Load older messages when the user scrolls near the top and preserve scroll position.
  const handleMessagesScroll = useCallback(async () => {
    const container = messagesContainerRef.current;
    if (!container || !conversationId || loadingOlderMessages || !hasMoreOlderMessages) return;
    if (container.scrollTop > 40) return;

    const oldestLoadedMessageId = currentMessages[0]?.id;
    if (!oldestLoadedMessageId) return;

    const previousScrollHeight = container.scrollHeight;
    const previousScrollTop = container.scrollTop;
    setLoadingOlderMessages(true);
    try {
      const olderItems = await loadMessages(conversationId, {
        beforeMessageId: oldestLoadedMessageId,
        limit: pageSize
      });
      setHasMoreOlderByConversation((prev) => ({
        ...prev,
        [conversationId]: olderItems.length >= pageSize
      }));
      requestAnimationFrame(() => {
        const nextScrollHeight = container.scrollHeight;
        container.scrollTop = previousScrollTop + (nextScrollHeight - previousScrollHeight);
      });
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [
    conversationId,
    currentMessages,
    hasMoreOlderMessages,
    loadMessages,
    loadingOlderMessages,
    messagesContainerRef,
    pageSize
  ]);

  return {
    handleMessagesScroll,
    loadingOlderMessages,
    hasMoreOlderMessages
  };
}
