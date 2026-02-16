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
    markAsRead,
    getMessagesForConversation
  } = useChat();
  const navigate = useNavigate();
  const [selectedChat, setSelectedChat] = useState('');
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!canSendMessage || !currentConversation) return;

    const text = draft.trim();
    if (!text) return;
    try {
      await sendMessageRealtime({
        conversationId: currentConversation.id,
        type: 'text',
        content: text,
        recipientId: currentConversation.participants?.find((p) => p.userId !== user?.id)?.userId
      });
      setDraft('');
      setTimeout(scrollToBottom, 0);
    } catch {
      // Keep UX simple for now; detailed error toast can be added later.
    }
  };

  useEffect(() => {
    // Keep view anchored to newest message and mark active conversation as read.
    scrollToBottom();
    if (!selectedChat || currentMessages.length === 0) return;
    const latest = currentMessages[currentMessages.length - 1];
    markAsRead(selectedChat, latest?.id || null).catch(() => {});
  }, [selectedChat, currentMessages.length]);
  
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
              {currentMessages.map((message, index) => (
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
                        {message.type === 'text' ? (message.content || '') : getMessagePreview(message)}
                      </div>
                      
                      {/* Optional description text providing additional context */}
                      {message.mediaUrl && (
                        <div className="message-description">{message.mediaUrl}</div>
                      )}
                      
                      {/* Optional action link (e.g., "Go to redeem", "Activate now") */}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer Row: lets users type and send messages (enabled for chat convs only) */}
            <form className="chat-composer" onSubmit={handleSend}>
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
                disabled={!canSendMessage || !draft.trim()}
                aria-label="Send message"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                Send
              </button>
            </form>
          </main>
        </div>
      </div>
      <Footer />
    </>
  );
}