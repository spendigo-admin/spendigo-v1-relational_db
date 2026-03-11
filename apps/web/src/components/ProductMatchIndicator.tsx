/**
 * Product Match Indicator Component
 * Displays match type badge and confidence score visualization
 */

import React from 'react';
import { SearchResult } from '../utils/fuzzy-search';

interface ProductMatchDisplayProps {
    matchResult: SearchResult;
    compact?: boolean;
}

export const ProductMatchIndicator: React.FC<ProductMatchDisplayProps> = ({
    matchResult,
    compact = false
}) => {
    const getBadgeConfig = () => {
        switch (matchResult.matchType) {
            case 'exact':
                return {
                    bg: 'bg-green-100',
                    text: 'text-green-700',
                    icon: '✅',
                    label: 'Exact Match'
                };
            case 'partial':
                return {
                    bg: 'bg-blue-100',
                    text: 'text-blue-700',
                    icon: '🔍',
                    label: 'Partial Match'
                };
            case 'fuzzy':
                return {
                    bg: 'bg-yellow-100',
                    text: 'text-yellow-800',
                    icon: '⚡',
                    label: 'Fuzzy Match'
                };
            case 'typo':
                return {
                    bg: 'bg-purple-100',
                    text: 'text-purple-700',
                    icon: '🔧',
                    label: 'Typo Correction'
                };
        }
    };

    const config = getBadgeConfig();
    const isHighConfidence = matchResult.confidenceScore >= 85;
    const isMediumConfidence = matchResult.confidenceScore >= 70 && matchResult.confidenceScore < 85;

    if (compact) {
        return (
            <div className="flex items-center gap-2" title={`${config.label}: ${matchResult.confidenceScore}% confidence`}>
                {isHighConfidence && <span className="text-lg">{config.icon}</span>}
                {isMediumConfidence && !isHighConfidence && <span className="text-sm">⚠️</span>}
            </div>
        );
    }

    return (
        <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
            title={`${config.label}: ${matchResult.confidenceScore}% confidence`}
        >
            <span>{config.icon}</span>
            <span className="uppercase tracking-wide">{config.label}</span>
            {!isHighConfidence && (
                <div className="flex items-center gap-1 ml-2">
                    <div className="relative w-20 h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ${
                                isHighConfidence ? 'bg-green-600' :
                                isMediumConfidence ? 'bg-yellow-500' :
                                'bg-red-500'
                            }`}
                            style={{ width: `${matchResult.confidenceScore}%` }}
                        />
                    </div>
                    <span className="text-[10px] opacity-80">{matchResult.confidenceScore}%</span>
                </div>
            )}
        </div>
    );
};

/**
 * Search Results List with Match Indicators
 */
interface SearchResultsListProps {
    results: SearchResult[];
    onSelect: (result: SearchResult) => void;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
    results,
    onSelect
}) => {
    if (results.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No matches found</p>
                <p className="text-xs mt-1">Try searching with different keywords</p>
            </div>
        );
    }

    return (
        <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((result, index) => (
                <button
                    key={`${result.productId}_${index}`}
                    onClick={() => onSelect(result)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">
                                {result.productName}
                            </p>
                            {result.brand && (
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mt-1 inline-block">
                                    {result.brand}
                                </span>
                            )}
                        </div>
                        <ProductMatchIndicator matchResult={result} compact />
                    </div>
                </button>
            ))}
        </div>
    );
};
