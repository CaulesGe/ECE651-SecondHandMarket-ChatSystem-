import { useCallback, useEffect, useRef, useState } from 'react';
import { getMediaKey } from '../../helpers/ChatHelpers';

// Manage signed media URLs plus viewport-based video loading for the active conversation.
export default function useChatMediaPipeline({
  conversationId,
  currentMessages,
  isLoggedIn,
  signMediaDownload,
  userId
}) {
  const failedMediaKeysRef = useRef(new Set());
  const videoVisibilityObserverRef = useRef(null);
  const videoContainerByMessageIdRef = useRef(new Map());
  const videoNodeByMessageIdRef = useRef(new Map());
  const [signedMediaUrls, setSignedMediaUrls] = useState({});
  const [visibleVideoMessageIds, setVisibleVideoMessageIds] = useState({});

  // Attach and detach observed video wrapper nodes as message rows mount and unmount.
  const bindVideoContainerRef = useCallback((messageId) => (element) => {
    if (element) {
      videoContainerByMessageIdRef.current.set(messageId, element);
      if (videoVisibilityObserverRef.current) {
        videoVisibilityObserverRef.current.observe(element);
      }
      return;
    }

    const previousElement = videoContainerByMessageIdRef.current.get(messageId);
    if (previousElement && videoVisibilityObserverRef.current) {
      videoVisibilityObserverRef.current.unobserve(previousElement);
    }
    videoContainerByMessageIdRef.current.delete(messageId);
  }, []);

  // Keep direct references to video nodes so off-screen media can be paused.
  const bindVideoNodeRef = useCallback((messageId) => (element) => {
    if (element) {
      videoNodeByMessageIdRef.current.set(messageId, element);
      return;
    }
    videoNodeByMessageIdRef.current.delete(messageId);
  }, []);

  // Clean up the media pipeline when the conversation changes.
  useEffect(() => {
    setVisibleVideoMessageIds({});
    if (videoVisibilityObserverRef.current) {
      videoVisibilityObserverRef.current.disconnect();
      videoVisibilityObserverRef.current = null;
    }
    videoContainerByMessageIdRef.current.clear();
    videoNodeByMessageIdRef.current.clear();
  }, [conversationId]);

  // Pause off-screen videos when they are no longer visible.
  useEffect(() => {
    currentMessages.forEach((message) => {
      if (message.type !== 'video') return;
      const element = videoNodeByMessageIdRef.current.get(message.id);
      if (!element) return;
      const mediaKey = getMediaKey(message);
      const isVisible = Boolean(visibleVideoMessageIds[message.id]);
      const shouldHaveSource = Boolean(isVisible && mediaKey && signedMediaUrls[mediaKey]);

      if (!shouldHaveSource) {
        try {
          element.pause();
        } catch {
          // No-op; some browsers may throw if media isn't initialized.
        }
      }
    });
  }, [currentMessages, signedMediaUrls, visibleVideoMessageIds]);

  // Sign media download URLs for all pending media keys.
  useEffect(() => {
    if (!isLoggedIn || !userId || currentMessages.length === 0) return;

    const imageKeys = currentMessages
      .filter((message) => message.type === 'image' && !message.isWithdrawn)
      .map((message) => getMediaKey(message))
      .filter(Boolean);
    const visibleVideoKeys = currentMessages
      .filter((message) => message.type === 'video' && !message.isWithdrawn && visibleVideoMessageIds[message.id])
      .map((message) => getMediaKey(message))
      .filter(Boolean);

    const mediaObjectKeys = [...new Set([...imageKeys, ...visibleVideoKeys])];
    // Filter out keys that are already signed or have failed.
    const pendingKeys = mediaObjectKeys.filter(
      (key) => !signedMediaUrls[key] && !failedMediaKeysRef.current.has(key)
    );
    if (pendingKeys.length === 0) return;

    let cancelled = false;
    // Sign media download URLs for all pending media keys.
    Promise.all(
      pendingKeys.map(async (key) => {
        try {
          const data = await signMediaDownload(key);
          return [key, data.downloadUrl];
        } catch {
          failedMediaKeysRef.current.add(key);
          return [key, null];
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setSignedMediaUrls((prev) => {
        const next = { ...prev };
        entries.forEach(([key, url]) => {
          if (url) next[key] = url;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [currentMessages, isLoggedIn, signMediaDownload, signedMediaUrls, userId, visibleVideoMessageIds]);

  useEffect(() => {
    if (!conversationId || typeof window === 'undefined') return undefined;

    // The browser reports visibility changes for observed video containers here.
    // We translate each DOM entry back to a message id and keep a small lookup
    // of which video messages are currently visible, which then drives lazy loading.
    const handleVisibility = (entries) => {
      setVisibleVideoMessageIds((prev) => {
        let changed = false;
        const nextVisibleVideoMessageIds = { ...prev };
        entries.forEach((entry) => {
          const messageId = entry.target.getAttribute('data-message-id');
          if (!messageId) return;
          const isVisible = entry.isIntersecting;
          if (nextVisibleVideoMessageIds[messageId] !== isVisible) {
            nextVisibleVideoMessageIds[messageId] = isVisible;
            changed = true;
          }
        });
        return changed ? nextVisibleVideoMessageIds : prev;
      });
    };

    const observer = new IntersectionObserver(handleVisibility, {
      root: null,
      threshold: 0.2
    });
    videoVisibilityObserverRef.current = observer;
    videoContainerByMessageIdRef.current.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      if (videoVisibilityObserverRef.current === observer) {
        videoVisibilityObserverRef.current = null;
      }
    };
  }, [conversationId, currentMessages]);

  return {
    bindVideoContainerRef,
    bindVideoNodeRef,
    signedMediaUrls,
    visibleVideoMessageIds
  };
}
