import { formatPrice } from '../utils/api';

const formatUpdatedTime = (value) => {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString();
};

export default function DraftPanel({
  drafts = [],
  isLoggedIn,
  loading = false,
  onEditDraft,
  onDeleteDraft,
  onOpenProfile
}) {
  return (
    <aside className="draft-panel">
      <div className="cart-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="9" y1="13" x2="15" y2="13"></line>
            <line x1="9" y1="17" x2="13" y2="17"></line>
          </svg>
          Your Drafts
        </h3>
        <span className="badge-count">{drafts.length}</span>
      </div>

      {!isLoggedIn ? (
        <p className="notice draft-notice">Login to save and manage your drafts.</p>
      ) : loading ? (
        <div className="empty-cart">
          <p>Loading drafts...</p>
        </div>
      ) : drafts.length === 0 ? (
        <div className="empty-cart">
          <p>No drafts yet</p>
        </div>
      ) : (
        <div className="draft-items">
          {drafts.map((draft) => (
            <div key={draft.id} className="draft-item">
              <div className="draft-item-main">
                <strong>{draft.title || 'Untitled Draft'}</strong>
                <span>
                  {draft.price ? formatPrice(draft.price) : 'No price'}
                  {' · '}
                  {draft.category || 'No category'}
                </span>
                <small>Last saved: {formatUpdatedTime(draft.updatedAt)}</small>
              </div>
              <div className="draft-actions">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => onEditDraft?.(draft)}
                  type="button"
                >
                  Continue
                </button>
                <button
                  className="btn btn-sm btn-secondary draft-delete-btn"
                  onClick={() => onDeleteDraft?.(draft.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoggedIn && drafts.length > 0 && (
        <button className="btn btn-secondary draft-profile-btn" onClick={onOpenProfile} type="button">
          View all drafts in profile
        </button>
      )}
    </aside>
  );
}
