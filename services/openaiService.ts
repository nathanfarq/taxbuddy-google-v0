import OpenAI from 'openai';
import { SYSTEM_INSTRUCTIONS } from '../constants';
import { searchTaxResources } from './braveSearchService';
import { Source } from '../types';

// Helper to create OpenAI instance
const getOpenAIInstance = () => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY environment variable not set.");
    }
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        dangerouslyAllowBrowser: true // Needed for client-side usage
    });
};

/**
 * Generates a concise title for a new conversation based on the user's first message.
 * @param inquiryText The user's initial question.
 * @returns A promise that resolves to a short, descriptive title.
 */
export const classifyInquiry = async (inquiryText: string): Promise<string> => {
    try {
        const openai = getOpenAIInstance();
        const prompt = `Summarize the following inquiry into a concise, 3-5 word title. Do not add quotes or any other formatting. Inquiry: "${inquiryText}"`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            max_tokens: 20
        });
        
        // Clean up the response, remove potential quotes and newlines
        return response.choices[0]?.message?.content?.trim().replace(/^"|"$/g, '') || 'Tax Inquiry';

    } catch (error) {
        console.error('Error classifying inquiry:', error);
        return 'Tax Inquiry'; // Fallback title
    }
};

// Interface to match the original Gemini response structure
export interface GenerateContentResponse {
    text: string;
    sources?: Source[];
}

export class TaxResearchChat {
    private openai: OpenAI;
    private conversationHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY environment variable not set.");
        }
        this.openai = getOpenAIInstance();
        
        // Initialize with system message
        this.conversationHistory.push({
            role: 'system',
            content: SYSTEM_INSTRUCTIONS
        });
    }

    async *sendMessage(message: string): AsyncGenerator<GenerateContentResponse, void, undefined> {
        try {
            // First, search for relevant sources
            const searchSources = await searchTaxResources(message);
            
            // Create context from search results for the AI
            let searchContext = '';
            if (searchSources.length > 0) {
                searchContext = '\n\nRelevant search results found:\n' + 
                    searchSources.map(source => `- ${source.title}: ${source.uri}`).join('\n') +
                    '\n\nUse these sources to provide accurate, cited information in your response.';
            }

            // Add user message with search context
            this.conversationHistory.push({
                role: 'user',
                content: message + searchContext
            });

            // Create streaming response
            const stream = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: this.conversationHistory,
                temperature: 0.1,
                max_tokens: 2048,
                top_p: 0.8,
                stream: true
            });

            let fullResponse = '';
            
            // Stream the response
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                fullResponse += content;
                
                yield {
                    text: content,
                    sources: searchSources
                };
            }

            // Add the complete assistant response to conversation history
            this.conversationHistory.push({
                role: 'assistant',
                content: fullResponse
            });

        } catch (error) {
            console.error('Error sending message:', error);
            yield {
                text: 'I apologize, but I encountered an error while processing your request. Please try again.',
                sources: []
            };
        }
    }
}