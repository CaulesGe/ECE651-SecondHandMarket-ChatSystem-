import { createContext, useContext, useState, useEffect } from 'react';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [chatCount, setChatCount] = useState(0);

  return (
    <ChatContext.Provider value={{
      chatCount,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}