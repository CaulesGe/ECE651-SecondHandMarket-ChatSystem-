// Show the active conversation title plus live presence and typing status.
export default function ChatThreadHeader({
  currentConversation,
  currentOtherParticipant,
  isOtherParticipantOnline,
  typingUserNames
}) {
  const title = currentConversation
    ? (currentOtherParticipant?.name || `Conversation ${currentConversation.id.slice(0, 6)}`)
    : 'Messages';

  const presenceText = typingUserNames.length > 0
    ? `${typingUserNames.join(', ')} ${typingUserNames.length > 1 ? 'are' : 'is'} typing...`
    : (isOtherParticipantOnline ? 'Online' : 'Offline');

  return (
    <div className="chat-header">
      <h2 className="chat-header-title">{title}</h2>
      {currentConversation && currentOtherParticipant && (
        <div className="chat-presence-status" aria-live="polite" data-testid="chat-presence-status">
          {presenceText}
        </div>
      )}
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
  );
}
