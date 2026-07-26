import { useState, useEffect } from 'react';
import { Search, ArrowLeft, ExternalLink } from 'lucide-react';
import { Input } from '@focuz/components/ui/input';
import { Button } from '@focuz/components/ui/button';

interface HistoryItem {
    id: string;
    url: string;
    title?: string;
    lastVisitTime?: number;
    visitCount?: number;
}

export function HistoryView({ onBack }: { onBack: () => void }) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [maxResults, setMaxResults] = useState(50);
    const [screenTimeData, setScreenTimeData] = useState<Record<string, number>>({});

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            setError(null);

            try {
                if (!chrome?.history?.search) {
                    throw new Error('History API not available. Please check extension permissions.');
                }

                const results = await chrome.history.search({
                    text: searchTerm,
                    maxResults: maxResults,
                    startTime: Date.now() - 7 * 24 * 60 * 60 * 1000
                });

                setHistory(results as HistoryItem[]);
            } catch (err) {
                console.error('[HistoryView] Error fetching history:', err);
                setError(err instanceof Error ? err.message : 'Failed to load history');
                setHistory([]);
            } finally {
                setLoading(false);
            }
        };

        const debounce = setTimeout(fetchHistory, 300);
        return () => clearTimeout(debounce);
    }, [searchTerm, maxResults]);

    // Load screen time data
    useEffect(() => {
        const loadScreenTime = async () => {
            const today = new Date().toISOString().split('T')[0];
            const storageKey = `screenTime_${today}`;
            const result = await chrome.storage.local.get([storageKey]);
            const data: Record<string, number> = (result[storageKey] as Record<string, number>) || {};
            setScreenTimeData(data);
        };
        loadScreenTime();

        // Refresh every 10 seconds
        const interval = setInterval(loadScreenTime, 10000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (ms?: number) => {
        if (!ms) return '';
        return new Date(ms).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });
    };

    const getFaviconUrl = (url: string) => {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        } catch {
            return '';
        }
    };

    const getTimeSpent = (url: string): number => {
        try {
            const domain = new URL(url).hostname;
            return screenTimeData[domain] || 0;
        } catch {
            return 0;
        }
    };

    const formatDuration = (ms: number): string => {
        if (ms === 0) return '';
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const remainingMins = minutes % 60;
        return `${hours}h ${remainingMins}m`;
    };

    return (
        <div className="absolute inset-0 flex flex-col bg-zinc-950">
            {/* Header - Fixed */}
            <div className="flex items-center gap-2 p-3 border-b border-white/10 bg-zinc-900/50 backdrop-blur-md flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={onBack} className="text-zinc-400 hover:text-white">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-lg font-semibold text-white">History</h2>
            </div>

            {/* Search - Fixed */}
            <div className="p-3 flex-shrink-0 bg-zinc-950 space-y-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                        placeholder="Search history..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-zinc-900 border-white/10 text-zinc-100 placeholder:text-zinc-600"
                    />
                </div>
                {history.length >= maxResults && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                        onClick={() => setMaxResults(prev => prev + 50)}
                    >
                        Show More ({history.length} shown)
                    </Button>
                )}
            </div>

            {/* History List - Scrollable */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                {loading ? (
                    <div className="text-center py-8 text-zinc-500">Loading...</div>
                ) : error ? (
                    <div className="text-center py-8">
                        <p className="text-red-400 text-sm mb-2">{error}</p>
                        <p className="text-zinc-500 text-xs">Make sure the extension has history permissions in manifest.json</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                        <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center">
                            <Search className="w-8 h-8 text-zinc-600" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-zinc-300">No history found</p>
                            <p className="text-xs text-zinc-500 max-w-[200px] mx-auto">
                                Your browsing journey starts here. Visit some sites!
                            </p>
                        </div>
                    </div>
                ) : (
                    history.map((item) => (
                        <div key={item.id} className="group flex items-center justify-between p-3 rounded-lg bg-zinc-900/30 border border-white/5 hover:border-purple-500/30 transition-all">
                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                                <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                    <img
                                        src={getFaviconUrl(item.url)}
                                        alt=""
                                        className="w-4 h-4"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            const parent = e.currentTarget.parentElement;
                                            if (parent) {
                                                const icon = document.createElement('div');
                                                icon.innerHTML = '<svg class="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>';
                                                parent.appendChild(icon.firstChild!);
                                            }
                                        }}
                                    />
                                </div>
                                <div className="flex flex-col overflow-hidden flex-1">
                                    <p className="text-sm font-medium text-zinc-200 truncate">
                                        {item.title || item.url}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-zinc-500 truncate">
                                            {new URL(item.url).hostname} • {formatTime(item.lastVisitTime)}
                                        </p>
                                        {getTimeSpent(item.url) > 0 && (
                                            <>
                                                <span className="text-xs text-zinc-600">•</span>
                                                <span className="text-xs text-purple-400 font-medium flex-shrink-0">
                                                    {formatDuration(getTimeSpent(item.url))}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-zinc-500 hover:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
