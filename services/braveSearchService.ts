import { Source } from '../types';
import { normalizeUrl, isValidUrlFormat, extractDomain, getStandardHeaders, getDomainReliabilityScore } from '../utils/urlUtils';

/**
 * Validates a URL by making a HEAD request to check accessibility
 * @param url The URL to validate
 * @returns Promise resolving to validation result with final URL
 */
/**
 * Enhanced URL verification with content analysis
 * @param url The URL to verify
 * @returns Promise resolving to verification result
 */
export const verifySourceUrl = async (url: string): Promise<{
    isValid: boolean;
    finalUrl: string;
    domain: string;
    status: VerificationStatus;
    contentType?: string;
    title?: string;
}> => {
    try {
        // Normalize and validate URL format first
        if (!isValidUrlFormat(url)) {
            throw new Error(`Invalid URL format: ${url}`);
        }

        const normalizedUrl = normalizeUrl(url);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout

        // Use proper headers to avoid bot blocking
        const headers = getStandardHeaders();

        // First check with HEAD request
        const headResponse = await fetch(normalizedUrl, {
            method: 'HEAD',
            headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Handle redirects and various response codes
        let finalUrl = headResponse.url || normalizedUrl;
        let isValid = headResponse.ok;

        // Some sites block HEAD requests but allow GET - try fallback if HEAD fails
        if (!headResponse.ok && (headResponse.status === 405 || headResponse.status === 403)) {
            console.log(`HEAD request failed for ${normalizedUrl}, trying GET request...`);

            try {
                const controller2 = new AbortController();
                const timeoutId2 = setTimeout(() => controller2.abort(), 8000);

                const getResponse = await fetch(normalizedUrl, {
                    method: 'GET',
                    headers: {
                        ...headers,
                        'Range': 'bytes=0-1024' // Only fetch first 1KB to check if accessible
                    },
                    signal: controller2.signal
                });

                clearTimeout(timeoutId2);

                if (getResponse.ok) {
                    finalUrl = getResponse.url || normalizedUrl;
                    isValid = true;
                }
            } catch {
                // GET also failed, keep original status
            }
        }

        if (!isValid) {
            throw new Error(`HTTP ${headResponse.status}: ${headResponse.statusText}`);
        }

        const domain = extractDomain(finalUrl);
        const contentType = headResponse.headers.get('content-type') || '';

        // Get title for HTML content with improved error handling
        let title = '';
        if (contentType.includes('text/html')) {
            try {
                const controller3 = new AbortController();
                const timeoutId3 = setTimeout(() => controller3.abort(), 5000);

                const getResponse = await fetch(finalUrl, {
                    method: 'GET',
                    headers: {
                        ...headers,
                        'Range': 'bytes=0-4096' // Only fetch first 4KB for title extraction
                    },
                    signal: controller3.signal
                });

                clearTimeout(timeoutId3);

                if (getResponse.ok) {
                    const html = await getResponse.text();
                    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                    title = titleMatch ? titleMatch[1].trim().substring(0, 200) : ''; // Limit title length
                }
            } catch (titleError) {
                console.log(`Title extraction failed for ${finalUrl}:`, titleError);
                // Continue without title - this is not a critical failure
            }
        }

        // Final validation - ensure URL is still accessible
        const finalNormalizedUrl = normalizeUrl(finalUrl);

        return {
            isValid: true,
            finalUrl: finalNormalizedUrl,
            domain,
            status: VerificationStatus.VERIFIED,
            contentType,
            title
        };

    } catch (error) {
        console.warn(`URL verification failed for ${url}:`, {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        });

        const domain = extractDomain(url);

        return {
            isValid: false,
            finalUrl: normalizeUrl(url), // Still normalize even if failed
            domain,
            status: VerificationStatus.FAILED
        };
    }
};

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
 * Enhanced Source interface used internally for processing with additional metadata
 * Maps to the base Source interface for external consumption
 */
interface EnhancedSource extends Source {
    url: string;           // Original URL from search result (maps to uri for compatibility)
    description: string;   // Search result description
    domain: string;        // Extracted domain name
    isValidated: boolean;  // Whether the URL has been validated
}

/**
 * Maps a BraveSearchResult to an EnhancedSource object with enhanced title formatting
 * @param result BraveSearchResult from Brave Search API
 * @returns EnhancedSource object with mapped properties
 */
const mapBraveResultToEnhancedSource = (result: BraveSearchResult): EnhancedSource => {
    // Normalize the URL first and extract domain safely
    const normalizedUrl = normalizeUrl(result.url);
    const domain = extractDomain(normalizedUrl);

    // Clean and enhance the title for better citation display
    let enhancedTitle = result.title.trim();

    // Remove common title suffixes that don't add value for citations
    const suffixesToRemove = [
        / - Canada\.ca$/,
        / \| Canada Revenue Agency$/,
        / - CRA$/,
        / \| CRA$/,
        / - Government of Canada$/,
        / \| Government of Canada$/,
        / - Canada$/
    ];

    suffixesToRemove.forEach(suffix => {
        enhancedTitle = enhancedTitle.replace(suffix, '');
    });

    // Ensure title is not empty after cleaning
    if (!enhancedTitle || enhancedTitle.length < 3) {
        enhancedTitle = result.title; // Fall back to original
    }

    // Limit title length for better UI display (while keeping meaningful content)
    if (enhancedTitle.length > 100) {
        enhancedTitle = enhancedTitle.substring(0, 97) + '...';
    }

    return {
        uri: normalizedUrl,       // Source interface requirement: use normalized url as uri
        title: enhancedTitle,     // Enhanced title for better citation display
        url: normalizedUrl,       // Enhanced property: use normalized url for processing
        description: result.description, // Enhanced property: search description
        domain,                   // Enhanced property: extracted domain
        isValidated: false        // Enhanced property: validation status (set by validation functions)
    };
};

/**
 * Converts an EnhancedSource back to a standard Source object
 * @param enhancedSource EnhancedSource object with additional properties
 * @returns Source object conforming to the base interface
 */
const mapEnhancedSourceToSource = (enhancedSource: EnhancedSource): Source => {
    return {
        uri: enhancedSource.uri,     // Use the validated/final URI
        title: enhancedSource.title  // Keep the title
    };
};

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
        const searchQuery = encodeURIComponent(query);
        const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${searchQuery}&count=${count}&country=CA`, {
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
        
        // Convert Brave Search results to Source format with validation
        if (!data.web?.results) {
            return [];
        }

        // Process results with validation and proper mapping
        const sourcePromises = data.web.results.map(async (result) => {
            try {
                // Map BraveSearchResult to EnhancedSource
                const enhancedSource = mapBraveResultToEnhancedSource(result);

                // Validate the URL
                const validation = await verifySourceUrl(result.url);

                // Update enhanced source with validation results
                enhancedSource.uri = validation.finalUrl; // Use validated URL as the final uri
                enhancedSource.isValidated = validation.isValid;
                enhancedSource.domain = validation.domain;

                // Convert back to standard Source interface for return
                return mapEnhancedSourceToSource(enhancedSource);
            } catch (error) {
                console.warn(`Failed to process source ${result.title}:`, error);
                // Fallback: create enhanced source without validation, then convert to Source
                const enhancedSource = mapBraveResultToEnhancedSource(result);
                return mapEnhancedSourceToSource(enhancedSource);
            }
        });

        const sources = await Promise.allSettled(sourcePromises);
        return sources
            .filter(result => result.status === 'fulfilled')
            .map(result => (result as PromiseFulfilledResult<Source>).value);

    } catch (error) {
        console.error('Error searching with Brave Search:', error);
        // Return empty array on error to gracefully handle search failures
        return [];
    }
};

/**
 * Verification status for sources
 */
enum VerificationStatus {
    VERIFIED = 'verified',
    PARTIAL = 'partial',
    FAILED = 'failed',
    PENDING = 'pending'
}

/**
 * Uses AI to generate targeted search queries for specific content
 * @param query The user's original query
 * @returns Promise resolving to search strategies
 */
const generateTargetedSearchQueries = async (query: string): Promise<string[]> => {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'system',
                    content: 'You are a search specialist. Generate 3 highly specific search queries designed to find exact pages containing detailed information about the tax question. Focus on finding specific documents, guides, forms, or detailed explanations rather than general website homepages. Make queries specific enough to search further than general landing pages.'
                }, {
                    role: 'user',
                    content: `Find specific content pages for: ${query}`
                }],
                temperature: 0.2,
                max_tokens: 250
            })
        });

        if (response.ok) {
            const data = await response.json();
            const searchQueries = data.choices[0].message.content
                .split('\n')
                .filter((q: string) => q.trim().length > 0)
                .map((q: string) => q.replace(/^\d+\.?\s*/, '').trim());

            return searchQueries.slice(0, 3);
        }
    } catch (error) {
        console.warn('AI query generation failed, using fallback:', error);
    }

    // Fallback: more specific search terms
    return [
        `"${query}" specific guide document`,
        `${query} detailed explanation instructions`,
        `${query} form requirements process`,
        `${query} specific rules regulations`
    ];
};


/**
 * Extracts and analyzes content from a URL
 * @param url The URL to extract content from
 * @returns Promise resolving to extracted content analysis
 */
const extractAndAnalyzeContent = async (url: string): Promise<{
    content: string;
    wordCount: number;
    isSpecific: boolean;
    contentQuality: number;
}> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        // Extract text content from HTML
        const textContent = html
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<style[^>]*>.*?<\/style>/gi, '')
            .replace(/<nav[^>]*>.*?<\/nav>/gi, '')
            .replace(/<header[^>]*>.*?<\/header>/gi, '')
            .replace(/<footer[^>]*>.*?<\/footer>/gi, '')
            .replace(/<aside[^>]*>.*?<\/aside>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const wordCount = textContent.split(/\s+/).length;

        // Basic content quality assessment
        const isSpecific = !textContent.toLowerCase().includes('coming soon') &&
                          !textContent.toLowerCase().includes('under construction') &&
                          wordCount > 50;

        const contentQuality = Math.min(100, Math.max(0,
            (wordCount / 50) +
            (isSpecific ? 20 : 0)
        ));

        return {
            content: textContent.substring(0, 2000), // Limit content length
            wordCount,
            isSpecific,
            contentQuality
        };

    } catch (error) {
        console.warn(`Content extraction failed for ${url}:`, error);
        return {
            content: '',
            wordCount: 0,
            isSpecific: false,
            contentQuality: 0
        };
    }
};

/**
 * Verifies content matches potential claims using AI
 * @param content Extracted page content
 * @param query Original user query
 * @param title Page title
 * @returns Promise resolving to verification score
 */
const verifyContentClaims = async (content: string, query: string, title: string): Promise<number> => {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'system',
                    content: 'Evaluate if this page content contains specific information that would answer the user\'s tax question. Rate the relevance and specificity on a scale of 0-100. Consider: Does it contain specific details? Is it directly relevant? Does it provide actionable information?'
                }, {
                    role: 'user',
                    content: `Query: "${query}"\nPage Title: "${title}"\nContent: ${content.substring(0, 1500)}`
                }],
                temperature: 0.1,
                max_tokens: 10
            })
        });

        if (response.ok) {
            const data = await response.json();
            const score = parseInt(data.choices[0].message.content.trim());
            return isNaN(score) ? 50 : Math.max(0, Math.min(100, score));
        }
    } catch (error) {
        console.warn('Content-claim verification failed:', error);
    }

    return 50;
};

/**
 * Verifies source authority and credibility using AI
 * @param url Source URL
 * @param title Source title
 * @param content Source content
 * @returns Promise resolving to authority score
 */
const verifySourceAuthority = async (url: string, title: string, content: string): Promise<number> => {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'system',
                    content: 'Evaluate the authority and credibility of this source for tax information. Rate 0-100 based on: Is it from a reputable organization? Does it provide accurate, well-researched information? Is the content professional and current? Consider government sources, professional firms, educational institutions, and reputable publications equally.'
                }, {
                    role: 'user',
                    content: `URL: ${url}\nTitle: "${title}"\nContent Preview: ${content.substring(0, 800)}`
                }],
                temperature: 0.1,
                max_tokens: 10
            })
        });

        if (response.ok) {
            const data = await response.json();
            const score = parseInt(data.choices[0].message.content.trim());
            return isNaN(score) ? 50 : Math.max(0, Math.min(100, score));
        }
    } catch (error) {
        console.warn('Source authority verification failed:', error);
    }

    // Fallback: more balanced domain-based authority scoring
    const domain = new URL(url).hostname.toLowerCase();
    if (domain.includes('canada.ca') || domain.includes('cra-arc.gc.ca')) return 80;
    if (domain.includes('.gov.') || domain.includes('canlii.org')) return 75;
    if (domain.includes('cpacanada.ca')) return 70;
    if (domain.includes('kpmg.') || domain.includes('pwc.') || domain.includes('deloitte.') || domain.includes('ey.')) return 65;
    if (domain.includes('.edu')) return 60;
    if (domain.includes('taxplanningguide.') || domain.includes('taxtips.')) return 55;
    return 50;
};

/**
 * Enhanced search function with AI-driven query optimization and source prioritization
 * @param query The user's original query
 * @param count Number of results to return (default: 8)
 * @returns Promise resolving to array of Sources prioritized by authority
 */
export const searchTaxResources = async (query: string, count: number = 8): Promise<Source[]> => {
    console.log('Starting AI-first search with full verification...');

    // Step 1: Generate targeted search queries
    const searchQueries = await generateTargetedSearchQueries(query);
    console.log('Generated search queries:', searchQueries);

    const verifiedSources: EnhancedSource[] = [];
    const seenUrls = new Set<string>();

    // Step 2: Execute searches and verify results
    for (const searchQuery of searchQueries) {
        try {
            // Get search results as standard Sources, then convert to EnhancedSources for processing
            const searchResults = await searchWeb(searchQuery, Math.ceil(count / 2));

            for (const searchResult of searchResults) {
                // Convert Source back to EnhancedSource for internal processing
                // Note: searchWeb already validates URLs, so we create EnhancedSource with basic info
                const enhancedSource: EnhancedSource = {
                    uri: searchResult.uri,
                    title: searchResult.title,
                    url: searchResult.uri,  // Use uri as url since searchWeb validates it
                    description: '',        // Description not available from basic Source
                    domain: (() => {
                        try {
                            return new URL(searchResult.uri).hostname;
                        } catch {
                            return 'unknown';
                        }
                    })(),
                    isValidated: true       // Already validated by searchWeb
                };

                if (seenUrls.has(enhancedSource.url) || verifiedSources.length >= count) {
                    continue;
                }

                seenUrls.add(enhancedSource.url);

                // Step 3: Multi-layer verification
                console.log(`Verifying source: ${enhancedSource.title}`);

                // Layer 1: URL Verification (re-verify for enhanced analysis)
                const urlVerification = await verifySourceUrl(enhancedSource.url);
                if (!urlVerification.isValid) {
                    console.log(`URL verification failed for: ${enhancedSource.url}`);
                    continue;
                }

                // Update enhanced source with fresh verification data
                enhancedSource.uri = urlVerification.finalUrl;
                enhancedSource.url = urlVerification.finalUrl;
                enhancedSource.domain = urlVerification.domain;

                // Layer 2: Content Extraction & Analysis
                const contentAnalysis = await extractAndAnalyzeContent(urlVerification.finalUrl);
                if (!contentAnalysis.isSpecific || contentAnalysis.contentQuality < 20) {
                    console.log(`Content quality check failed for: ${enhancedSource.title}`);
                    continue;
                }

                // Layer 3: Content-Claim Verification
                const claimScore = await verifyContentClaims(
                    contentAnalysis.content,
                    query,
                    enhancedSource.title
                );

                // Layer 4: Source Authority Verification
                const authorityScore = await verifySourceAuthority(
                    urlVerification.finalUrl,
                    enhancedSource.title,
                    contentAnalysis.content
                );

                // Calculate overall verification score
                const overallScore = Math.round(
                    (claimScore * 0.4) + (authorityScore * 0.2) + (contentAnalysis.contentQuality * 0.4)
                );

                // Only include sources that pass minimum thresholds
                if (claimScore >= 20 && authorityScore >= 10 && overallScore >= 40) {
                    // Update description with verification score for sorting
                    enhancedSource.description = `[Verified: ${overallScore}%]`;
                    verifiedSources.push(enhancedSource);

                    console.log(`Verified source: ${enhancedSource.title} (Score: ${overallScore}%)`);
                } else {
                    console.log(`Source failed verification: ${enhancedSource.title} (Claim: ${claimScore}, Authority: ${authorityScore}, Overall: ${overallScore})`);
                }
            }
        } catch (error) {
            console.warn(`Search strategy failed:`, error);
        }
    }

    // Sort by verification score (highest first) and convert back to Source interface
    return verifiedSources
        .sort((a, b) => {
            const aScore = parseInt(a.description?.match(/Verified: (\d+)%/)?.[1] || '0');
            const bScore = parseInt(b.description?.match(/Verified: (\d+)%/)?.[1] || '0');
            return bScore - aScore;
        })
        .slice(0, count)
        .map(mapEnhancedSourceToSource); // Convert back to Source interface for return
};