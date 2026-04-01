// Render a compact timestamp for message bubbles.
export const formatTimeHHMM = (dateLike) => {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
};

// Render the sidebar timestamp with both date and time.
export const formatListTime = (dateLike) => {
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

// Normalize chat previews so the list stays meaningful for text, media, and withdrawn messages.
export const getMessagePreview = (message) => {
  if (!message) return 'No messages yet';
  if (message.isWithdrawn) return 'Message withdrawn';
  if (message.type === 'image') return '[Image]';
  if (message.type === 'video') return '[Video]';
  return message.content || 'Message';
};

// Support both stored object keys and legacy media URL fields.
export const getMediaKey = (message) => message?.mediaObjectKey || message?.mediaUrl || null;

// Restrict withdraw actions to the sender and the 2-minute window.
export const canWithdrawMessage = (message, currentUserId, now = Date.now()) => {
  if (!message || message.senderId !== currentUserId || message.isWithdrawn) return false;
  const sentAt = new Date(message.createdAt).getTime();
  if (!Number.isFinite(sentAt)) return false;
  return now - sentAt <= 2 * 60 * 1000;
};
