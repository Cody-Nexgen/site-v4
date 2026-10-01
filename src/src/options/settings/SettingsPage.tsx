import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import {
    CreditCard,
    Database,
    History,
    MonitorSmartphone,
    Palette,
    Search,
    ShieldCheck,
    User,
    X,
    Youtube,
    type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { legacyCount, usePageVersions } from '../../lib/pageVersions';
import { Kbd } from '../../components/fz/Kbd';
import { AccountSection } from './AccountSection';
import { PlanSection } from './PlanSection';
import { AppearanceSection } from './AppearanceSection';
import { PageVersionsSection } from './PageVersionsSection';
import { BlockingSection, BrowsingSection, DataSection, YouTubeSection } from './ProtectionSections';
import { SETTINGS_SECTION_IDS, SettingsSearchContext, type SettingsSectionId } from './settingsCore';

const NAV: Record<SettingsSectionId, { label: string; icon: LucideIcon; signedIn?: boolean }> = {
    account: { label: 'Account', icon: User, signedIn: true },
    plan: { label: 'Plan & billing', icon: CreditCard, signedIn: true },
    appearance: { label: 'Appearance', icon: Palette },
    versions: { label: 'Page versions', icon: History },
    blocking: { label: 'Blocking', icon: ShieldCheck },
    browsing: { label: 'While you browse', icon: MonitorSmartphone },
    youtube: { label: 'YouTube', icon: Youtube },
    data: { label: 'Data & privacy', icon: Database },
};

function initialSectionFromUrl(): SettingsSectionId | null {
    try {
        const s = new URLSearchParams(window.location.search).get('section');
        return s && (SETTINGS_SECTION_IDS as string[]).includes(s) ? (s as SettingsSectionId) : null;
    } catch {
        return null;
    }
}

export default function SettingsPage({ initialSection }: { initialSection?: SettingsSectionId }) {
    const session = useAuthStore((s) => s.session);
    const versions = usePageVersions();
    const legacy = legacyCount(versions);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState<SettingsSectionId>(() => initialSection ?? initialSectionFromUrl() ?? (session ? 'account' : 'appearance'));
    const searchRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const jumping = useRef(false);

    const sections = SETTINGS_SECTION_IDS.filter((id) => !NAV[id].signedIn || !!session);
    const q = query.trim().toLowerCase();

    // Deep link (#account, ?section=…) — jump once after the first paint.
    useEffect(() => {
        const target = initialSection ?? initialSectionFromUrl();
        if (!target) return;
        const id = window.requestAnimationFrame(() => {
            document.getElementById(`settings-${target}`)?.scrollIntoView({ block: 'start' });
        });
        return () => window.cancelAnimationFrame(id);
    }, [initialSection]);

    // Scroll-spy: the section nearest the top of the viewport is "active".
    useEffect(() => {
        const root = contentRef.current;
        if (!root) return;
        const visible = new Map<string, number>();
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    const id = (e.target as HTMLElement).dataset.settingsSection!;
                    if (e.isIntersecting) visible.set(id, e.boundingClientRect.top);
                    else visible.delete(id);
                }
                if (jumping.current || !visible.size) return;
                const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0][0];
                setActive(top as SettingsSectionId);
            },
            { rootMargin: '-15% 0px -60% 0px' },
        );
        root.querySelectorAll('[data-settings-section]').forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, [session, q]);

    // "/" focuses search (when not typing somewhere else).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            e.preventDefault();
            searchRef.current?.focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const jumpTo = (id: SettingsSectionId) => {
        setQuery('');
        setActive(id);
        jumping.current = true;
        window.setTimeout(() => {
            jumping.current = false;
        }, 700);
        window.requestAnimationFrame(() => {
            document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    const content: Record<SettingsSectionId, ReactNode> = {
        account: session?.user ? <AccountSection key={session.user.id} /> : null,
        plan: session?.user ? <PlanSection /> : null,
        appearance: <AppearanceSection />,
        versions: <PageVersionsSection />,
        blocking: <BlockingSection />,
        browsing: <BrowsingSection />,
        youtube: <YouTubeSection />,
        data: <DataSection />,
    };

    return (
        <div className="grid animate-fade-in-up items-start gap-8 lg:grid-cols-[208px_minmax(0,1fr)]">
            {/* Nav */}
            <aside className="min-w-0 lg:sticky lg:top-4">
                <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fz-text-4)]" />
                    <input
                        ref={searchRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setQuery('');
                                searchRef.current?.blur();
                            }
                        }}
                        placeholder="Search settings"
                        aria-label="Search settings"
                        className="h-8 w-full rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] pl-8 pr-8 text-[13px] text-[var(--fz-text-1)] outline-none transition-colors placeholder:text-[var(--fz-text-4)] focus:border-[var(--fz-border-strong)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--fz-focus-ring)]"
                    />
                    {query ? (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            aria-label="Clear search"
                            className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-[var(--fz-text-4)] hover:text-[var(--fz-text-1)]"
                        >
                            <X size={13} />
                        </button>
                    ) : (
                        <Kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">/</Kbd>
                    )}
                </div>
                <nav aria-label="Settings sections" className="mt-3 flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-visible">
                    {sections.map((id) => {
                        const { label, icon: Icon } = NAV[id];
                        const on = !q && active === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => jumpTo(id)}
                                aria-current={on ? 'true' : undefined}
                                className={`flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                                    on
                                        ? 'bg-[var(--fz-bg-active)] font-medium text-[var(--fz-text-1)]'
                                        : 'text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]'
                                }`}
                            >
                                <Icon size={15} strokeWidth={1.9} className="shrink-0" />
                                <span className="flex-1 whitespace-nowrap">{label}</span>
                                {id === 'versions' && legacy > 0 && (
                                    <span className="rounded-full bg-[var(--fz-bg-active)] px-1.5 text-[11px] tabular-nums text-[var(--fz-text-3)]" title={`${legacy} legacy`}>
                                        {legacy}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* Sections */}
            <div ref={contentRef} className="settings-results min-w-0 space-y-8">
                <SettingsSearchContext.Provider value={q}>
                    {sections.map((id) => (
                        <Fragment key={id}>{content[id]}</Fragment>
                    ))}
                </SettingsSearchContext.Provider>
                <div className="settings-empty py-16 text-center">
                    <p className="text-[14px] font-medium text-[var(--fz-text-1)]">No settings match “{query.trim()}”</p>
                    <p className="text-meta mt-1">Try a shorter word, like “theme”, “legacy” or “YouTube”.</p>
                </div>
            </div>
        </div>
    );
}
