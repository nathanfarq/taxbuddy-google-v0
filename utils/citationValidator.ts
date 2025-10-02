import { Source } from '../types';

export interface CitationMatch {
    text: string;
    title: string;
    url: string;
    startIndex: number;
    endIndex: number;
}

export interface CitationValidationResult {
    isValid: boolean;
    citationCount: number;
    sourceCount: number;
    extractedCitations: CitationMatch[];
    missingSourcesCount: number;
    issues: string[];
}

/**
 * Extracts all inline citations from response text in the format [Source Title](URL)
 * @param responseText The AI response text to parse
 * @returns Array of citation matches found in the text
 */
export const extractInlineCitations = (responseText: string): CitationMatch[] => {
    // Regex to match [Source Title](URL) format
    const citationRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const citations: CitationMatch[] = [];

    let match;
    while ((match = citationRegex.exec(responseText)) !== null) {
        citations.push({
            text: match[0],
            title: match[1].trim(),
            url: match[2].trim(),
            startIndex: match.index,
            endIndex: match.index + match[0].length
        });
    }

    return citations;
};

/**
 * Validates that citations in response text properly reference provided sources
 * @param responseText The AI response text to validate
 * @param availableSources Array of sources that were provided to the AI
 * @param minCitationsRequired Minimum number of citations required (default: 2)
 * @returns Validation result with detailed analysis
 */
export const validateCitations = (
    responseText: string,
    availableSources: Source[],
    minCitationsRequired: number = 2
): CitationValidationResult => {
    const extractedCitations = extractInlineCitations(responseText);
    const issues: string[] = [];

    // Count unique citations and sources
    const uniqueCitationUrls = new Set(extractedCitations.map(c => c.url));
    const citationCount = extractedCitations.length;
    const sourceCount = uniqueCitationUrls.size;

    // Check minimum citation requirement
    if (availableSources.length > 1 && citationCount < minCitationsRequired) {
        issues.push(`Insufficient citations: found ${citationCount}, required minimum ${minCitationsRequired} when multiple sources available`);
    }

    // Check if response contains factual content but no citations
    const hasFactualContent = /\b(according to|based on|shows that|indicates that|reports that|states that|found that|CRA|tax|deduction|income|legislation)\b/i.test(responseText);
    if (hasFactualContent && citationCount === 0) {
        issues.push('Response contains factual claims but no citations provided');
    }

    // Enhanced URL validation - check for AI URL modification
    const availableUrls = new Set(availableSources.map(s => s.uri));
    const normalizedAvailableUrls = new Set(availableSources.map(s => normalizeUrlForComparison(s.uri)));

    const invalidCitations = extractedCitations.filter(citation => {
        const normalizedCitationUrl = normalizeUrlForComparison(citation.url);
        return !availableUrls.has(citation.url) && !normalizedAvailableUrls.has(normalizedCitationUrl);
    });

    if (invalidCitations.length > 0) {
        issues.push(`${invalidCitations.length} citations reference URLs not in provided sources`);

        // Log details for debugging AI URL modification
        invalidCitations.forEach(citation => {
            console.warn('Invalid citation detected:', {
                citedUrl: citation.url,
                title: citation.title,
                availableUrls: availableSources.map(s => s.uri),
                possibleModification: detectUrlModification(citation.url, availableSources)
            });
        });
    }

    // Check for proper paragraph distribution of citations
    const paragraphs = responseText.split('\n\n').filter(p => p.trim().length > 0);
    const paragraphsWithFacts = paragraphs.filter(p =>
        /\b(according to|based on|shows that|indicates that|reports that|states that|found that|CRA|tax|deduction|income|legislation)\b/i.test(p)
    );
    const paragraphsWithCitations = paragraphs.filter(p =>
        /\[([^\]]+)\]\(([^)]+)\)/.test(p)
    );

    if (paragraphsWithFacts.length > 0 && paragraphsWithCitations.length === 0) {
        issues.push('Factual paragraphs exist but no paragraphs contain citations');
    }

    // Calculate missing sources
    const citedSourceCount = extractedCitations.filter(citation =>
        availableUrls.has(citation.url)
    ).length;
    const missingSourcesCount = Math.max(0, availableSources.length - new Set(
        extractedCitations
            .filter(c => availableUrls.has(c.url))
            .map(c => c.url)
    ).size);

    // Determine overall validity
    const isValid = issues.length === 0 &&
                   (availableSources.length === 0 || citationCount >= Math.min(minCitationsRequired, availableSources.length));

    return {
        isValid,
        citationCount,
        sourceCount,
        extractedCitations,
        missingSourcesCount,
        issues
    };
};

