/**
 * URL utilities for cleaning, normalizing, and validating URLs
 */

/**
 * Normalizes a URL by removing tracking parameters and fragments
 * @param url The URL to normalize
 * @returns Normalized URL string
 */
export const normalizeUrl = (url: string): string => {
    try {
        const urlObj = new URL(url);

        // Remove common tracking parameters
        const trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'gclid', 'fbclid', 'msclkid', '_ga', 'mc_cid', 'mc_eid',
            'ref', 'referrer', 'source', 'campaign'
        ];

        trackingParams.forEach(param => {
            urlObj.searchParams.delete(param);
        });

        // Remove fragment identifier
        urlObj.hash = '';

        // Normalize trailing slashes for consistency
        if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
            urlObj.pathname = urlObj.pathname.slice(0, -1);
        }

        return urlObj.toString();
    } catch {
        return url; // Return original if parsing fails
    }
};

/**
 * Validates URL format and protocol
 * @param url The URL to validate
 * @returns True if URL is valid format
 */
export const isValidUrlFormat = (url: string): boolean => {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        return false;
    }
};

/**
 * Extracts domain from URL safely
 * @param url The URL to extract domain from
 * @returns Domain name or 'unknown' if extraction fails
 */
export const extractDomain = (url: string): string => {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return 'unknown';
    }
};

/**
 * Checks if URL appears to be a homepage (for filtering out general pages)
 * @param url The URL to check
 * @returns True if URL appears to be a homepage
 */
export const isHomepage = (url: string): boolean => {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname.toLowerCase();

        // Homepage patterns
        const homepagePatterns = [
            '/', '/index', '/home', '/default', '/main'
        ];

        return homepagePatterns.some(pattern =>
            path === pattern ||
            path === pattern + '.html' ||
            path === pattern + '.htm' ||
            path === pattern + '.php' ||
            path === pattern + '.aspx'
        );
    } catch {
        return false;
    }
};

/**
 * Creates standardized headers for URL requests
 * @returns Standard headers object
 */
export const getStandardHeaders = (): Record<string, string> => {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive'
    };
};

/**
 * Checks if a domain is likely to be reliable for tax information
 * @param domain The domain to check
 * @returns Reliability score from 0-100
 */
export const getDomainReliabilityScore = (domain: string): number => {
    const lowerDomain = domain.toLowerCase();

    // Government domains (highest priority)
    if (lowerDomain.includes('canada.ca') || lowerDomain.includes('gc.ca') || lowerDomain.includes('cra-arc.gc.ca')) {
        return 80;
    }

    // Provincial government domains
    if (lowerDomain.includes('.gov.') || lowerDomain.includes('ontario.ca') || lowerDomain.includes('gov.bc.ca')) {
        return 80;
    }

    // Legal and court domains
    if (lowerDomain.includes('canlii.org') || lowerDomain.includes('courts.ca')) {
        return 75;
    }

    // Professional organizations
    if (lowerDomain.includes('cpacanada.ca') || lowerDomain.includes('cba.org')) {
        return 75;
    }

    // Big 4 accounting firms
    if (lowerDomain.includes('kpmg.') || lowerDomain.includes('pwc.') || lowerDomain.includes('deloitte.') || lowerDomain.includes('ey.')) {
        return 70;
    }

    // Educational institutions
    if (lowerDomain.includes('.edu') || lowerDomain.includes('.ac.')) {
        return 60;
    }

    // Established tax publications
    if (lowerDomain.includes('taxnet') || lowerDomain.includes('taxtips') || lowerDomain.includes('taxplanningguide')) {
        return 60;
    }

    // General reliability check
    if (lowerDomain.includes('wikipedia.org')) {
        return 45; // Useful but not authoritative for tax advice
    }

    // Default for other domains
    return 50;
};