import { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { findFocuzPassEmbed, type FocuzPassEmbedLookup } from '../../lib/platform/webPlatform';
import { embedSrc, readEmbedToHost, type HostToEmbed } from '../../lib/focuzPass/embed';
import { getDashboardColorMode, resolveDashboardColorMode, subscribeToDashboardColorMode } from '../../lib/themes';
import { WebVault } from './WebVault';

/**
 * FocuzPass on the FocuzNow website. With the extension, the vault UI is the extension's own page
 * in a frame, so nothing from the vault ever reaches the site's code; the site only learns "exit"
 * from it. Without the extension, it's the web vault (same FocuzPass, run in the page).
 */
export function FocuzPassFrame({
    avatarUrl,
    username,
    accountName,
    onExit,
}: {
    avatarUrl?: string | null;
    username?: string;
    accountName?: string;
    onExit?: () => void;
}) {
    const [lookup, setLookup] = useState<FocuzPassEmbedLookup | null>(null);
    // The frame's URL is set once; theme changes go over postMessage so it never reloads.
    const [src, setSrc] = useState<string | null>(null);
    const [profile] = useState(() => ({ avatarUrl, username, accountName }));
    const frameRef = useRef<HTMLIFrameElement>(null);
    const onExitRef = useRef(onExit);
    useEffect(() => {
        onExitRef.current = onExit;
    }, [onExit]);

    useEffect(() => {
        let alive = true;
        void findFocuzPassEmbed().then((result) => {
            if (!alive) return;
            setLookup(result);
            if (result.kind === 'ready') {
                setSrc(
                    embedSrc(result.embedUrl, {
                        view: 'vault',
                        theme: resolveDashboardColorMode(getDashboardColorMode()),
                        name: profile.accountName,
                        username: profile.username,
                        avatar: profile.avatarUrl ?? undefined,
                    }),
                );
            }
        });
        return () => {
            alive = false;
        };
    }, [profile]);

    useEffect(() => {
        if (lookup?.kind !== 'ready') return;
        const origin = new URL(lookup.embedUrl).origin;
        const onMessage = (event: MessageEvent) => {
            if (event.source !== frameRef.current?.contentWindow || event.origin !== origin) return;
            if (readEmbedToHost(event.data)?.type === 'focuzpass-embed:exit') onExitRef.current?.();
        };
        window.addEventListener('message', onMessage);
        const unsubscribe = subscribeToDashboardColorMode((mode) => {
            const message: HostToEmbed = { type: 'focuzpass-embed:theme', mode: resolveDashboardColorMode(mode) };
            frameRef.current?.contentWindow?.postMessage(message, origin);
        });
        return () => {
            window.removeEventListener('message', onMessage);
            unsubscribe();
        };
    }, [lookup]);

    if (!lookup) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 size={20} className="animate-spin text-[var(--fz-text-3)]" />
            </div>
        );
    }

    if (lookup.kind !== 'ready' || !src) {
        const outdated = lookup.kind === 'outdated';
        // No extension in this browser: FocuzPass opens right here as the web vault.
        if (!outdated) return <WebVault avatarUrl={profile.avatarUrl} username={profile.username} accountName={profile.accountName} onExit={onExit} />;
        return (
            <div className="flex h-full items-center justify-center p-6">
                <div className="w-full max-w-[26rem] rounded-[16px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] p-6">
                    <span className="flex size-10 items-center justify-center rounded-[10px] bg-[var(--fz-bg-active)] text-[var(--fz-text-2)]">
                        <ShieldCheck size={18} />
                    </span>
                    <p className="mt-4 text-[16px] font-medium text-[var(--fz-text-1)]">Update FocuzNow to use FocuzPass here</p>
                    <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[var(--fz-text-3)]">
                        This version of the extension is too old to show FocuzPass on the website. Update it (or reload it in chrome://extensions), then reload this page.
                    </p>
                    <div className="mt-5 flex gap-2">
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="rounded-[8px] bg-[var(--fz-text-1)] px-3.5 py-2 text-[13px] font-medium text-[var(--fz-bg)]"
                        >
                            Reload
                        </button>
                        {onExit && (
                            <button
                                type="button"
                                onClick={onExit}
                                className="rounded-[8px] border border-[var(--fz-border)] px-3.5 py-2 text-[13px] font-medium text-[var(--fz-text-2)]"
                            >
                                Back to dashboard
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <iframe
            ref={frameRef}
            src={src}
            title="FocuzPass"
            allow="clipboard-write"
            style={{ display: 'block', width: '100%', height: '100%', border: 0 }}
        />
    );
}
