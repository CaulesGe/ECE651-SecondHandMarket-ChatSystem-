import { formatListTime, getMessagePreview } from '../../helpers/ChatHelpers';

// Render the conversation sidebar and highlight the active thread.
export default function ChatConversationList({
  conversations,
  currentUserId,
  loadingConversations,
  onSelectChat,
  selectedChat,
  socketConnected
}) {
  return (
    <aside className="chat-sidebar">
      <h2 className="chat-sidebar-title">
        Messages {socketConnected ? '' : '(offline)'}
      </h2>
      <div className="chat-list" data-testid="chat-list">
        {loadingConversations ? (
          <div className="chat-item-time">Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <div className="chat-item-time">No conversations yet.</div>
        ) : (
          conversations.map((conversation) => {
            const otherParticipant = conversation.participants?.find(
              (participant) => participant.user?.id !== currentUserId
            )?.user;
            const title = otherParticipant?.name || `Conversation ${conversation.id.slice(0, 6)}`;
            const lastMessage = conversation.lastMessage || null;

            return (
              <button
                key={conversation.id}
                data-testid={`chat-item-${conversation.id}`}
                className={`chat-item ${selectedChat === conversation.id ? 'active' : ''}`}
                onClick={() => onSelectChat(conversation.id)}
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
  );
}
