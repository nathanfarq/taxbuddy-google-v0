import { Source } from '../types';

interface BraveSearchResult {
    title: string;
    url: string;
    description: string;
    date?: string;
}

interface BraveSearchResponse {
    web?: {
        results: BraveSearchResult[];
    };
}

/**
 * Searches the web using Brave Search API for tax-related queries
 * @param query The search query string
 * @param count Number of results to return (default: 10)
 * @returns Promise resolving to array of Sources with search results
 */
export const searchWeb = async (query: string, count: number = 10): Promise<Source[]> => {
    if (!process.env.BRAVE_SEARCH_API_KEY) {
        throw new Error("BRAVE_SEARCH_API_KEY environment variable not set.");
    }

    try {
        const searchQuery = encodeURIComponent(`${query} Canadian tax law site:canada.ca OR site:cra-arc.gc.ca OR site:canlii.org`);
        const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${searchQuery}&count=${count}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
        }

        const data: BraveSearchResponse = await response.json();
        
        // Convert Brave Search results to Source format
        if (!data.web?.results) {
            return [];
        }

        return data.web.results.map(result => ({
            uri: result.url,
            title: result.title
        }));

    } catch (error) {
        console.error('Error searching with Brave Search:', error);
        // Return empty array on error to gracefully handle search failures
        return [];
    }
};

/**
 * Enhanced search function that combines general query with tax-specific terms
 * @param query The user's original query
 * @param count Number of results to return (default: 8)
 * @returns Promise resolving to array of Sources
 */
export const searchTaxResources = async (query: string, count: number = 8): Promise<Source[]> => {
    // Enhance query with tax-specific context for better results
    const enhancedQuery = `${query} income tax act CRA Canada Revenue Agency`;
    return searchWeb(enhancedQuery, count);
};