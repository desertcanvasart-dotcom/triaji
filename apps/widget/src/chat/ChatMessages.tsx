import React, { useEffect, useRef } from 'react';
import type { WidgetMessage } from '../config';

interface ChatMessagesProps {
  messages: WidgetMessage[];
  isTyping: boolean;
  primaryColor: string;
}

export function ChatMessages({ messages, isTyping, primaryColor }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isTyping]);

  return (
    <div className="triaji-messages">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`triaji-bubble ${msg.role}`}
          style={
            msg.role === 'patient'
              ? { backgroundColor: primaryColor }
              : undefined
          }
        >
          {msg.content}
        </div>
      ))}
      {isTyping && (
        <div className="triaji-typing">
          <div className="triaji-typing-dot" />
          <div className="triaji-typing-dot" />
          <div className="triaji-typing-dot" />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
