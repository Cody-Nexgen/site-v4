import { useEffect, useState } from 'react';
import FocuzPassTab from '../FocuzPassTab';
import { WebVaultBackend } from '../../lib/focuzPass/webVaultBackend';
import { emitFocuzPassEvent, setFocuzPassTransport } from '../../lib/focuzPass/client';
import { supabaseCloudStore, type CloudStore, type SupabaseLike } from '../../lib/focuzPass/cloud/store';
import type { RealtimeLike } from '../../lib/focuzPass/cloud/realtime';
import { supabase } from '../../lib/supabase';

/**
 * FocuzPass without the extension: the same FocuzPass, backed by the web vault
 * (lib/focuzPass/webVaultBackend.ts) instead of the extension. The website shows this on its
 * FocuzPass tab when the extension isn't there; vault.html shows it on its own.
 */
export function WebVault({
    avatarUrl,
    username,
    accountName,
    onExit,
    store,
    realtime,
}: {
    avatarUrl?: string | null;
    username?: string;
    accountName?: string;
    onExit?: () => void;
    /** Defaults to the site's signed-in Supabase client (tests and the dev demo pass their own). */
    store?: CloudStore;
    realtime?: RealtimeLike | null;
}) {
    const [backend] = useState(() => {
        const created = new WebVaultBackend(
            store ?? supabaseCloudStore(supabase as unknown as SupabaseLike),
            emitFocuzPassEvent,
            realtime === undefined ? (supabase as unknown as RealtimeLike) : realtime,
        );
        // Before FocuzPassTab's first request, which runs in its own effect (children's effects run first).
        setFocuzPassTransport((message) => created.handle(message as { type: string }));
        return created;
    });
    const [email, setEmail] = useState<string>();

    useEffect(() => {
        setFocuzPassTransport((message) => backend.handle(message as { type: string }));
        void backend.handle({ type: 'FOCUZPASS_CLOUD_ACCOUNT' }).then((answer) => {
            if (answer.ok) setEmail((answer.data as { email?: string }).email);
        });
        // Leaving the page locks it: nothing stays behind in the browser.
        const lock = () => backend.lock();
        window.addEventListener('pagehide', lock);
        return () => {
            window.removeEventListener('pagehide', lock);
            backend.lock();
            setFocuzPassTransport(null);
        };
    }, [backend]);

    return (
        <FocuzPassTab
            avatarUrl={avatarUrl}
            username={username}
            accountName={accountName}
            onExit={onExit}
            webVault={{ unlock: (input) => backend.open(input), email }}
        />
    );
}