/**
 * Checks if a response chunk contains complete citations (useful for streaming validation)
 * @param chunk The response chunk to check
 * @returns True if chunk contains complete citation patterns
 */
export const hasCompleteCitations = (chunk: string): boolean => {
    // Check for complete citation patterns
    const completeCitations = /\[([^\]]+)\]\(([^)]+)\)/g.test(chunk);

    // Check for incomplete patterns that might be streaming
    const incompleteCitations = /\[([^\]]*$|\[[^\]]*$)/g.test(chunk);

    return completeCitations && !incompleteCitations;
};

/**
 * Generates citation format examples for AI context
 * @param sources Available sources to reference
 * @returns Formatted citation examples string
 */
export const generateCitationExamples = (sources: Source[]): string => {
    if (sources.length === 0) {
        return 'Note: No sources available for citation.';
    }

    const examples = sources.slice(0, 3).map((source, index) => {
        const exampleClaims = [
            'According to the information',
            'The regulations specify',
            'Recent guidance indicates'
        ];
        return `${exampleClaims[index]} [${source.title}](${source.uri})`;
    }).join('\n');

    return `CITATION FORMAT EXAMPLES:\n${examples}\n\nREQUIRED: Use this exact format [Source Title](URL) immediately after factual statements.`;
};

/**
 * Normalizes a URL for comparison purposes (removes minor variations)
 * @param url The URL to normalize
 * @returns Normalized URL string for comparison
 */
const normalizeUrlForComparison = (url: string): string => {
    try {
        const urlObj = new URL(url);

        // Remove trailing slash
        if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
            urlObj.pathname = urlObj.pathname.slice(0, -1);
        }

        // Remove www prefix for comparison
        if (urlObj.hostname.startsWith('www.')) {
            urlObj.hostname = urlObj.hostname.substring(4);
        }

        // Sort search parameters for consistent comparison
        const sortedParams = Array.from(urlObj.searchParams.entries()).sort();
        urlObj.search = new URLSearchParams(sortedParams).toString();

        // Remove fragment
        urlObj.hash = '';

        return urlObj.toString().toLowerCase();
    } catch {
        return url.toLowerCase();
    }
};

/**
 * Detects if AI might have modified a URL and suggests the closest match
 * @param citedUrl The URL cited by the AI
 * @param availableSources Available sources to match against
 * @returns Analysis of potential URL modification
 */
const detectUrlModification = (citedUrl: string, availableSources: Source[]): {
    isLikelyModified: boolean;
    closestMatch?: string;
    similarity?: number;
} => {
    const normalizedCited = normalizeUrlForComparison(citedUrl);

    let closestMatch: string | undefined;
    let highestSimilarity = 0;

    availableSources.forEach(source => {
        const normalizedSource = normalizeUrlForComparison(source.uri);
        const similarity = calculateStringSimilarity(normalizedCited, normalizedSource);

        if (similarity > highestSimilarity && similarity > 0.7) {
            highestSimilarity = similarity;
            closestMatch = source.uri;
        }
    });

    return {
        isLikelyModified: highestSimilarity > 0.7,
        closestMatch,
        similarity: highestSimilarity
    };
};

/**
 * Calculates similarity between two strings using a simple algorithm
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score between 0 and 1
 */
const calculateStringSimilarity = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const maxLen = Math.max(len1, len2);
    let matches = 0;

    for (let i = 0; i < Math.min(len1, len2); i++) {
        if (str1[i] === str2[i]) {
            matches++;
        }
    }

    // Add partial credit for length similarity
    const lengthSimilarity = 1 - Math.abs(len1 - len2) / maxLen;

    return (matches / maxLen) * 0.7 + lengthSimilarity * 0.3;
};