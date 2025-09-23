import React, { useState } from 'react';
import { Source } from '../types';
import { extractInlineCitations, CitationMatch } from '../utils/citationValidator';

interface CitationSummaryProps {
    responseText: string;
    availableSources: Source[];
}

const CitationSummary: React.FC<CitationSummaryProps> = ({ responseText, availableSources }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Extract citations from the response text
    const extractedCitations = extractInlineCitations(responseText);

    // Get unique citations (deduplicate by URL)
    const uniqueCitations = extractedCitations.reduce((acc: CitationMatch[], current) => {
        const exists = acc.some(citation => citation.url === current.url);
        if (!exists) {
            acc.push(current);
        }
        return acc;
    }, []);

    // Match citations with available sources for additional metadata
    const enrichedCitations = uniqueCitations.map(citation => {
        const matchedSource = availableSources.find(source => source.uri === citation.url);
        return {
            ...citation,
            sourceTitle: matchedSource?.title || citation.title,
            isValidSource: !!matchedSource
        };
    });

    const citationCount = extractedCitations.length;
    const sourceCount = uniqueCitations.length;

    // Don't render if no citations found
    if (citationCount === 0) {
        return null;
    }

    return (
        <div className="mt-3 border-t border-slate-200 pt-3">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
                aria-expanded={isExpanded}
            >
                <span>
                    {citationCount} citation{citationCount !== 1 ? 's' : ''} from {sourceCount} source{sourceCount !== 1 ? 's' : ''}
                </span>
                <svg
                    className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isExpanded && (
                <div className="mt-3 space-y-2">
                    {enrichedCitations.map((citation, index) => (
                        <div
                            key={index}
                            className="flex items-start gap-3 p-3 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-semibold">
                                {index + 1}
                            </div>
                            <div className="flex-grow min-w-0">
                                <div className="text-sm font-medium text-slate-900 mb-1 truncate" title={citation.sourceTitle}>
                                    {citation.sourceTitle}
                                </div>
                                <a
                                    href={citation.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline transition-colors break-all"
                                    title={citation.url}
                                >
                                    {citation.url}
                                </a>
                                {!citation.isValidSource && (
                                    <div className="mt-1">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                            External Source
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="flex-shrink-0">
                                <a
                                    href={citation.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors"
                                    aria-label={`Visit ${citation.sourceTitle}`}
                                >
                                    Visit
                                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                    ))}

                    {/* Show summary statistics */}
                    <div className="pt-2 border-t border-slate-200 text-xs text-slate-500">
                        <div className="flex justify-between">
                            <span>Total references: {citationCount}</span>
                            <span>Unique sources: {sourceCount}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CitationSummary;