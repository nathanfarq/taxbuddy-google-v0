import { Source } from '../types';

interface ValidationResult {
    source: Source;
    isValid: boolean;
    redirectedUrl?: string;
}

/**
 * Validates a single URL by checking if it returns a successful response
 * @param source The source object to validate
 * @returns Promise resolving to validation result
 */
const validateSingleUrl = async (source: Source): Promise<ValidationResult> => {
    try {
        const response = await fetch(source.uri, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; TaxBuddy/1.0)'
            }
        });

        // Check if URL is valid (200-299 status codes)
        const isValid = response.ok;

        // Check for redirects to homepage (common issue mentioned in PRD)
        let redirectedUrl: string | undefined;
        if (response.url !== source.uri) {
            redirectedUrl = response.url;

            // Consider redirect to homepage as invalid
            const isHomepageRedirect = isHomepageUrl(redirectedUrl);
            return {
                source,
                isValid: isValid && !isHomepageRedirect,
                redirectedUrl
            };
        }

        return {
            source,
            isValid
        };

    } catch (error) {
        console.warn(`URL validation failed for ${source.uri}:`, {
            error: error instanceof Error ? error.message : String(error),
            url: source.uri,
            timestamp: new Date().toISOString()
        });
        return {
            source,
            isValid: false
        };
    }
};

/**
 * Determines if a URL appears to be a homepage rather than a specific content page
 * @param url The URL to check
 * @returns boolean indicating if this looks like a homepage
 */
const isHomepageUrl = (url: string): boolean => {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;

        // Common homepage patterns
        const homepagePatterns = [
            '/',
            '/index',
            '/home',
            '/default'
        ];

        return homepagePatterns.some(pattern =>
            path === pattern || path.startsWith(pattern + '.')
        );
    } catch {
        return false;
    }
};

/**
 * Validates multiple URLs in parallel and returns only valid sources
 * @param sources Array of sources to validate
 * @returns Promise resolving to array of validated sources
 */
export const validateUrls = async (sources: Source[]): Promise<Source[]> => {
    if (!sources || sources.length === 0) {
        return [];
    }

    try {
        // Validate all URLs in parallel for better performance
        const validationPromises = sources.map(validateSingleUrl);
        const results = await Promise.all(validationPromises);

        // Filter out invalid URLs and return valid sources
        const validSources = results
            .filter(result => result.isValid)
            .map(result => {
                // Use redirected URL if available and valid
                if (result.redirectedUrl && result.isValid) {
                    return {
                        ...result.source,
                        uri: result.redirectedUrl
                    };
                }
                return result.source;
            });

        console.log(`URL validation: ${validSources.length}/${sources.length} sources validated successfully`, {
            totalSources: sources.length,
            validSources: validSources.length,
            successRate: `${Math.round((validSources.length / sources.length) * 100)}%`,
            timestamp: new Date().toISOString()
        });

        return validSources;

    } catch (error) {
        console.error('Error during URL validation:', {
            error: error instanceof Error ? error.message : String(error),
            sourceCount: sources.length,
            timestamp: new Date().toISOString()
        });
        // Return original sources on validation error to maintain functionality
        return sources;
    }
};

/**
 * Pre-validates URLs by checking format and protocol before making requests
 * @param sources Array of sources to pre-validate
 * @returns Array of sources with valid URL format
 */
export const preValidateUrls = (sources: Source[]): Source[] => {
    return sources.filter(source => {
        try {
            const url = new URL(source.uri);
            // Only allow HTTP and HTTPS protocols
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    });
};