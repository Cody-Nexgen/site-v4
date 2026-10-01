import { BarChart3, CalendarDays, KeyRound, ShieldBan, Timer } from 'lucide-react';
import { LighthouseHero } from './lighthouse-hero';

const FEATURES = [
    { icon: ShieldBan, name: 'Block', line: 'Sites, categories, and Shorts' },
    { icon: Timer, name: 'Focus', line: 'A Pomodoro that blocks while it runs' },
    { icon: CalendarDays, name: 'Plan', line: 'Calendar, lists, and booking links' },
    { icon: KeyRound, name: 'Passwords', line: 'Encrypted on your device' },
    { icon: BarChart3, name: 'Insights', line: 'Screen time and an AI coach' },
];

export default function LighthouseHeroDemo() {
    return (
        <div className="min-h-screen w-full bg-background">
            <LighthouseHero
                title={['Everything else', 'can wait.']}
                description="Blocks distractions, runs your focus sessions, and keeps your plans and passwords in one place."
                primaryAction={{ label: 'Get started' }}
                secondaryAction={{ label: 'See how it works' }}
            >
                {/* An inverted surface: light on the night sea in dark mode, dark on the print in light mode. */}
                <div className="rounded-[26px] bg-foreground p-6 text-background shadow-2xl">
                    <p className="text-center text-[15px] text-background/70">
                        One extension for your whole focus system. <span className="text-background">Free to start.</span>
                    </p>
                    <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                        {FEATURES.map(({ icon: Icon, name, line }) => (
                            <li key={name} className="flex min-h-[112px] flex-col rounded-[14px] bg-background/10 p-3.5">
                                <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-background text-foreground">
                                    <Icon size={16} strokeWidth={1.8} />
                                </span>
                                <span className="mt-auto pt-3 text-[15px] font-semibold">{name}</span>
                                <span className="mt-0.5 text-[13px] leading-[1.4] text-background/65">{line}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </LighthouseHero>
        </div>
    );
}
