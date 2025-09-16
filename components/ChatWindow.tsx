import React, { useEffect, useRef } from 'react';
import { Conversation, Role, Feedback } from '../types';
import ChatInput from './ChatInput';
import Message from './Message';
import TokenWarningPopup from './TokenWarningPopup';

interface ChatWindowProps {
  conversation: Conversation;
  isLoading: boolean;
  error: string | null;
  onSendMessage: (text: string) => void;
  onFeedback: (messageId: string, feedback: Feedback) => void;
  showTokenWarning: boolean;
  remainingTokens: number;
  onDismissTokenWarning: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  isLoading,
  error,
  onSendMessage,
  onFeedback,
  showTokenWarning,
  remainingTokens,
  onDismissTokenWarning,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages]);

  return (
    <div className="flex flex-col h-full relative">
      {showTokenWarning && (
        <TokenWarningPopup
            remainingTokens={remainingTokens}
            onDismiss={onDismissTokenWarning}
        />
      )}
      <header className="flex-shrink-0 flex items-center h-16 bg-white border-b border-slate-200 px-6">
        <h2 className="text-lg font-semibold">{conversation.title}</h2>
        <div className="ml-auto text-xs text-slate-500">
            <span className="font-semibold">Context:</span> Tax Year: 2024 | Jurisdiction: Federal
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-4xl mx-auto space-y-6">
          {conversation.messages.map((msg, index) => (
            <Message
              key={msg.id}
              message={msg}
              isLoading={isLoading && msg.role === Role.ASSISTANT && index === conversation.messages.length - 1}
              onFeedback={onFeedback}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {error && (
        <div className="flex-shrink-0 px-6 py-2 bg-red-100 text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      <footer className="flex-shrink-0 bg-white border-t border-slate-200 p-4">
        <div className="max-w-4xl mx-auto">
          <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} />
        </div>
      </footer>
    </div>
  );
};

export default ChatWindow;