import React from 'react';
import { Message as MessageType, Role, Feedback } from '../types';
import UserIcon from './icons/UserIcon';
import BotIcon from './icons/BotIcon';
import ThumbsUpIcon from './icons/ThumbsUpIcon';
import ThumbsDownIcon from './icons/ThumbsDownIcon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageProps {
  message: MessageType;
  isLoading?: boolean;
  onFeedback: (messageId: string, feedback: Feedback) => void;
}

const Message: React.FC<MessageProps> = ({ message, isLoading = false, onFeedback }) => {
  const isAssistant = message.role === Role.ASSISTANT;

  const containerClasses = `flex items-start gap-4 ${isAssistant ? '' : 'flex-row-reverse'}`;
  const bubbleClasses = `max-w-2xl rounded-lg px-5 py-3 shadow-sm ${
    isAssistant
      ? 'bg-white text-slate-800 rounded-tl-none'
      : 'bg-indigo-600 text-white rounded-tr-none'
  }`;

  const Icon = isAssistant ? BotIcon : UserIcon;
  const iconClasses = `h-8 w-8 rounded-full flex-shrink-0 p-1.5 ${isAssistant ? 'bg-slate-200 text-slate-600' : 'bg-indigo-200 text-indigo-700'}`;
  
  const feedbackButtonClasses = "p-1 rounded-md hover:bg-slate-100 transition-colors";

  return (
    <div className={containerClasses}>
      <div className={iconClasses}>
        <Icon />
      </div>
      <div className={bubbleClasses}>
        {isAssistant && isLoading && !message.text ? (
            <div className="flex items-center gap-2">
                <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce"></span>
            </div>
        ) : (
            <>
                <div className="prose prose-sm max-w-none text-inherit">
                    {isAssistant ? (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                a: ({node, ...props}) => (
                                    <a 
                                        {...props} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:text-indigo-800 underline transition-colors"
                                    />
                                ),
                            }}
                        >
                            {message.text}
                        </ReactMarkdown>
                    ) : (
                        <p>{message.text}</p>
                    )}
                </div>
                {isAssistant && message.sources && message.sources.length > 0 && (
                    <div className="mt-4 border-t border-slate-200 pt-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Sources</h4>
                        <ul className="list-none p-0 m-0 space-y-1.5 text-xs">
                            {message.sources.map((source, index) => (
                                <li key={index} className="truncate">
                                    <a 
                                        href={source.uri} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                                        title={source.title || source.uri}
                                    >
                                        {source.title || source.uri}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {isAssistant && !isLoading && message.text && (
                     <div className="mt-3 -mb-1 flex items-center justify-end gap-1">
                        <button 
                            className={feedbackButtonClasses} 
                            onClick={() => onFeedback(message.id, Feedback.UP)}
                            aria-label="Good response"
                        >
                            <ThumbsUpIcon className={`h-4 w-4 ${message.feedback === Feedback.UP ? 'text-indigo-600' : 'text-slate-400'}`} />
                        </button>
                        <button 
                            className={feedbackButtonClasses} 
                            onClick={() => onFeedback(message.id, Feedback.DOWN)}
                            aria-label="Bad response"
                        >
                            <ThumbsDownIcon className={`h-4 w-4 ${message.feedback === Feedback.DOWN ? 'text-indigo-600' : 'text-slate-400'}`} />
                        </button>
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
};

export default Message;