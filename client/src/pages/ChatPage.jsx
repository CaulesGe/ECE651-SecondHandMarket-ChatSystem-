import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useNavigate } from 'react-router-dom';
import { canWithdrawMessage } from '../helpers/ChatHelpers';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ChatComposer from '../components/chat/ChatComposer';
import ChatConversationList from '../components/chat/ChatConversationList';
import ChatMessageList from '../components/chat/ChatMessageList';
import ChatThreadHeader from '../components/chat/ChatThreadHeader';
import ChatWithdrawMenu from '../components/chat/ChatWithdrawMenu';
import useChatMediaPipeline from '../hooks/chat/useChatMediaPipeline';
import useChatPresenceTyping from '../hooks/chat/useChatPresenceTyping';
import useChatThreadController from '../hooks/chat/useChatThreadController';

export default function ChatPage() {
  const { user, isLoggedIn } = useAuth();
  const {
    conversations,
    loadingConversations,
    socketConnected,
    loadConversations,
    loadMessages,
    sendMessageRealtime,
    withdrawMessageRealtime,
    uploadMediaForConversation,
    signMediaDownload,
    markAsRead,
    getMessagesForConversation,
    requestConversationPresence,
    setTypingState,
    getPresenceForUser,
    getTypingUsersForConversation
  } = useChat();
  const navigate = useNavigate();
  const [selectedChat, setSelectedChat] = useState('');
  const [draft, setDraft] = useState('');
  const [composerError, setComposerError] = useState('');
  const [dragOverComposer, setDragOverComposer] = useState(false);
  const [withdrawContextMenu, setWithdrawContextMenu] = useState(null);
  
  // refs for the file input and queued media uploads.
  const fileInputRef = useRef(null);
  const mediaUploadInFlightRef = useRef(false);
  const queuedMediaUploadRef = useRef([]);
  // state for pending files
  const [pendingFiles, setPendingFiles] = useState([]);
  const pendingFilesRef = useRef([]);
  // ref for the chat messages container
  const chatMessagesContainerRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  // Initial conversation hydration.
  useEffect(() => {
    if (!isLoggedIn) return;
    loadConversations().catch(() => {});
  }, [isLoggedIn, loadConversations]);

  // Ensure a valid selected conversation when list changes.
  useEffect(() => {
    if (!selectedChat && conversations.length > 0) {
      setSelectedChat(conversations[0].id);
    } else if (
      selectedChat &&
      conversations.length > 0 &&
      // selectedChat is not in the conversations list, eg. deleted
      !conversations.some((c) => c.id === selectedChat)
    ) {
      setSelectedChat(conversations[0].id);
    }
  }, [conversations, selectedChat]);

  const currentConversation = conversations.find((t) => t.id === selectedChat) || null;
  const currentMessages = currentConversation ? getMessagesForConversation(currentConversation.id) : [];
  const canSendMessage = Boolean(currentConversation);
  const lastMessageId = currentMessages[currentMessages.length - 1]?.id;
  const currentOtherParticipantEntry = currentConversation?.participants?.find((participant) => participant.userId !== user?.id);
  const currentOtherParticipant = currentOtherParticipantEntry?.user || null;
  const isOtherParticipantOnline = currentOtherParticipant ? getPresenceForUser(currentOtherParticipantEntry.userId) : false;
  // get the typing users for the conversation, update when typing_changed event is received
  const typingUserNames = currentConversation
    ? getTypingUsersForConversation(currentConversation.id)
      .filter((typingUserId) => typingUserId !== user?.id)
      .map((typingUserId) => currentConversation.participants?.find((participant) => participant.userId === typingUserId)?.user?.name || typingUserId)
    : [];
  const { stopTyping } = useChatPresenceTyping({
    canSendMessage,
    draft,
    requestConversationPresence,
    selectedChat,
    setTypingState,
    socketConnected
  });
  const {
    bindVideoContainerRef,
    bindVideoNodeRef,
    signedMediaUrls,
    visibleVideoMessageIds
  } = useChatMediaPipeline({
    conversationId: currentConversation?.id,
    currentMessages,
    isLoggedIn,
    signMediaDownload,
    userId: user?.id
  });
  const {
    handleMessagesScroll,
    hasMoreOlderMessages,
    loadingOlderMessages
  } = useChatThreadController({
    conversationId: currentConversation?.id,
    currentMessages,
    loadMessages,
    markAsRead,
    messagesContainerRef: chatMessagesContainerRef
  });

  // scroll to the bottom of the chat messages container
  const scrollToBottom = (behavior = 'smooth') => {
    const container = chatMessagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  const handleMediaRendered = (messageId) => {
    // Only auto-scroll for the newest message to avoid jump when users interact with older media.
    if (!messageId || messageId !== lastMessageId) return;
    requestAnimationFrame(() => scrollToBottom('smooth'));
  };

  const getSenderName = (message) => {
    const participantName = currentConversation?.participants?.find(
      (participant) => participant.userId === message?.senderId
    )?.user?.name;
    if (participantName) return participantName;
    if (message?.senderId === user?.id) return user?.name || 'You';
    return message?.senderName || message?.senderId || 'Unknown user';
  };


  // add pending files to the file queue
  const addPendingFilesToUploadQueue = (files = []) => {
    if (!files.length) return;
    const next = [];
    files.forEach((file) => {
      const mimeType = file?.type || '';
      const isImage = mimeType.startsWith('image/');
      const isVideo = mimeType.startsWith('video/');
      if (!isImage && !isVideo) return;
      next.push({
        id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `pf_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        file,
        kind: isImage ? 'image' : 'video',
        previewUrl: URL.createObjectURL(file)
      });
    });

    if (next.length === 0) {
      setComposerError('Only image and video files are supported.');
      return;
    }

    setComposerError('');
    setPendingFiles((prev) => [...prev, ...next]);
  };

  const processMediaUpload = async ({ file, conversationId, recipientId }) => {
    const mimeType = file.type || '';
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    if (!isImage && !isVideo) {
      throw new Error('Only image and video files are supported.');
    }

    mediaUploadInFlightRef.current = true;
    try {
      const { objectKey } = await uploadMediaForConversation(conversationId, file);
      await sendMessageRealtime({
        conversationId,
        type: isImage ? 'image' : 'video',
        content: '',
        mediaObjectKey: objectKey,
        recipientId
      });
      setTimeout(scrollToBottom, 0);
    } finally {
      mediaUploadInFlightRef.current = false;

      // Process next queued upload, if any (FIFO).
      const queuedUpload = queuedMediaUploadRef.current.shift();
      if (queuedUpload) {
        processMediaUpload(queuedUpload).catch((error) => {
          setComposerError(error?.message || 'Failed to send message.');
        });
      }
    }
  };

  // enqueue upload task  
  const enqueueUploadTask = (uploadTask) => {
    // if an upload is already in flight, keep all pending uploads and process them in order.
    if (mediaUploadInFlightRef.current) {
      // Keep all pending uploads and process them in order.
      queuedMediaUploadRef.current.push(uploadTask);
      return;
    }
    // if no upload is in flight, process the upload immediately.
    processMediaUpload(uploadTask).catch((error) => {
      setComposerError(error?.message || 'Failed to send message.');
    });
  };

 
  // handle attaching files to the composer
  const handleAttachFile = (e) => {
    const files = Array.from(e.target.files || []);
    addPendingFilesToUploadQueue(files);
    // reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  // handle composer drag over
  const handleComposerDragOver = (e) => {
    e.preventDefault();
    if (!canSendMessage) return;
    setDragOverComposer(true);
  };

  // handle composer drag leave
  const handleComposerDragLeave = (e) => {
    e.preventDefault();
    setDragOverComposer(false);
  };

  // handle dropped files in composer
  const handleComposerDrop = (e) => {
    e.preventDefault();
    setDragOverComposer(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (!canSendMessage || !currentConversation || files.length === 0) return;
    addPendingFilesToUploadQueue(files);
  };

  // remove the pending file from the upload queue when user clicks the remove button
  const removePendingFileFromUploadQueue = (id) => {
    setPendingFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };


  // handle send button click
  const handleSend = async (e) => {
    e.preventDefault();
    if (!canSendMessage || !currentConversation) return;

    const text = draft.trim();
    const draftBeforeSend = draft;
    const filesToUpload = pendingFiles;
    if (!text && filesToUpload.length === 0) return;

    setComposerError('');
    stopTyping();
    const recipientId = currentConversation.participants?.find((p) => p.userId !== user?.id)?.userId;

    try {
      if (text) {
        // Clear immediately for responsive UX, restore if send fails.
        setDraft('');
        await sendMessageRealtime({
          conversationId: currentConversation.id,
          type: 'text',
          content: text,
          recipientId
        });
        setTimeout(scrollToBottom, 0);
      }
    } catch (error) {
      if (text) {
        setDraft(draftBeforeSend);
      }
      setComposerError(error?.message || 'Failed to send message.');
      return;
    }

    if (filesToUpload.length > 0) {
      filesToUpload.forEach((pending) => {
        URL.revokeObjectURL(pending.previewUrl);
        enqueueUploadTask({
          file: pending.file,
          conversationId: currentConversation.id,
          recipientId
        });
      });
      setPendingFiles([]);
    }
  };

  const handleWithdrawMessage = async (message) => {
    if (!message?.id || !message?.conversationId) return;
    try {
      setComposerError('');
      await withdrawMessageRealtime({
        messageId: message.id,
        conversationId: message.conversationId
      });
    } catch (error) {
      setComposerError(error?.message || 'Failed to withdraw message.');
    }
  };

  const handleMessageContextMenu = (e, message) => {
    if (!canWithdrawMessage(message, user?.id)) {
      setWithdrawContextMenu(null);
      return;
    }
    e.preventDefault();
    setWithdrawContextMenu({
      x: e.clientX,
      y: e.clientY,
      message
    });
  };

  const handleWithdrawFromContextMenu = async () => {
    const selectedMessage = withdrawContextMenu?.message;
    setWithdrawContextMenu(null);
    await handleWithdrawMessage(selectedMessage);
  };

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  useEffect(() => {
    if (!withdrawContextMenu) return undefined;
    const handleGlobalDismiss = () => setWithdrawContextMenu(null);
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setWithdrawContextMenu(null);
      }
    };
    window.addEventListener('click', handleGlobalDismiss);
    window.addEventListener('scroll', handleGlobalDismiss, true);
    window.addEventListener('resize', handleGlobalDismiss);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('click', handleGlobalDismiss);
      window.removeEventListener('scroll', handleGlobalDismiss, true);
      window.removeEventListener('resize', handleGlobalDismiss);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [withdrawContextMenu]);

  // cleanup pending files when component unmounts
  useEffect(() => () => {
    pendingFilesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  // Keep hook order stable even while redirecting logged-out users.
  if (!isLoggedIn) {
    return null;
  }

  return (
    <>
      <Header />
      <div className="chat-page">
        <div className="chat-container">
          <ChatConversationList
            conversations={conversations}
            currentUserId={user?.id}
            loadingConversations={loadingConversations}
            onSelectChat={setSelectedChat}
            selectedChat={selectedChat}
            socketConnected={socketConnected}
          />

          {/* Right Pane - Message Details */}
          <main className="chat-main">
            <ChatThreadHeader
              currentConversation={currentConversation}
              currentOtherParticipant={currentOtherParticipant}
              isOtherParticipantOnline={isOtherParticipantOnline}
              typingUserNames={typingUserNames}
            />

            <ChatMessageList
              bindVideoContainerRef={bindVideoContainerRef}
              bindVideoNodeRef={bindVideoNodeRef}
              currentMessages={currentMessages}
              getSenderName={getSenderName}
              handleMediaRendered={handleMediaRendered}
              hasMoreOlderMessages={hasMoreOlderMessages}
              loadingOlderMessages={loadingOlderMessages}
              messagesContainerRef={chatMessagesContainerRef}
              onMessageContextMenu={handleMessageContextMenu}
              onMessagesScroll={handleMessagesScroll}
              signedMediaUrls={signedMediaUrls}
              userId={user?.id}
              visibleVideoMessageIds={visibleVideoMessageIds}
            />
            <ChatWithdrawMenu
              onWithdraw={handleWithdrawFromContextMenu}
              position={withdrawContextMenu}
            />

            <ChatComposer
              canSendMessage={canSendMessage}
              composerError={composerError}
              dragOverComposer={dragOverComposer}
              draft={draft}
              fileInputRef={fileInputRef}
              onAttachFile={handleAttachFile}
              onComposerDragLeave={handleComposerDragLeave}
              onComposerDragOver={handleComposerDragOver}
              onComposerDrop={handleComposerDrop}
              onDraftChange={setDraft}
              onRemovePendingFile={removePendingFileFromUploadQueue}
              onSend={handleSend}
              pendingFiles={pendingFiles}
            />
          </main>
        </div>
      </div>
      <Footer />
    </>
  );
}