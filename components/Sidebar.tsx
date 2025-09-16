import React from 'react';
import { Conversation } from '../types';
import NewChatIcon from './icons/NewChatIcon';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
}

const QuickAccessButton: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <button className="w-full text-left text-sm text-slate-300 hover:bg-slate-700 rounded-md px-3 py-2 transition-colors">
      {children}
    </button>
  );

const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
}) => {
  return (
    <aside className="w-72 bg-slate-900 text-white p-4 flex flex-col">
      <div className="flex-shrink-0">
        <h1 className="text-xl font-bold mb-1">Tax Research AI</h1>
        <p className="text-xs text-slate-400 mb-4">Your Tax Research Co-Pilot</p>
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors mb-6"
        >
          <NewChatIcon />
          New Inquiry
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        <h2 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">
          History
        </h2>
        <nav className="flex flex-col gap-1">
          {conversations.map(conv => (
            <a
              key={conv.id}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onSelectConversation(conv.id);
              }}
              className={`block text-sm truncate py-2 px-3 rounded-md transition-colors ${
                conv.id === activeConversationId
                  ? 'bg-slate-700/80'
                  : 'hover:bg-slate-800'
              }`}
            >
              {conv.title}
            </a>
          ))}
        </nav>
      </div>

      <div className="flex-shrink-0 border-t border-slate-700 pt-4 mt-4">
        <h2 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">
            Quick Access
        </h2>
        <div className="space-y-1">
            <QuickAccessButton>Current Tax Rates</QuickAccessButton>
            <QuickAccessButton>Filing Deadlines</QuickAccessButton>
            <QuickAccessButton>Common Forms</QuickAccessButton>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;