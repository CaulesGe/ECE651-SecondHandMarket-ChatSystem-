import ChatMessageBubble from './ChatMessageBubble';

// Render the message timeline, media states, and infinite-scroll container.
export default function ChatMessageList({
  bindVideoContainerRef,
  bindVideoNodeRef,
  currentMessages,
  getSenderName,
  handleMediaRendered,
  hasMoreOlderMessages,
  loadingOlderMessages,
  messagesContainerRef,
  onMessageContextMenu,
  onMessagesScroll,
  signedMediaUrls,
  userId,
  visibleVideoMessageIds
}) {
  return (
    <div
      ref={messagesContainerRef}
      className="chat-messages"
      onScroll={onMessagesScroll}
      data-testid="chat-messages"
    >
      {loadingOlderMessages && (
        <div className="chat-item-time">Loading older messages...</div>
      )}
      {!loadingOlderMessages && !hasMoreOlderMessages && currentMessages.length > 0 && (
        <div className="chat-item-time">No older messages.</div>
      )}
      {currentMessages.map((message, index) => {
        return (
          <ChatMessageBubble
            key={message.id}
            bindVideoContainerRef={bindVideoContainerRef}
            bindVideoNodeRef={bindVideoNodeRef}
            getSenderName={getSenderName}
            handleMediaRendered={handleMediaRendered}
            isFirstInTimestampGroup={
              index === 0 || currentMessages[index - 1].createdAt !== message.createdAt
            }
            message={message}
            onMessageContextMenu={onMessageContextMenu}
            signedMediaUrls={signedMediaUrls}
            userId={userId}
            visibleVideoMessageIds={visibleVideoMessageIds}
          />
        );
      })}
    </div>
  );
}
