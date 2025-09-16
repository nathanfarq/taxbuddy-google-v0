import React from 'react';
import CloseIcon from './icons/CloseIcon';

interface TokenWarningPopupProps {
  remainingTokens: number;
  onDismiss: () => void;
}

const TokenWarningPopup: React.FC<TokenWarningPopupProps> = ({ remainingTokens, onDismiss }) => {
  return (
    <div 
      className="absolute top-4 left-1/2 -translate-x-1/2 w-11/12 max-w-3xl bg-amber-100 border border-amber-300 text-amber-900 px-4 py-3 rounded-lg shadow-lg z-10 flex items-center justify-between"
      role="alert"
    >
      <p className="text-sm">
        <strong>Warning:</strong> You are approximately <strong>{remainingTokens.toLocaleString()}</strong> tokens away from the context limit. Consider starting a new inquiry for complex topics to ensure accuracy.
      </p>
      <button 
        onClick={onDismiss} 
        className="p-1 -mr-1 rounded-full hover:bg-amber-200 transition-colors" 
        aria-label="Dismiss warning"
      >
        <CloseIcon className="h-5 w-5" />
      </button>
    </div>
  );
};

export default TokenWarningPopup;
