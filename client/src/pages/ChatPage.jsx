import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function ChatPage() {
  const { user, isLoggedIn } = useAuth();
  const {
    conversations,
    loadingConversations,
    socketConnected,
    loadConversations,
    loadMessages,
    sendMessageRealtime,
    uploadMediaForConversation,
    signMediaDownload,
    markAsRead,
    getMessagesForConversation
  } = useChat();
  const navigate = useNavigate();
  const [selectedChat, setSelectedChat] = useState('');
  const [draft, setDraft] = useState('');
  const [composerError, setComposerError] = useState('');
  const [dragOverComposer, setDragOverComposer] = useState(false);
  const [signedMediaUrls, setSignedMediaUrls] = useState({});
  // refs for the messages end, file input, media upload in flight, queued media upload, and failed media keys
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaUploadInFlightRef = useRef(false);
  const queuedMediaUploadRef = useRef([]);
  const failedMediaKeysRef = useRef(new Set());
  // state for pending files
  const [pendingFiles, setPendingFiles] = useState([]);
  const pendingFilesRef = useRef([]);

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

  // Load messages when user switches conversation and mark latest as read.
  useEffect(() => {
    if (!selectedChat) return;
    loadMessages(selectedChat).then((items) => {
      const latest = items[items.length - 1];
      markAsRead(selectedChat, latest?.id || null).catch(() => {});
    }).catch(() => {});
  }, [selectedChat, loadMessages, markAsRead]);

  if (!isLoggedIn) {
    return null;
  }

  const currentConversation = conversations.find((t) => t.id === selectedChat) || null;
  const currentMessages = currentConversation ? getMessagesForConversation(currentConversation.id) : [];
  const canSendMessage = Boolean(currentConversation);
  const lastMessageId = currentMessages[currentMessages.length - 1]?.id;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  const handleMediaRendered = () => {
    // Media height can expand after initial render; scroll again once loaded.
    requestAnimationFrame(scrollToBottom);
  };

  const formatTimeHHMM = (dateLike) => {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  };

  const formatListTime = (dateLike) => {
    if (!dateLike) return '';
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  };

  const getMessagePreview = (message) => {
    if (!message) return 'No messages yet';
    if (message.type === 'image') return '[Image]';
    if (message.type === 'video') return '[Video]';
    return message.content || 'Message';
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
    } else {
    // if no upload is in flight, process the upload immediately.
      processMediaUpload(uploadTask).catch((error) => {
        setComposerError(error?.message || 'Failed to send message.');
      });
    }
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
    const filesToUpload = pendingFiles;
    if (!text && filesToUpload.length === 0) return;

    setComposerError('');
    const recipientId = currentConversation.participants?.find((p) => p.userId !== user?.id)?.userId;

    try {
      if (text) {
        await sendMessageRealtime({
          conversationId: currentConversation.id,
          type: 'text',
          content: text,
          recipientId
        });
        setDraft('');
        setTimeout(scrollToBottom, 0);
      }
    } catch (error) {
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

  useEffect(() => {
    // Keep view anchored to newest message and mark active conversation as read.
    scrollToBottom();
    if (!selectedChat || currentMessages.length === 0) return;
    const latest = currentMessages[currentMessages.length - 1];
    markAsRead(selectedChat, latest?.id || null).catch(() => {});
  }, [selectedChat, lastMessageId]);

  useEffect(() => {
    if (!isLoggedIn || !user?.id || currentMessages.length === 0) return;
    const meaObjectKeys = [...new Set(
      currentMessages
        .map((message) => message.mediaObjectKey || message.mediaUrl)
        .filter(Boolean)
    )];
    const pendingKeys = meaObjectKeys.filter(
      (key) => !signedMediaUrls[key] && !failedMediaKeysRef.current.has(key)
    );
    if (pendingKeys.length === 0) return;

    let cancelled = false;
    // sign the media download urls
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
      // update the signed media urls
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
  }, [isLoggedIn, user?.id, currentMessages, signedMediaUrls, signMediaDownload]);

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  // cleanup pending files when component unmounts
  useEffect(() => () => {
    pendingFilesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);
  
  return (
    <>
      <Header />
      <div className="chat-page">
        <div className="chat-container">
          {/* Left Sidebar - Message List */}
          <aside className="chat-sidebar">
            <h2 className="chat-sidebar-title">
              Messages {socketConnected ? '' : '(offline)'}
            </h2>
            <div className="chat-list">
              {loadingConversations ? (
                <div className="chat-item-time">Loading conversations...</div>
              ) : conversations.length === 0 ? (
                <div className="chat-item-time">No conversations yet.</div>
              ) : (
                conversations.map((conversation) => {
                  const otherParticipant = conversation.participants?.find(
                    (p) => p.user?.id !== user?.id
                  )?.user;
                  const title = otherParticipant?.name || `Conversation ${conversation.id.slice(0, 6)}`;
                  const lastMessage = conversation.lastMessage || null;
                  return (
                    <button
                      key={conversation.id}
                      className={`chat-item ${selectedChat === conversation.id ? 'active' : ''}`}
                      onClick={() => setSelectedChat(conversation.id)}
                    >
                      <div className="chat-item-icon chat">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                      </div>
                      <div className="chat-item-content">
                        <div className="chat-item-title">{title}</div>
                        <div className="chat-item-preview">{getMessagePreview(lastMessage)}</div>
                        <div className="chat-item-time">{formatListTime(lastMessage?.createdAt || conversation.updatedAt)}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Pane - Message Details */}
          <main className="chat-main">
            {/* Chat Header: Displays current conv title and action buttons */}
            <div className="chat-header">
              <h2 className="chat-header-title">
                {currentConversation ? `Conversation ${currentConversation.id.slice(0, 6)}` : 'Messages'}
              </h2>
              {/* Action buttons for conv management (archive, mark as read, etc.) */}
              <div className="chat-header-actions">
                <button className="chat-header-btn" aria-label="Archive">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </button>
                <button className="chat-header-btn" aria-label="Mark as read">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages Container: Scrollable area displaying all messages in the conv */}
            <div className="chat-messages">
              {/* Render each message in the current conv */}
              {currentMessages.map((message, index) => {
                const mediaKey = message.mediaObjectKey || message.mediaUrl || null;
                const mediaDownloadUrl = mediaKey ? signedMediaUrls[mediaKey] : null;
                return (
                <div key={message.id} className="message-bubble">
                  {/* 
                    Timestamp Display Logic:
                    Show timestamp only if it's the first message OR 
                    if the timestamp differs from the previous message.
                    This prevents duplicate timestamps for messages sent at the same time.
                  */}
                  {index === 0 || currentMessages[index - 1].createdAt !== message.createdAt ? (
                    <div className="message-timestamp">{formatTimeHHMM(message.createdAt)}</div>
                  ) : null}
                  
                  {/* Message Content: Contains icon, title, description, and action link */}
                  <div className={`message-description ${message.senderId === user?.id ? 'message-sender-self' : 'message-recipient'}`}>
                    {getSenderName(message)}
                  </div>
                  <div className="message-content">
                    {/* Optional icon displayed on the left side of the message (e.g., notification bell, money bag) */}
                    {message.type !== 'text' && (
                      <div className="message-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {message.type === 'image' ? (
                            <>
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                              <circle cx="8.5" cy="8.5" r="1.5"></circle>
                              <polyline points="21 15 16 10 5 21"></polyline>
                            </>
                          ) : (
                            <>
                              <polygon points="23 7 16 12 23 17 23 7"></polygon>
                              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                            </>
                          )}
                        </svg>
                      </div>
                    )}
                    
                    {/* Message Text Container: Title, description, and action link */}
                    <div className="message-text">
                      {/* 
                        Message Title: Supports markdown-style bold text (**text**)
                        Converts **text** to <strong>text</strong> for rendering
                        Note: Using dangerouslySetInnerHTML requires sanitization in production
                      */}
                      <div className="message-title">
                        {message.type === 'text' ? (message.content || '') : ''}
                      </div>
                      
                      {/* Optional description text providing additional context */}
                      {message.type === 'image' && mediaDownloadUrl && (
                        <img
                          className="message-media message-media-image"
                          src={mediaDownloadUrl}
                          alt="Shared image"
                          loading="lazy"
                          onLoad={handleMediaRendered}
                        />
                      )}
                      {message.type === 'video' && mediaDownloadUrl && (
                        <video
                          className="message-media message-media-video"
                          controls
                          preload="metadata"
                          src={mediaDownloadUrl}
                          onLoadedData={handleMediaRendered}
                        />
                      )}
                      {mediaKey && !mediaDownloadUrl && (
                        <div className="message-description">Loading media...</div>
                      )}
                      
                      {/* Optional action link (e.g., "Go to redeem", "Activate now") */}
                    </div>
                  </div>
                </div>
              )})}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer Row: lets users type and send messages (enabled for chat convs only) */}
            <form
              className={`chat-composer ${dragOverComposer ? 'chat-composer-drag-over' : ''}`}
              onSubmit={handleSend}
              onDragOver={handleComposerDragOver}
              onDragLeave={handleComposerDragLeave}
              onDrop={handleComposerDrop}
            >
              <input
                ref={fileInputRef}
                className="chat-file-input"
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleAttachFile}
                disabled={!canSendMessage}
                aria-label="Attach image or video"
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm chat-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canSendMessage}
              >
                Attach
              </button>
              {pendingFiles.length > 0 && (
                <div className="chat-file-preview-list">
                  {pendingFiles.map((pending) => (
                    <div key={pending.id} className="chat-file-preview-item" title={pending.file.name}>
                      {pending.kind === 'image' ? (
                        <img className="chat-file-preview-thumb" src={pending.previewUrl} alt={pending.file.name} />
                      ) : (
                        <video className="chat-file-preview-thumb" src={pending.previewUrl} preload="metadata" muted />
                      )}
                      <button
                        type="button"
                        className="chat-file-preview-remove"
                        onClick={() => removePendingFileFromUploadQueue(pending.id)}
                        aria-label="Remove attachment"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                className="chat-input"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={canSendMessage ? 'Type a message...' : 'Select a conversation first'}
                disabled={!canSendMessage}
                aria-label="Message input"
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm chat-send-btn"
                disabled={!canSendMessage || (!draft.trim() && pendingFiles.length === 0)}
                aria-label="Send message"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                Send
              </button>
            </form>
            {composerError ? <div className="chat-composer-error">{composerError}</div> : null}
          </main>
        </div>
      </div>
      <Footer />
    </>
  );
}