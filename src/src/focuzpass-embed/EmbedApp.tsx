import { useEffect, useRef } from 'react';
import FocuzPassTab from '../options/FocuzPassTab';
import { EmbeddedReceive } from './EmbeddedReceive';
import { safeImageUrl, type EmbedToHost, type EmbedView } from '../lib/focuzPass/embed';

type Props = {
    /** The FocuzNow page that framed this one, or null when opened on its own. */
    host: string | null;
    /** Framed by anything other than the FocuzNow site. */
    refused: boolean;
    view: EmbedView;
    params: URLSearchParams;
    linkCode?: string;
};

function post(host: string | null, message: EmbedToHost) {
    if (host) window.parent.postMessage(message, host);
}

function ReceiveCard({ host, linkCode }: { host: string | null; linkCode?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(() => post(host, { type: 'focuzpass-embed:height', height: el.getBoundingClientRect().height }));
        observer.observe(el);
        return () => observer.disconnect();
    }, [host]);
    return (
        <div ref={ref} className="p-px">
            <div className="rounded-[16px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] p-5">
                <EmbeddedReceive initialCode={linkCode} />
            </div>
        </div>
    );
}

function Vault({ host, params }: { host: string | null; params: URLSearchParams }) {
    const avatar = safeImageUrl(params.get('avatar'));
    return (
        <div className="focuz-dashboard focuz-dashboard-shell focuz-dashboard--focuzpass h-screen">
            <main className="workspace-main relative flex h-full min-w-0 flex-col overflow-hidden">
                <div className="h-full min-h-0 w-full flex-1 overflow-hidden">
                    <div className="h-full">
                        <FocuzPassTab
                            avatarUrl={avatar}
                            avatarFallbackUrl={avatar}
                            username={params.get('username') || 'Username'}
                            accountName={params.get('name') || 'FocuzNow Account'}
                            onExit={host ? () => post(host, { type: 'focuzpass-embed:exit' }) : undefined}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}

export function EmbedApp({ host, refused, view, params, linkCode }: Props) {
    if (refused) {
        return (
            <div className="flex h-screen items-center justify-center p-6 text-center text-[13px] text-[var(--fz-text-3)]">
                FocuzPass only opens inside FocuzNow.
            </div>
        );
    }
    return view === 'receive' ? <ReceiveCard host={host} linkCode={linkCode} /> : <Vault host={host} params={params} />;
}
