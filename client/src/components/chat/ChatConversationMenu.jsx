// Render the contextual conversation action at the cursor position.
export default function ChatConversationMenu({ onDeleteConversation, position }) {
  if (!position) return null;

  return (
    <div
      className="message-context-menu"
      data-testid="conversation-context-menu"
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
    >
      <button
        type="button"
        className="message-context-menu-item"
        data-testid="delete-conversation-action"
        onClick={onDeleteConversation}
      >
        Delete from list
      </button>
    </div>
  );
}
