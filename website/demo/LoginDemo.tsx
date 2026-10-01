import { useEffect, useRef, useState } from 'react';
import { initFocuzPassOverlay } from '@focuz/content/focuzPassOverlay';

/** A made-up site, so the demo doesn't borrow anyone's brand. */
const DOMAIN = 'northwind.app';
const LOGO =
    'data:image/svg+xml,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" fill="#5b6cf0"/><path d="M11 4.5 14 11 11 17.5 8 11Z" fill="#fff"/></svg>',
    );

const ACCOUNTS = [
    {
        id: 'nw-1',
        type: 'login' as const,
        title: 'Northwind',
        identity: 'maya@focuznow.com',
        domain: DOMAIN,
        password: 'm4ya-northwind-2026!',
        authMethod: 'PASSWORD',
        mark: 'NW',
        markTone: '#8b95f5',
    },
    {
        id: 'nw-2',
        type: 'login' as const,
        title: 'Northwind (team)',
        identity: 'maya@studio.co',
        domain: DOMAIN,
        password: 'studio-team-pass-77',
        authMethod: 'PASSWORD',
        mark: 'NW',
        markTone: '#8b95f5',
    },
];

/** Answers the overlay the way the extension's service worker would for an unlocked vault. */
async function transport<T>(message: Record<string, unknown>): Promise<T> {
    await new Promise((r) => setTimeout(r, 40));
    switch (message.type) {
        case 'FOCUZPASS_STATUS':
            return {
                configured: true,
                unlocked: true,
                itemCount: 7,
                idleLockMinutes: 15,
                unlockedAt: Date.now(),
                absoluteLockAt: null,
                remainingMs: null,
                platform: 'extension',
                passkeysExperimental: true,
            } as T;
        case 'FOCUZPASS_PAGE_CONTEXT':
            return { state: 'ready', domain: DOMAIN, matches: ACCOUNTS, items: ACCOUNTS } as T;
        case 'FOCUZPASS_PENDING_LOGIN':
            return { available: false } as T;
        case 'FOCUZPASS_GENERATE':
            return 'Xk9#mQ2$vL8!pR4' as T;
        default:
            return null as T;
    }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function popover() {
    return document.getElementById('focuzpass-popover-host')?.shadowRoot ?? null;
}

/**
 * The demo sign-in page. The real FocuzPass overlay runs on it: focusing the email field
 * opens it, then the first saved login is picked and filled. `replay` runs it again.
 */
export function LoginDemo() {
    const emailRef = useRef<HTMLInputElement>(null);
    const [signedIn, setSignedIn] = useState(false);

    useEffect(() => {
        const icon = document.createElement('link');
        icon.rel = 'icon';
        icon.href = LOGO;
        document.head.appendChild(icon);
        initFocuzPassOverlay(transport as never);

        let run = 0;
        const play = async () => {
            const id = ++run;
            const alive = () => id === run;
            setSignedIn(false);
            const form = emailRef.current?.form;
            form?.reset();
            (document.activeElement as HTMLElement | null)?.blur();
            await sleep(900);
            if (!alive()) return;
            emailRef.current?.focus();
            // Open FocuzPass from its icon in the email field (focus alone doesn't open it in a
            // frame that doesn't have window focus).
            await sleep(350);
            if (!alive()) return;
            if (!popover()?.querySelector('.row')) {
                document.querySelector('[data-focuzpass-field-host]')?.shadowRoot?.querySelector('button')?.click();
            }
            await sleep(1300);
            if (!alive()) return;
            const rows = popover()?.querySelectorAll<HTMLElement>('.row');
            rows?.[0]?.dispatchEvent(new PointerEvent('pointerenter'));
            await sleep(700);
            if (!alive()) return;
            popover()?.querySelector<HTMLElement>('.row')?.click();
            await sleep(900);
            if (!alive()) return;
            setSignedIn(true);
        };

        const onMessage = (event: MessageEvent) => {
            if (event.source === window.parent && event.data?.type === 'fzl-demo-replay') void play();
        };
        window.addEventListener('message', onMessage);
        void play();
        return () => {
            run++;
            window.removeEventListener('message', onMessage);
        };
    }, []);

    const field =
        'mt-1.5 h-[44px] w-full rounded-[10px] px-3.5 text-[15px] text-white outline-none placeholder:text-[#71717a] bg-[#101014] shadow-[inset_0_0_0_1px_#2a2a31] focus:shadow-[inset_0_0_0_1px_#5b6cf0,0_0_0_3px_rgb(91_108_240/0.25)]';

    return (
        <div className="min-h-screen bg-[#0d0d10] font-sans text-[#e4e4e7]">
            <header className="flex items-center gap-3 px-10 py-6">
                <img src={LOGO} alt="" width={24} height={24} />
                <span className="text-[16px] font-semibold tracking-[-0.02em] text-white">Northwind</span>
                <nav className="ml-10 flex gap-7 text-[14px] text-[#8b8b93]">
                    <span>Product</span>
                    <span>Customers</span>
                    <span>Pricing</span>
                    <span>Docs</span>
                </nav>
            </header>
            <main className="mx-auto mt-12 w-[400px]">
                <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-white">Sign in to Northwind</h1>
                <p className="mt-1.5 text-[15px] text-[#8b8b93]">Welcome back. Pick up where your team left off.</p>
                <form className="mt-8" onSubmit={(e) => e.preventDefault()} autoComplete="on">
                    <label className="block text-[13px] font-medium text-[#b4b4bb]" htmlFor="email">
                        Email
                    </label>
                    <input ref={emailRef} id="email" name="email" type="email" autoComplete="username" placeholder="you@company.com" className={field} />
                    <label className="mt-5 block text-[13px] font-medium text-[#b4b4bb]" htmlFor="password">
                        Password
                    </label>
                    <input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" className={field} />
                    <button
                        type="submit"
                        className="mt-7 flex h-[44px] w-full items-center justify-center rounded-[10px] bg-[#5b6cf0] text-[15px] font-semibold text-white transition-colors"
                        style={{ background: signedIn ? '#3f9d6b' : undefined }}
                    >
                        {signedIn ? 'Signed in' : 'Sign in'}
                    </button>
                </form>
                <p className="mt-5 text-center text-[13px] text-[#71717a]">Forgot your password?</p>
            </main>
        </div>
    );
}
