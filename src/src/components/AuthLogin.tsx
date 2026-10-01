import { useRef } from 'react';
import { Check } from 'lucide-react';
import { BlurWords } from './auth/BlurWords';
import { FocusPull } from './auth/FocusPull';

const BENEFITS = ['Sync blocklists and streaks across devices', 'Back up your schedules and focus history'] as const;

const EXTENSION_LOGIN_URL = 'https://focuznow.com/login?extension_oauth=1';
const EXTENSION_SIGNUP_URL = 'https://focuznow.com/signup?extension_oauth=1';

/* The landing page's night palette, so the extension's sign-in matches focuznow.com/login. */
const INK = 'oklch(0.118 0.003 275)';
const TEXT_1 = 'oklch(0.985 0.002 275)';
const TEXT_3 = 'oklch(0.69 0.005 275)';
const TEXT_4 = 'oklch(0.55 0.005 275)';
const LINE = 'oklch(0.955 0.003 275 / 0.08)';

const Z_PATH = 'M20 17.8 H47.2 V22.2 L22.8 41.8 H47.2 L44 46.2 H16.8 V41.8 L29.2 22.2 H16.8 Z';

function Mark({ size = 28 }: { size?: number }) {
    return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" aria-hidden className="shrink-0">
            <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="16" fill="#0A0B0D" stroke="rgb(255 255 255 / 0.16)" strokeWidth="1.5" />
            <path d={Z_PATH} fill="#F4F2EE" stroke="#F4F2EE" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
    );
}

export function AuthLogin() {
    const headlineRef = useRef<HTMLDivElement>(null);

    return (
        <div className="focuz-shell fixed inset-0 z-[200] flex overflow-hidden" style={{ background: INK, color: TEXT_1 }}>
            <section aria-label="FocuzNow" className="relative hidden min-w-0 flex-1 overflow-hidden md:block">
                <FocusPull className="absolute inset-0" clearRef={headlineRef} ink={INK} paper="oklch(0.83 0.004 275)" />
                <div className="absolute left-10 top-8 flex items-center gap-2.5">
                    <Mark />
                    <span className="text-[16px] font-[620] tracking-[-0.03em]">FocuzNow</span>
                </div>
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-10 xl:px-16">
                    <div ref={headlineRef} className="inline-block">
                        <h2
                            className="text-[clamp(2.6rem,4.6vw,4.75rem)] font-bold leading-[0.98] tracking-[-0.045em]"
                            style={{ textShadow: `0 2px 30px ${INK}` }}
                        >
                            <span className="block" style={{ color: TEXT_3 }}>
                                Built for
                            </span>
                            <BlurWords className="block" />
                        </h2>
                    </div>
                </div>
                <p className="absolute bottom-10 left-10 max-w-[24rem] text-[14.5px] leading-[1.55] xl:left-16" style={{ color: TEXT_3 }}>
                    Blocks distractions, runs your focus sessions, and keeps your plans and passwords in one place.
                </p>
            </section>

            <main className="flex w-full flex-col justify-center px-8 md:w-[460px] md:shrink-0" style={{ boxShadow: `inset 1px 0 0 ${LINE}` }}>
                <div className="mx-auto w-full max-w-[340px]">
                    <div className="mb-10 flex items-center gap-2.5 md:hidden">
                        <Mark />
                        <span className="text-[16px] font-[620] tracking-[-0.03em]">FocuzNow</span>
                    </div>
                    <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-0.035em]">Sign in to sync.</h1>
                    <p className="mt-3 text-[15px] leading-[1.55]" style={{ color: TEXT_3 }}>
                        Your blocking works offline. An account keeps everything in step across devices and unlocks Pro features.
                    </p>

                    <ul className="mt-6 space-y-2.5">
                        {BENEFITS.map((text) => (
                            <li key={text} className="flex items-center gap-2.5 text-[14px]" style={{ color: 'oklch(0.83 0.004 275)' }}>
                                <Check size={15} strokeWidth={2.4} className="shrink-0" />
                                {text}
                            </li>
                        ))}
                    </ul>

                    <div className="mt-8 space-y-2.5">
                        <button
                            type="button"
                            onClick={() => window.open(EXTENSION_SIGNUP_URL, '_blank')}
                            className="flex h-11 w-full items-center justify-center rounded-[10px] text-[15px] font-[560] transition-[background-color,transform] duration-200 hover:bg-white active:scale-[0.98]"
                            style={{ background: TEXT_1, color: 'oklch(0.15 0.004 275)' }}
                        >
                            Create free account
                        </button>
                        <button
                            type="button"
                            onClick={() => window.open(EXTENSION_LOGIN_URL, '_blank')}
                            className="flex h-11 w-full items-center justify-center rounded-[10px] bg-[oklch(1_0_0/0.035)] text-[15px] font-[560] shadow-[inset_0_0_0_1px_oklch(0.955_0.003_275/0.15)] transition-[background-color,transform] duration-200 hover:bg-[oklch(1_0_0/0.075)] active:scale-[0.98]"
                        >
                            Sign in
                        </button>
                    </div>

                    <p className="mt-6 text-[12.5px] leading-[1.55]" style={{ color: TEXT_4 }}>
                        Sign in on focuznow.com, then come back here. This page refreshes on its own. Terms are accepted when you
                        create an account.
                    </p>
                </div>
            </main>
        </div>
    );
}
