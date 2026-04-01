import { formatTimeHHMM, getMediaKey } from '../../helpers/ChatHelpers';

// Render one chat message row, including media and withdraw states.
export default function ChatMessageBubble({
  bindVideoContainerRef,
  bindVideoNodeRef,
  getSenderName,
  handleMediaRendered,
  isFirstInTimestampGroup,
  message,
  onMessageContextMenu,
  signedMediaUrls,
  userId,
  visibleVideoMessageIds
}) {
  const mediaKey = getMediaKey(message);
  const mediaDownloadUrl = mediaKey ? signedMediaUrls[mediaKey] : null;
  const isVisibleVideo = Boolean(message.type === 'video' && visibleVideoMessageIds[message.id]);
  const isWithdrawn = Boolean(message.isWithdrawn);

  return (
    <div
      data-testid={`message-bubble-${message.id}`}
      className="message-bubble"
      onContextMenu={(e) => onMessageContextMenu(e, message)}
    >
      {isFirstInTimestampGroup ? (
        <div className="message-timestamp">{formatTimeHHMM(message.createdAt)}</div>
      ) : null}

      <div className={`message-description ${message.senderId === userId ? 'message-sender-self' : 'message-recipient'}`}>
        {getSenderName(message)}
      </div>
      <div className="message-content">
        {!isWithdrawn && message.type !== 'text' && (
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

        <div className="message-text">
          <div className="message-title">
            {isWithdrawn ? 'Message withdrawn' : (message.type === 'text' ? (message.content || '') : '')}
          </div>

          {!isWithdrawn && message.type === 'image' && mediaDownloadUrl && (
            <img
              className="message-media message-media-image"
              src={mediaDownloadUrl}
              alt="Shared image"
              loading="lazy"
              onLoad={() => handleMediaRendered(message.id)}
            />
          )}
          {!isWithdrawn && message.type === 'video' && mediaDownloadUrl && (
            <div
              className="message-media-video-shell"
              data-message-id={message.id}
              ref={bindVideoContainerRef(message.id)}
            >
              <video
                className="message-media message-media-video"
                controls
                preload="none"
                src={isVisibleVideo ? mediaDownloadUrl : undefined}
                ref={bindVideoNodeRef(message.id)}
                onLoadedData={() => handleMediaRendered(message.id)}
              />
            </div>
          )}
          {!isWithdrawn && mediaKey && message.type === 'video' && !isVisibleVideo && (
            <div
              className="message-description"
              data-message-id={message.id}
              ref={bindVideoContainerRef(message.id)}
            >
              Video will load when visible.
            </div>
          )}
          {!isWithdrawn && mediaKey && !mediaDownloadUrl && message.type !== 'video' && (
            <div className="message-description">Loading media...</div>
          )}
          {!isWithdrawn && mediaKey && message.type === 'video' && isVisibleVideo && !mediaDownloadUrl && (
            <div className="message-description">Loading media...</div>
          )}
        </div>
      </div>
    </div>
  );
}
