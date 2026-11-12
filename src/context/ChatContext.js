'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [chatContextData, setChatContextData] = useState(null); // { attachedType, attachedId, attachedMeta, pos, orderStatus, initialPrompt }
  const [unreadCount, setUnreadCount] = useState(0);

  // Buka widget chat dengan payload konteks opsional
  const openChat = useCallback((context = null) => {
    if (context) {
      setChatContextData(context);
    }
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Listener event global agar komponen manapun bisa memicu openChat tanpa prop drilling
  useEffect(() => {
    const handleGlobalOpen = (e) => {
      openChat(e.detail || null);
    };

    window.addEventListener('sumde:open-chat', handleGlobalOpen);
    return () => {
      window.removeEventListener('sumde:open-chat', handleGlobalOpen);
    };
  }, [openChat]);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        openChat,
        closeChat,
        toggleChat,
        chatContextData,
        setChatContextData,
        unreadCount,
        setUnreadCount,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return ctx;
}
