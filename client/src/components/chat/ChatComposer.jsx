// Render the chat composer, attachment previews, and send controls.
export default function ChatComposer({
  canSendMessage,
  composerError,
  dragOverComposer,
  draft,
  fileInputRef,
  onAttachFile,
  onComposerDragLeave,
  onComposerDragOver,
  onComposerDrop,
  onDraftChange,
  onRemovePendingFile,
  onSend,
  pendingFiles
}) {
  return (
    <>
      <form
        className={`chat-composer ${dragOverComposer ? 'chat-composer-drag-over' : ''}`}
        onSubmit={onSend}
        onDragOver={onComposerDragOver}
        onDragLeave={onComposerDragLeave}
        onDrop={onComposerDrop}
      >
        <input
          ref={fileInputRef}
          className="chat-file-input"
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={onAttachFile}
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
                  onClick={() => onRemovePendingFile(pending.id)}
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
          data-testid="chat-input"
          type="text"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={canSendMessage ? 'Type a message...' : 'Select a conversation first'}
          disabled={!canSendMessage}
          aria-label="Message input"
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm chat-send-btn"
          data-testid="chat-send-btn"
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
      {composerError ? <div className="chat-composer-error" data-testid="chat-composer-error">{composerError}</div> : null}
    </>
  );
}
