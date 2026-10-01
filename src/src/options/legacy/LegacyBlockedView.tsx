// LEGACY: pre-revamp blocked-site page kept so it can be picked in Settings → Page versions.
// Copied from options/OptionsApp.tsx (BlockedView). Keep behavior changes out of this file.
import { useEffect, useState } from 'react';
import { Lock as IconLock, Zap as IconBolt } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { useProDashboardVisuals } from '../../lib/proDashboard';
import type { FutureSelfBlockedSummary } from '../../lib/futureSelfTypes';
import { EmergencyUnlockModal } from '../../components/EmergencyUnlockModal';
import { FutureSelfBlockedOverlay } from '../../components/FutureSelfBlockedOverlay';
import { GlassCard } from '../OptionsApp';

const LegacyBlockedView = ({ url }: { url: string }) => {
    const { engineState, fetchEngineState } = useAuthStore();
    const { enabled: proVisuals } = useProDashboardVisuals();
    const [domain, setDomain] = useState('');
    const [engineReady, setEngineReady] = useState(false);
    const [emergencyOpen, setEmergencyOpen] = useState(false);
    const [overrideNotice, setOverrideNotice] = useState('');
    const [overrideError, setOverrideError] = useState('');
    const [futureSelfSummary, setFutureSelfSummary] = useState<FutureSelfBlockedSummary | null>(null);

    const ytCategory = new URLSearchParams(window.location.search).get('ytCategory');
    const overrideSettings = engineState.emergencyOverrideSettings ?? {
        enabled: true,
        maxPerDay: 3,
        minReasonLength: 20,
        accessMinutes: 15,
        cooldownMinutes: 30,
    };

    useEffect(() => {
        void fetchEngineState().then(() => setEngineReady(true));
    }, [fetchEngineState]);

    useEffect(() => {
        if (url === 'LOCKDOWN') {
            setDomain('ALL SITES (NUCLEAR LOCKDOWN)');
        } else if (url === 'REDACTED') {
            setDomain('Restricted Content');
        } else {
            try {
                setDomain(new URL(url).hostname);
            } catch (e) {
                setDomain(url);
            }
        }
    }, [url]);

    useEffect(() => {
        if (!url || url === 'LOCKDOWN' || url === 'REDACTED') return;
        void chrome.runtime.sendMessage({ type: 'FUTURE_SELF_BLOCKED', url }).then((response) => {
            setFutureSelfSummary(response?.summary ?? null);
        });
    }, [url]);

    const isNuclear = engineState.nuclearState?.active;
    const message = engineState.redirectMessage || "Shouldn't you be working?";
    const canEmergency =
        !isNuclear &&
        overrideSettings.enabled !== false &&
        url !== 'LOCKDOWN' &&
        url !== 'REDACTED';

    const requestEmergency = async (reason: string) => {
        setOverrideError('');
        setOverrideNotice('');
        const targetUrl = url.startsWith('http') ? url : `https://${domain}`;
        const resp = await new Promise<{ ok?: boolean; error?: string; expiresAt?: number }>((resolve) =>
            chrome.runtime.sendMessage(
                { type: 'EMERGENCY_OVERRIDE', url: targetUrl, reason },
                (r) => resolve(r ?? {}),
            ),
        );
        if (!resp.ok) {
            setOverrideError(resp.error ?? 'Override denied');
            throw new Error(resp.error ?? 'Override denied');
        }
        const mins = overrideSettings.accessMinutes ?? 15;
        setOverrideNotice(`Temporary access granted for ${mins} minutes. Use it wisely.`);
        setEmergencyOpen(false);
        setTimeout(() => {
            window.location.href = targetUrl;
        }, 800);
    };

    if (futureSelfSummary) {
        return (
            <div className="fixed inset-0 z-[70] flex min-h-[100dvh] w-screen items-center justify-center overflow-y-auto bg-page p-4 sm:p-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--fz-accent-soft)_0%,transparent_65%)]" />
                <FutureSelfBlockedOverlay url={url} summary={futureSelfSummary} />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 min-h-[100dvh] w-screen bg-page flex flex-col items-center justify-center px-4 py-10 sm:px-8 sm:py-14 md:py-16 text-white font-sans z-[70] overflow-y-auto">
            <div
                className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,var(--fz-accent-soft)_0%,transparent_60%)]"
            />

            <GlassCard
                className="w-full max-w-md sm:max-w-lg p-8 sm:p-10 space-y-8 text-center relative shadow-2xl my-auto border-[var(--fz-accent)]"
            >
                <div
                    className="absolute top-0 left-0 w-full h-px bg-[var(--fz-accent)]"
                />

                <div className="space-y-6 sm:space-y-8">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[var(--fz-accent-soft)] rounded-full flex items-center justify-center mx-auto ring-1 ring-[var(--fz-accent-soft)]">
                        {isNuclear ? <IconBolt size={44} className="text-[var(--fz-accent)] sm:w-12 sm:h-12" /> : <IconLock size={44} className="text-[var(--fz-accent)] sm:w-12 sm:h-12" />}
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                        <h1 className="text-title-1 text-neutral-50 px-2">
                            {isNuclear ? 'Nuclear lockdown' : 'Restricted access'}
                        </h1>
                        <p className="text-neutral-400 text-sm sm:text-base leading-relaxed max-w-sm mx-auto px-2">
                            {engineReady
                                ? proVisuals
                                    ? `You chose focus. ${engineState.blockedToday || 0} distractions stopped today.`
                                    : `"${message}"`
                                : 'Loading…'}
                        </p>
                    </div>
                </div>

                <div className="py-6 sm:py-8 px-6 sm:px-8 bg-white/4 rounded-lg border border-white/8 w-full">
                    <p className="text-label text-neutral-500 mb-3 sm:mb-4">Restricted area</p>
                    <p className="text-lg sm:text-xl font-semibold text-[var(--fz-accent)] break-all leading-snug">{domain || '…'}</p>
                </div>

                {new URLSearchParams(window.location.search).get('source') === 'schedule' && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center animate-pulse">
                        <p className="text-red-400 text-xs font-bold leading-relaxed">
                            This site is blocked by your <span className="text-white">focus schedule</span>.
                            <br />
                            Go to the <span className="underline cursor-pointer" onClick={() => window.location.href = chrome.runtime.getURL('src/options/index.html?tab=schedule')}>Schedules Tab</span> to manage this.
                        </p>
                    </div>
                )}

                {ytCategory && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-center">
                        <p className="text-amber-300 text-xs font-bold">
                            Smart YouTube blocked this as <span>{ytCategory.replace('_', ' ')}</span> content
                        </p>
                    </div>
                )}

                {overrideNotice && (
                    <p className="text-sm text-green-400 font-medium text-center">{overrideNotice}</p>
                )}
                {overrideError && !emergencyOpen && (
                    <p className="text-sm text-red-400 font-medium text-center">{overrideError}</p>
                )}

                <EmergencyUnlockModal
                    open={emergencyOpen}
                    domain={domain}
                    minReasonLength={overrideSettings.minReasonLength ?? 20}
                    onClose={() => setEmergencyOpen(false)}
                    onSubmit={requestEmergency}
                />

                <div className="space-y-4 sm:space-y-5 pt-2 sm:pt-6 w-full">
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="w-full py-4 sm:py-5 md:py-6 bg-white text-black rounded-lg font-semibold text-base sm:text-lg hover:bg-neutral-200 transition-all active:scale-[0.98] flex items-center justify-center"
                    >
                        Go back to work
                    </button>

                    {!isNuclear && (
                        <>
                            {canEmergency && (
                                <button
                                    type="button"
                                    onClick={() => setEmergencyOpen(true)}
                                    className="w-full py-3.5 sm:py-4 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-lg font-bold text-sm hover:bg-amber-500/25 transition-all"
                                >
                                    Emergency Unlock
                                </button>
                            )}
                            {proVisuals && (
                                <a
                                    href="https://focuznow.com/dashboard?billing=return"
                                    className="w-full py-3.5 sm:py-4 bg-[var(--fz-accent-soft)] text-[var(--fz-accent)] border border-[var(--fz-accent)] rounded-lg font-bold text-sm hover:bg-[var(--fz-accent)]/30 transition-all text-center block"
                                >
                                    Back to dashboard
                                </a>
                            )}
                            <button
                                type="button"
                                onClick={() => { window.location.href = chrome.runtime.getURL('src/options/index.html'); }}
                                className="w-full py-3.5 sm:py-4 bg-white/6 text-neutral-500 rounded-lg font-bold text-sm hover:bg-white/10 transition-all"
                            >
                                Review Extension Settings
                            </button>
                        </>
                    )}

                    <p className="text-[11px] text-neutral-700  font-semibold pt-2">Powered by FocuzNow</p>
                </div>
            </GlassCard>
        </div>
    );
};

export default LegacyBlockedView;
