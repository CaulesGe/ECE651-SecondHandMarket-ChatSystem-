import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function ChatPage() {
  const { user, isLoggedIn } = useAuth();
  const { chatCount } = useChat();
  const navigate = useNavigate();
  const [selectedChat, setSelectedChat] = useState('notifications');
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef(null);

  // Generate a stable client-side UUID for new messages (v4)
  // - Prefer `crypto.randomUUID()` when available (modern browsers)
  // - Fallback to RFC4122 v4 using `crypto.getRandomValues()`
  const generateMessageId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

    const bytes = globalThis.crypto?.getRandomValues?.(new Uint8Array(16));
    if (!bytes) {
      // Last-resort fallback (should be rare). Still avoids purely time-based IDs.
      return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    // RFC4122 v4: set version (4) and variant (10xx)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  // Mock message data - replace with actual API calls
  const initialThreads = useMemo(() => ([
    {
      id: 'notifications',
      type: 'notification',
      title: 'Notification Messages',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      ),
      lastMessage: 'Login reward received',
      timestamp: '2 minutes ago',
      messages: [
        {
          id: 1,
          timestamp: '01:04',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          ),
          title: 'Login reward received',
          description: 'Up to 100 coins, can be used as money',
          actionText: 'Go to redeem',
          actionLink: '#'
        },
        {
          id: 2,
          timestamp: '01-19 23:43',
          title: 'Your level has been updated, **benefits pending collection**',
          description: 'Red envelopes, traffic coupons and other benefits doubled, quickly check your level>',
          actionText: 'Activate now',
          actionLink: '#'
        },
        {
          id: 3,
          timestamp: '01-14 22:52',
          title: 'Your benefits **are about to expire!**',
          description: 'Click to view your benefit details>>',
          actionText: 'Activate now',
          actionLink: '#'
        }
      ]
    },
    {
      id: 'support',
      type: 'chat',
      title: 'Support Chat',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      ),
      lastMessage: '[Chat with us]',
      timestamp: '2024-12-25',
      messages: [
        {
          id: 1,
          timestamp: '10:30',
          title: 'Welcome to Secondhand Hub!',
          description: 'How can we help you today?',
          actionText: 'Start chatting',
          actionLink: '#'
        }
      ]
    }
  ]), []);

  const [threads, setThreads] = useState(initialThreads);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  if (!isLoggedIn) {
    return null;
  }

  const currentThread = threads.find(t => t.id === selectedChat) || threads[0];
  const canSendMessage = currentThread?.type === 'chat';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  const formatTimeHHMM = (date) => (
    new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
  );

  const handleSend = (e) => {
    e.preventDefault();
    if (!canSendMessage) return;

    const text = draft.trim();
    if (!text) return;

    const now = new Date();
    const timeStr = formatTimeHHMM(now);
    const messageId = generateMessageId();
    const newMessage = {
      id: messageId,
      timestamp: timeStr,
      title: text,
      description: '',
      actionText: null,
      actionLink: null
    };

    setThreads(prev =>
      prev.map(t => {
        if (t.id !== currentThread.id) return t;
        return {
          ...t,
          lastMessage: text,
          timestamp: 'Just now',
          messages: [...t.messages, newMessage]
        };
      })
    );
    setDraft('');
    // Ensure we scroll after React paints the new message
    setTimeout(scrollToBottom, 0);
  };

  useEffect(() => {
    // Keep view anchored to newest message when switching threads
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat]);
  
  return (
    <>
      <Header />
      <div className="chat-page">
        <div className="chat-container">
          {/* Left Sidebar - Message List */}
          <aside className="chat-sidebar">
            <h2 className="chat-sidebar-title">Messages</h2>
            <div className="chat-list">
              {threads.map(thread => (
                <button
                  key={thread.id}
                  className={`chat-item ${selectedChat === thread.id ? 'active' : ''}`}
                  onClick={() => setSelectedChat(thread.id)}
                >
                  <div className={`chat-item-icon ${thread.type}`}>
                    {thread.icon}
                  </div>
                  <div className="chat-item-content">
                    <div className="chat-item-title">{thread.title}</div>
                    <div className="chat-item-preview">{thread.lastMessage}</div>
                    <div className="chat-item-time">{thread.timestamp}</div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Right Pane - Message Details */}
          <main className="chat-main">
            {/* Chat Header: Displays current thread title and action buttons */}
            <div className="chat-header">
              <h2 className="chat-header-title">{currentThread.title}</h2>
              {/* Action buttons for thread management (archive, mark as read, etc.) */}
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

            {/* Messages Container: Scrollable area displaying all messages in the thread */}
            <div className="chat-messages">
              {/* Render each message in the current thread */}
              {currentThread.messages.map((message, index) => (
                <div key={message.id} className="message-bubble">
                  {/* 
                    Timestamp Display Logic:
                    Show timestamp only if it's the first message OR 
                    if the timestamp differs from the previous message.
                    This prevents duplicate timestamps for messages sent at the same time.
                  */}
                  {index === 0 || currentThread.messages[index - 1].timestamp !== message.timestamp ? (
                    <div className="message-timestamp">{message.timestamp}</div>
                  ) : null}
                  
                  {/* Message Content: Contains icon, title, description, and action link */}
                  <div className="message-content">
                    {/* Optional icon displayed on the left side of the message (e.g., notification bell, money bag) */}
                    {message.icon && (
                      <div className="message-icon">
                        {message.icon}
                      </div>
                    )}
                    
                    {/* Message Text Container: Title, description, and action link */}
                    <div className="message-text">
                      {/* 
                        Message Title: Supports markdown-style bold text (**text**)
                        Converts **text** to <strong>text</strong> for rendering
                        Note: Using dangerouslySetInnerHTML requires sanitization in production
                      */}
                      <div className="message-title" dangerouslySetInnerHTML={{ 
                        __html: message.title.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                      }}></div>
                      
                      {/* Optional description text providing additional context */}
                      {message.description && (
                        <div className="message-description">{message.description}</div>
                      )}
                      
                      {/* Optional action link (e.g., "Go to redeem", "Activate now") */}
                      {message.actionText && (
                        <a href={message.actionLink} className="message-action">
                          {message.actionText}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer Row: lets users type and send messages (enabled for chat threads only) */}
            <form className="chat-composer" onSubmit={handleSend}>
              <input
                className="chat-input"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={canSendMessage ? 'Type a message…' : 'Messaging is disabled for notifications'}
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