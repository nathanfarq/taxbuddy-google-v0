import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { SYSTEM_INSTRUCTIONS } from '../constants';

// This is a standalone helper to avoid initializing the class for a one-off call.
const getAiInstance = () => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Generates a concise title for a new conversation based on the user's first message.
 * @param inquiryText The user's initial question.
 * @returns A promise that resolves to a short, descriptive title.
 */
export const classifyInquiry = async (inquiryText: string): Promise<string> => {
    try {
        const ai = getAiInstance();
        const prompt = `Summarize the following inquiry into a concise, 3-5 word title. Do not add quotes or any other formatting. Inquiry: "${inquiryText}"`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { temperature: 0 }, // We want a deterministic title
        });
        
        // Clean up the response, remove potential quotes and newlines
        return response.text.trim().replace(/^"|"$/g, '');

    } catch (error) {
        console.error('Error classifying inquiry:', error);
        return 'Tax Inquiry'; // Fallback title
    }
};


export class TaxResearchChat {
  private chat: Chat;

  constructor() {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    this.chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: SYSTEM_INSTRUCTIONS,
            temperature: 0.1,
            maxOutputTokens: 2048,
            topP: 0.8,
            topK: 40,
            // Reserve a portion of the token budget for the final output
            // to prevent incomplete responses on complex queries.
            thinkingConfig: { thinkingBudget: 1024 },
            // Force the model to use web search for grounding its responses.
            tools: [{googleSearch: {}}],
        },
    });
  }

  async *sendMessage(message: string): AsyncGenerator<GenerateContentResponse, void, undefined> {
    const result = await this.chat.sendMessageStream({ message });
    for await (const chunk of result) {
      yield chunk;
    }
  }
}