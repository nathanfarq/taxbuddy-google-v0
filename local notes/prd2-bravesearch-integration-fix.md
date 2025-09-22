# PRD: Brave Search API reconfiguration

## Problem Statement

Current Brave Search implementation produces unreliable citations with frequent 404 errors and homepage redirects instead of specific content pages. The overly restrictive domain filtering (`site:canada.ca OR site:cra-arc.gc.ca OR site:canlii.org`) limits search effectiveness.

## Solutn Approach

Rewrite Brave Search integration for flexible, reliable web search with robust URL validation and intelligent Canadian tax context application.

## Implementation Tasks

### Phase 1: Remove Current Restrictions

typescript

`*// services/braveSearchService.ts - REMOVE:*
- Hardcoded site restrictions in searchQuery
- Forced "Canadian tax law" prefix
- Keep searchTaxResources() but make it contextual`

### Phase 2: Implement Smart Search

typescript

`*// New approach:*
- Base search: Use query as-is for general searches
- Tax context: Add "Canada tax" only when tax-related terms detected
- Flexible domain preference without restriction`

### Phase 3: Add URL Validation

typescript

`*// services/urlValidator.ts (NEW FILE)*
export async function validateUrls(sources: Source[]): Promise<Source[]> {
  *// Parallel HEAD requests to check URL validity// Filter out 404s, redirects to homepages// Return only direct, working links*
}`

### Phase 4: Enhance Result Processing

typescript

`*// Update braveSearchService.ts:*
- Parse search snippets for better context
- Extract page-specific URLs from results
- Implement fallback search if no valid results`

## Code Changes Required

### 1. `services/braveSearchService.ts`

typescript

`export const searchWeb = async (query: string, count: number = 10): Promise<Source[]> => {
    *// Remove domain restrictions// Use query directly// Add result validation// Return validated sources only*
};

export const searchTaxResources = async (query: string): Promise<Source[]> => {
    *// Intelligent context addition// Check if query mentions tax terms// Add "Canada" context only when relevant*
};`

### 2. `services/urlValidator.ts` (NEW)

typescript

`*// Implement URL validation// Check response status// Verify content relevance// Handle redirects appropriately*`

### 3. `services/openaiService.ts`

typescript

`*// Update to handle validation failures// Implement retry logic for failed searches// Add source quality feedback to prompts*`

## Validation Strategy

1. **Pre-validation**: Check URL format and protocol
2. **Live validation**: HEAD request to verify 200 status
3. **Content validation**: Ensure URL contains relevant content (not just homepage)
4. **Fallback**: If validation fails, retry search with modified query

## Success Metrics

- [ ]  Zero 404 errors in citations
- [ ]  Links go to specific content pages, not homepages
- [ ]  Canadian tax sources prioritized but not exclusive
- [ ]  90%+ citation accuracy rate

## Testing Requirements

- Test with various tax queries
- Verify non-tax queries work appropriately
- Validate error handling for failed searches
- Check performance with URL validation

## Notes for Implementation

- Consider caching validated URLs for 24 hours
- Implement rate limiting for validation requests
- Log failed validations for debugging
- Keep original search results for fallback