import OpenAI from 'openai';
import { SYSTEM_INSTRUCTIONS } from '../constants';
import { searchTaxResources } from './braveSearchService';
import { Source } from '../types';
import { validateCitations, generateCitationExamples, hasCompleteCitations } from '../utils/citationValidator';

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

    /**
     * Searches for relevant sources with comprehensive retry logic and fallback strategies
     * @param message The user's message to search for
     * @returns Promise resolving to array of sources
     */
    private async searchWithRetry(message: string): Promise<Source[]> {
        try {
            // First attempt: Use the enhanced searchTaxResources
            console.log('Attempting enhanced tax search...');
            let sources = await searchTaxResources(message, 8);

            // Second attempt: Direct web search if enhanced search returns few results
            if (sources.length < 3) {
                console.log('Enhanced search returned limited results, trying direct web search...');
                const { searchWeb } = await import('./braveSearchService');
                const webSources = await searchWeb(message, 4);

                // Combine and deduplicate sources
                const combinedSources = [...sources];
                const existingUrls = new Set(sources.map(s => s.uri));

                webSources.forEach(source => {
                    if (!existingUrls.has(source.uri)) {
                        combinedSources.push(source);
                        existingUrls.add(source.uri);
                    }
                });

                sources = combinedSources;
            }

            // Third attempt: Try with simplified query if still limited results
            if (sources.length < 2) {
                console.log('Still limited results, trying simplified query...');
                const simplifiedQuery = this.simplifyQuery(message);
                if (simplifiedQuery !== message && simplifiedQuery.length > 0) {
                    const { searchWeb } = await import('./braveSearchService');
                    const simplifiedSources = await searchWeb(simplifiedQuery, 4);

                    // Add unique sources from simplified search
                    const existingUrls = new Set(sources.map(s => s.uri));
                    simplifiedSources.forEach(source => {
                        if (!existingUrls.has(source.uri)) {
                            sources.push(source);
                            existingUrls.add(source.uri);
                        }
                    });
                }
            }

            // Final attempt: Try broader search terms if still no results
            if (sources.length === 0) {
                console.log('No sources found, trying broader search terms...');
                const broaderTerms = this.generateBroaderSearchTerms(message);
                const { searchWeb } = await import('./braveSearchService');

                for (const term of broaderTerms) {
                    const broadSources = await searchWeb(term, 4);
                    if (broadSources.length > 0) {
                        sources.push(...broadSources);
                        break; // Use first successful broader search
                    }
                }
            }

            console.log(`Search completed: ${sources.length} sources found for query: "${message.substring(0, 100)}..."`);
            return sources;

        } catch (error) {
            console.error('Search failed with error:', {
                error: error instanceof Error ? error.message : String(error),
                query: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                timestamp: new Date().toISOString()
            });
            // Even on error, try one final basic search attempt
            try {
                const { searchWeb } = await import('./braveSearchService');
                return await searchWeb(message.split(' ').slice(0, 3).join(' '), 3);
            } catch {
                return []; // Final fallback
            }
        }
    }

    /**
     * Simplifies a query by extracting key terms for fallback search
     * @param query The original query
     * @returns Simplified query string
     */
    private simplifyQuery(query: string): string {
        // Remove common question words and extract key terms
        const stopWords = ['what', 'how', 'when', 'where', 'why', 'who', 'is', 'are', 'can', 'do', 'does', 'the', 'a', 'an'];
        const words = query.toLowerCase().split(/\s+/)
            .filter(word => !stopWords.includes(word) && word.length > 2);

        return words.slice(0, 3).join(' '); // Take first 3 meaningful words
    }

    /**
     * Generates broader search terms for difficult queries
     * @param query The original query
     * @returns Array of broader search terms to try
     */
    private generateBroaderSearchTerms(query: string): string[] {
        const lowerQuery = query.toLowerCase();
        const broaderTerms: string[] = [];

        // Tax-related broader terms
        if (lowerQuery.includes('tax') || lowerQuery.includes('income') || lowerQuery.includes('deduction')) {
            broaderTerms.push('Canada tax information', 'Canadian tax rules', 'income tax Canada');
        }

        // Business-related broader terms
        if (lowerQuery.includes('business') || lowerQuery.includes('corporation') || lowerQuery.includes('company')) {
            broaderTerms.push('business tax Canada', 'corporate tax rules', 'business deductions');
        }

        // General fallback terms
        broaderTerms.push(
            'Canadian tax guide',
            'tax information Canada',
            'CRA tax rules',
            'tax planning Canada'
        );

        return broaderTerms.slice(0, 3); // Limit to 3 broader terms
    }

    async *sendMessage(message: string): AsyncGenerator<GenerateContentResponse, void, undefined> {
        try {
            // First, search for relevant sources with retry logic
            let searchSources = await this.searchWithRetry(message);

            // Create context from search results for the AI
            let searchContext = '';
            if (searchSources.length > 0) {
                const citationExamples = generateCitationExamples(searchSources);
                searchContext = '\n\nRelevant search results found:\n' +
                    searchSources.map(source => `- ${source.title}: ${source.uri}`).join('\n') +
                    '\n\n' + citationExamples +
                    '\n\nCRITICAL: You MUST use inline citations [Source Title](URL) immediately after every factual statement. Minimum 2 citations required when multiple sources are available. Responses without proper citations are invalid. Use ONLY the URLs provided above.';
            } else {
                searchContext = '\n\nNote: Limited search results were found for this specific query. You may provide helpful general information while clearly noting that specific current sources could not be retrieved. Always attempt to be helpful while acknowledging source limitations.';
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
            let chunkBuffer = '';
            let hasWarnedAboutCitations = false;

            // Stream the response with citation monitoring
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                fullResponse += content;
                chunkBuffer += content;

                // Monitor for citation patterns during streaming (every ~100 characters)
                if (chunkBuffer.length > 100 && searchSources.length > 0 && !hasWarnedAboutCitations) {
                    const seemsFactual = /\b(according to|based on|shows that|indicates that|reports that|states that|found that|CRA|tax law|regulation|legislation|deduction|income|the act)\b/i.test(chunkBuffer);
                    const hasCitations = hasCompleteCitations(chunkBuffer);

                    if (seemsFactual && !hasCitations && chunkBuffer.length > 200) {
                        console.warn('Streaming response contains factual claims without citations:', {
                            responsePreview: chunkBuffer.substring(0, 150) + '...',
                            availableSources: searchSources.length,
                            timestamp: new Date().toISOString()
                        });
                        hasWarnedAboutCitations = true;
                    }
                }

                yield {
                    text: content,
                    sources: searchSources
                };
            }

            // Validate final response for citation compliance
            if (fullResponse.trim()) {
                const validation = validateCitations(fullResponse, searchSources);

                // Log citation compliance for monitoring
                console.log('Citation validation:', {
                    isValid: validation.isValid,
                    citationCount: validation.citationCount,
                    sourceCount: validation.sourceCount,
                    availableSources: searchSources.length,
                    issues: validation.issues,
                    message: message.substring(0, 100) + '...',
                    timestamp: new Date().toISOString()
                });

                // If validation fails and sources were available, log warning
                if (!validation.isValid && searchSources.length > 0) {
                    console.warn('Citation compliance failure:', {
                        issues: validation.issues,
                        response: fullResponse.substring(0, 200) + '...',
                        availableSources: searchSources.map(s => ({ title: s.title, uri: s.uri }))
                    });
                }
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