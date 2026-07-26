import { useState } from 'react';
import { Globe, Download, Check, Loader2 } from 'lucide-react';
import { useAuthStore } from '../lib/store';

export function BrowsingHistorySettings() {
    const { historyPermission, setHistoryPermission, importHistory } = useAuthStore();
    const [isImporting, setIsImporting] = useState(false);
    const [importDone, setImportDone] = useState(false);

    const handleImport = async () => {
        setIsImporting(true);
        try {
            await setHistoryPermission(true);
            await importHistory();
            setImportDone(true);
        } finally {
            setIsImporting(false);
        }
    };

    const imported = historyPermission && importDone;

    return (
        <div className="glass-edge-card rounded-2xl p-5 sm:p-6">
            <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 ring-1 ring-sky-500/20">
                    <Globe size={18} className="text-sky-400" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-white">Browsing history</h3>
                    <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
                        Import the last 7 days from Chrome for richer statistics. Data never leaves your device.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleImport}
                            disabled={isImporting || imported}
                            className="glass-edge-btn inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-sky-300 disabled:opacity-50"
                        >
                            {isImporting ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Importing…
                                </>
                            ) : imported ? (
                                <>
                                    <Check size={14} />
                                    Imported
                                </>
                            ) : (
                                <>
                                    <Download size={14} />
                                    {historyPermission ? 'Re-import' : 'Import history'}
                                </>
                            )}
                        </button>
                        {historyPermission && (
                            <button
                                type="button"
                                onClick={() => {
                                    void setHistoryPermission(false);
                                    setImportDone(false);
                                }}
                                className="px-3 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-300 transition-colors"
                            >
                                Revoke
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
