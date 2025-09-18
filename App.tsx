import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import { Conversation, Message, Role, Source, Feedback } from './types';
import { TaxResearchChat, classifyInquiry, GenerateContentResponse } from './services/openaiService';
import { v4 as uuidv4 } from 'uuid';
import { CONTEXT_TOKEN_LIMIT, TOKEN_WARNING_THRESHOLD, SYSTEM_INSTRUCTIONS } from './constants';

const App: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTokenWarning, setShowTokenWarning] = useState(false);
  const [remainingTokens, setRemainingTokens] = useState(CONTEXT_TOKEN_LIMIT);
  const chatServiceRef = useRef<TaxResearchChat | null>(null);

  useEffect(() => {
    // Initialize with a new chat on first load
    if (conversations.length === 0) {
      handleNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const activeConv = conversations.find(c => c.id === activeConversationId);
    if (!activeConv) {
        setShowTokenWarning(false);
        return;
    }

    // Approx 1 token ~= 4 characters
    const systemInstructionTokens = Math.ceil(SYSTEM_INSTRUCTIONS.length / 4);
    const conversationTokens = activeConv.messages.reduce((acc, msg) => acc + Math.ceil(msg.text.length / 4), 0);
    const totalTokens = systemInstructionTokens + conversationTokens;
    
    const remaining = CONTEXT_TOKEN_LIMIT - totalTokens;
    setRemainingTokens(remaining > 0 ? remaining : 0);

    if (totalTokens > TOKEN_WARNING_THRESHOLD && totalTokens < CONTEXT_TOKEN_LIMIT) {
        setShowTokenWarning(true);
    } else {
        setShowTokenWarning(false);
    }
  }, [activeConversationId, conversations]);


  const handleNewChat = useCallback(() => {
    try {
      chatServiceRef.current = new TaxResearchChat();
      const newConversation: Conversation = {
        id: uuidv4(),
        title: 'New Tax Inquiry',
        messages: [],
      };
      setConversations(prev => [newConversation, ...prev]);
      setActiveConversationId(newConversation.id);
      setError(null);
    } catch (e) {
      setError("Failed to initialize AI. Please check your API key.");
      console.error(e);
    }
  }, []);

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    // Note: In a real app, you'd re-initialize the chat service with the history of the selected conversation.
    // For this example, we create a new chat session when switching.
    chatServiceRef.current = new TaxResearchChat();
  };

  const handleFeedback = (messageId: string, feedback: Feedback) => {
    setConversations(prev =>
        prev.map(conv => {
            if (conv.id === activeConversationId) {
                const updatedMessages = conv.messages.map(msg => {
                    if (msg.id === messageId) {
                        // If the user clicks the same feedback button again, toggle it off.
                        const finalFeedback = msg.feedback === feedback ? undefined : feedback;
                        
                        // Simulate sending to a backend for analysis and model retraining.
                        if (finalFeedback) {
                            console.log(`Feedback submitted: Message ID ${messageId}, Rating: ${finalFeedback}`);
                        } else {
                            console.log(`Feedback retracted: Message ID ${messageId}`);
                        }
                        
                        return { ...msg, feedback: finalFeedback };
                    }
                    return msg;
                });
                return { ...conv, messages: updatedMessages };
            }
            return conv;
        })
    );
  };

  const handleSendMessage = async (text: string) => {
    if (!activeConversationId || !chatServiceRef.current) return;

    const userMessage: Message = { id: uuidv4(), role: Role.USER, text };
    
    const activeConv = conversations.find(c => c.id === activeConversationId);

    // Fire-and-forget title classification for the first message
    if (activeConv && activeConv.messages.length === 0 && activeConv.title === 'New Tax Inquiry') {
        (async () => {
            try {
                const title = await classifyInquiry(text);
                setConversations(prev =>
                    prev.map(conv =>
                        conv.id === activeConversationId ? { ...conv, title } : conv
                    )
                );
            } catch (e) {
                console.error("Failed to classify inquiry:", e);
                // Fail silently from a UX perspective
            }
        })();
    }

    // Add user message to the active conversation
    setConversations(prev =>
      prev.map(conv =>
        conv.id === activeConversationId
          ? { ...conv, messages: [...conv.messages, userMessage] }
          : conv
      )
    );

    setIsLoading(true);
    setError(null);

    const assistantMessageId = uuidv4();
    const assistantMessage: Message = { id: assistantMessageId, role: Role.ASSISTANT, text: '' };

    // Add empty assistant message shell
    setConversations(prev =>
        prev.map(conv =>
          conv.id === activeConversationId
            ? { ...conv, messages: [...conv.messages, assistantMessage] }
            : conv
        )
      );

    try {
      const stream = await chatServiceRef.current.sendMessage(text);
      let fullResponse = '';
      let lastChunk: GenerateContentResponse | null = null;
      for await (const chunk of stream) {
        fullResponse += chunk.text;
        lastChunk = chunk;
        setConversations(prev =>
          prev.map(conv => {
            if (conv.id === activeConversationId) {
              const updatedMessages = conv.messages.map(msg =>
                msg.id === assistantMessageId ? { ...msg, text: fullResponse } : msg
              );
              return { ...conv, messages: updatedMessages };
            }
            return conv;
          })
        );
      }

      // Sources are now provided directly from the OpenAI service via Brave Search
      const sources: Source[] = lastChunk?.sources ?? [];

        setConversations(prev =>
            prev.map(conv => {
              if (conv.id === activeConversationId) {
                const updatedMessages = conv.messages.map(msg =>
                  msg.id === assistantMessageId ? { ...msg, text: fullResponse, sources } : msg
                );
                return { ...conv, messages: updatedMessages };
              }
              return conv;
            })
          );


    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Error generating response: ${errorMessage}`);
      setConversations(prev =>
        prev.map(conv => {
          if (conv.id === activeConversationId) {
            const updatedMessages = conv.messages.map(msg =>
              msg.id === assistantMessageId ? { ...msg, text: `Error: Could not get response. ${errorMessage}` } : msg
            );
            return { ...conv, messages: updatedMessages };
          }
          return conv;
        })
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  const activeConversation = conversations.find(c => c.id === activeConversationId);

  return (
    <div className="flex h-screen font-sans text-slate-800">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
      />
      <main className="flex-1 flex flex-col bg-white">
        {activeConversation ? (
          <ChatWindow
            conversation={activeConversation}
            isLoading={isLoading}
            error={error}
            onSendMessage={handleSendMessage}
            onFeedback={handleFeedback}
            showTokenWarning={showTokenWarning}
            remainingTokens={remainingTokens}
            onDismissTokenWarning={() => setShowTokenWarning(false)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <p>Select a conversation or start a new one.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;