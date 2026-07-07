import { AuthShell } from './shell/AuthShell';
import { Brand } from './shell/Brand';
import { ShellCard, ShellTitle, ShellDescription, ShellButton } from './shell/ui';
import { Shield, Cloud } from 'lucide-react';

const BENEFITS = [
    { icon: Shield, text: 'Sync blocklists & streaks across devices' },
    { icon: Cloud, text: 'Backup schedules and focus history' },
] as const;

const EXTENSION_LOGIN_URL = 'https://focuznow.com/login?extension_oauth=1';
const EXTENSION_SIGNUP_URL = 'https://focuznow.com/signup?extension_oauth=1';

export function AuthLogin() {
    return (
        <AuthShell>
            <ShellCard>
                <Brand size="lg" subtitle="Focus extension" className="mb-6" />

                <div className="space-y-2 mb-6">
                    <ShellTitle>Sign in to sync</ShellTitle>
                    <ShellDescription>
                        Your blocking engine works offline. An account unlocks cloud sync and Pro features.
                        Terms are accepted when you create an account on focuznow.com.
                    </ShellDescription>
                </div>

                <ul className="space-y-2.5 mb-7">
                    {BENEFITS.map(({ icon: Icon, text }) => (
                        <li key={text} className="flex items-center gap-2.5 text-sm text-neutral-400">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
                                <Icon size={14} className="text-violet-400/90" strokeWidth={2} />
                            </span>
                            {text}
                        </li>
                    ))}
                </ul>

                <div className="space-y-2.5">
                    <ShellButton onClick={() => window.open(EXTENSION_SIGNUP_URL, '_blank')}>
                        Create free account
                    </ShellButton>
                    <ShellButton
                        variant="secondary"
                        onClick={() => window.open(EXTENSION_LOGIN_URL, '_blank')}
                    >
                        Sign in
                    </ShellButton>
                </div>

                <p className="mt-5 text-center text-[11px] text-neutral-600 leading-relaxed">
                    After signing in on the website, return here — this page refreshes automatically.
                </p>
            </ShellCard>
        </AuthShell>
    );
}
