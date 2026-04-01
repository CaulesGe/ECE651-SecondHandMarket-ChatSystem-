// Render the contextual withdraw action at the cursor position.
export default function ChatWithdrawMenu({ onWithdraw, position }) {
  if (!position) return null;

  return (
    <div
      className="message-context-menu"
      data-testid="message-context-menu"
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
    >
      <button
        type="button"
        className="message-context-menu-item"
        data-testid="withdraw-action"
        onClick={onWithdraw}
      >
        Withdraw
      </button>
    </div>
  );
}
