import { StrictMode, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/focuzDesign.css';
import './mockChrome';
import OptionsApp from './options/OptionsApp';
import SmartYouTubeModal from './components/SmartYouTubeModal';
import ForestStatsModal from './components/ForestStatsModal';
import DeleteAccountModal from './components/DeleteAccountModal';
import { DailyFocusMirrorModal } from './components/DailyFocusMirrorModal';
import { BookingNotificationModal } from './components/BookingNotificationModal';
import { normalizeSmartYouTube } from './lib/youtubeSmartMode';
import { useAuthStore } from './lib/store';
import { WorkspaceSidebarV2 } from './options/WorkspaceSidebarV2';
import { useSidebarController } from './lib/sidebar';
import { setDashboardColorMode, initializeDashboardColorMode, applyDocumentTheme } from './lib/themes';
import { ACCENTS, accentHueFor, applyAccentHue } from './lib/accents';
import { Button } from './components/fz/Button';
import { IconButton } from './components/fz/IconButton';
import { Dialog } from './components/fz/Dialog';
import { Sheet } from './components/fz/Sheet';
import { Popover } from './components/fz/Popover';
import { Menu, type MenuItem } from './components/fz/Menu';
import { Tooltip } from './components/fz/Tooltip';
import { Switch } from './components/fz/Switch';
import { Checkbox } from './components/fz/Checkbox';
import { SegmentedControl } from './components/fz/SegmentedControl';
import { Field, Input, Textarea, Select } from './components/fz/Field';
import { Chip } from './components/fz/Chip';
import { Card } from './components/fz/Card';
import { Row } from './components/fz/Row';
import { SectionHeader } from './components/fz/SectionHeader';
import { EmptyState } from './components/fz/EmptyState';
import { Kbd } from './components/fz/Kbd';
import { ToastProvider, useToast } from './components/fz/Toast';
import { Skeleton } from './components/fz/Skeleton';
import { Banner } from './components/fz/Banner';
import { ProgressRing } from './components/fz/ProgressRing';
import { Stat } from './components/fz/Stat';
import { Tabs } from './components/fz/Tabs';
import {
    IconPanelLeftOpen, IconSearch, IconExternalLink, IconSparkle, IconInfo,
} from './components/fz/icons';

void initializeDashboardColorMode();
applyDocumentTheme(null, false);

function GallerySection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="mb-8">
            <h2 className="text-title-3 mb-3 text-[var(--fz-text-1)]">{title}</h2>
            <div className="flex flex-wrap items-center gap-3">{children}</div>
        </section>
    );
}

function PrimitivesGallery() {
    const q = new URLSearchParams(window.location.search);
    const [dialogOpen, setDialogOpen] = useState(q.get('dialog') === '1');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(q.get('menu') === '1');
    const [sw, setSw] = useState(true);
    const [cb, setCb] = useState(true);
    const [seg, setSeg] = useState('a');
    const [tab, setTab] = useState('one');
    const popRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLButtonElement>(null);
    const { toast } = useToast();

    const menuItems: MenuItem[] = [
        { id: 'a', label: 'First action', icon: <IconSparkle size={14} />, shortcut: '⌘1', onSelect: () => {} },
        { id: 'b', label: 'Second action', checked: true, onSelect: () => {} },
        { type: 'separator', id: 's' },
        { id: 'c', label: 'Danger action', danger: true, onSelect: () => {} },
    ];

    return (
        <div className="p-8 pb-28">
            <h1 className="text-display mb-1 text-[var(--fz-text-1)]">FZ primitives</h1>
            <p className="text-body-sm mb-8 text-[var(--fz-text-3)]">Every shared primitive, one screen.</p>

            <GallerySection title="Buttons">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Default</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="danger-solid">Danger solid</Button>
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="secondary" loading>Loading</Button>
                <IconButton icon={<IconSparkle />} tooltip="Icon button" />
                <Tooltip content="Tooltip" shortcut="⌘T"><IconButton icon={<IconInfo />} tooltip="Tooltip target" /></Tooltip>
            </GallerySection>

            <GallerySection title="Inputs">
                <div className="w-72 space-y-3">
                    <Field label="Email" helper="Used for sign-in"><Input placeholder="you@example.com" /></Field>
                    <Field label="Notes"><Textarea placeholder="Write something…" /></Field>
                    <Field label="Plan"><Select aria-label="Plan" options={[{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }]} value="free" onChange={() => {}} /></Field>
                </div>
                <div className="space-y-3">
                    <Switch checked={sw} onCheckedChange={setSw} />
                    <label className="flex items-center gap-2 text-[13px] text-[var(--fz-text-2)]">
                        <Checkbox checked={cb} onCheckedChange={setCb} /> Remember me
                    </label>
                    <SegmentedControl value={seg} onChange={setSeg} options={[{ value: 'a', label: 'Daily' }, { value: 'b', label: 'Weekly' }, { value: 'c', label: 'Monthly' }]} />
                </div>
            </GallerySection>

            <GallerySection title="Surfaces">
                <Card pad="md" className="w-64">
                    <SectionHeader label="Section" action={<Button variant="ghost" size="sm">Edit</Button>} />
                    <Row leading={<IconSparkle size={14} />} title="A row" meta="With description" trailing={<Chip>New</Chip>} />
                    <Row title="Another row" trailing={<Kbd>⌘K</Kbd>} />
                </Card>
                <Card pad="md" className="w-64">
                    <Stat value="4h 12m" label="Focus today" delta="+12%" deltaTone="good" />
                    <div className="mt-3 flex items-center gap-4">
                        <ProgressRing value={0.72}><span className="text-meta">72%</span></ProgressRing>
                        <Skeleton className="h-4 w-24" />
                    </div>
                </Card>
                <div className="w-64 space-y-2">
                    <Banner tone="info" title="Heads up">This is an info banner.</Banner>
                    <EmptyState icon={<IconInfo size={16} />} title="Nothing here" description="Create your first item." action={<Button size="sm">Create</Button>} />
                </div>
            </GallerySection>

            <GallerySection title="Chips & tabs">
                <Chip>Default</Chip>
                <Chip selected>Selected</Chip>
                <Chip icon={<IconSparkle size={12} />}>With icon</Chip>
                <Chip selected icon={<IconSparkle size={12} />}>Selected + icon</Chip>
                <Tabs
                    value={tab}
                    onChange={setTab}
                    tabs={[
                        { value: 'one', label: 'First' },
                        { value: 'two', label: 'Second' },
                        { value: 'three', label: 'Third' },
                    ]}
                />
            </GallerySection>

            <GallerySection title="Overlays">
                <Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
                <Button onClick={() => setSheetOpen(true)} variant="secondary">Open Sheet</Button>
                <Button ref={popRef} onClick={() => setPopoverOpen(true)} variant="secondary">Open Popover</Button>
                <Button ref={menuRef} onClick={() => setMenuOpen(true)} variant="secondary">Open Menu</Button>
                <Button onClick={() => toast('Saved successfully', { action: { label: 'Undo', onClick: () => {} } })} variant="secondary">Show Toast</Button>
                <Popover open={popoverOpen} onClose={() => setPopoverOpen(false)} anchor={popRef}>
                    <div className="p-3 text-body-sm text-[var(--fz-text-2)]">Popover content</div>
                </Popover>
                <Menu open={menuOpen} onClose={() => setMenuOpen(false)} anchor={menuRef} items={menuItems} />
            </GallerySection>

            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                title="Example dialog"
                description="Focus-trapped, Esc to close, restores focus."
                size="md"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button variant="primary" onClick={() => setDialogOpen(false)}>Confirm</Button>
                    </>
                }
            >
                <p className="text-body-sm text-[var(--fz-text-2)]">Dialog body content with a sticky footer below.</p>
            </Dialog>

            <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Example sheet">
                <p className="text-body-sm text-[var(--fz-text-2)]">Sheet content slides in from the edge.</p>
            </Sheet>
        </div>
    );
}

function App() {
    const q = new URLSearchParams(window.location.search);
    const [tab, setTab] = useState('overview');
    const [pro, setPro] = useState(q.get('pro') === '1');
    const [showGallery, setShowGallery] = useState(q.get('gallery') === '1');
    const [light, setLight] = useState(q.get('light') === '1');
    const toastFired = useRef(false);
    const { toast } = useToast();
    const qMode = q.get('mode');
    const sidebar = useSidebarController(
        true,
        qMode === 'rail' || qMode === 'hidden' || qMode === 'expanded'
            ? qMode
            : q.get('peek') === '1' ? 'hidden' : undefined,
    );

    useEffect(() => {
        if (q.get('peek') === '1') {
            sidebar.forcePeek();
        }
        if (q.get('light') === '1') void setDashboardColorMode('light');
        if (q.get('toast') === '1' && !toastFired.current) {
            toastFired.current = true;
            toast('Saved successfully', { action: { label: 'Undo', onClick: () => {} } });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sidebarProps = {
        activeTab: tab,
        username: 'compooteriolyt',
        email: 'compooteriolyt@focuznow.com',
        isPro: pro,
        onNavigate: (t: string) => { setTab(t); sidebar.onPeekNavigate(); },
        onOpenPalette: () => {},
        onUpgrade: () => {},
        onSignOut: () => {},
        defaultAccountOpen: q.get('accountmenu') === '1',
        defaultWhatsNewExpanded: q.get('whatsnew') === 'open',
    };

    return (
        <div className={`focuz-dashboard focuz-dashboard-shell min-h-screen ${sidebar.shellClass}`} style={sidebar.shellStyle}>
            <WorkspaceSidebarV2
                {...sidebarProps}
                mode={sidebar.mode}
                onToggleCollapse={() => sidebar.setMode('rail')}
            />
            {sidebar.mode !== 'hidden' && (
                <div {...sidebar.handleProps} className="sb-resize" />
            )}
            {sidebar.peekEnabled && (
                <>
                    <div className="sb-peek-hotzone" {...sidebar.hotzoneProps} />
                    <div className="sb-peek" data-open={sidebar.peekOpen} {...sidebar.peekProps}>
                        <WorkspaceSidebarV2 {...sidebarProps} mode="peek" onPin={sidebar.pinPeek} />
                    </div>
                </>
            )}

            <main className="workspace-main flex flex-col min-w-0 relative overflow-hidden">
                <header className="workspace-topbar h-11 shrink-0 px-4 flex items-center justify-between gap-4 sticky top-0 z-50">
                    <div className="flex min-w-0 items-center gap-2">
                        <IconButton
                            icon={<IconPanelLeftOpen />}
                            tooltip="Show sidebar"
                            tooltipSide="bottom"
                            data-visible={sidebar.mode === 'hidden' || sidebar.narrow}
                            className="tb-show-sidebar"
                            onClick={sidebar.narrow ? sidebar.openOverlay : () => sidebar.setMode('expanded')}
                        />
                        <span className="text-title-3 truncate text-[var(--fz-text-1)]">{showGallery ? 'Primitives' : 'Dashboard'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" className="hidden h-7 items-center gap-2 rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] pl-2.5 pr-1.5 text-[12px] text-[var(--fz-text-3)] sm:flex">
                            <IconSearch size={12} />
                            <span>Search</span>
                            <Kbd className="ml-4">⌘ K</Kbd>
                        </button>
                        <IconButton icon={<IconExternalLink size={14} />} tooltip="Open web dashboard" tooltipSide="bottom" />
                        {!pro && <Button variant="ghost" size="sm">Upgrade</Button>}
                    </div>
                </header>

                <div className="w-full overflow-y-auto scrollbar-hide">
                    {showGallery ? <PrimitivesGallery /> : (
                        <div className="mx-auto max-w-[1120px] px-6 pb-16 pt-6">
                            <div className="grid grid-cols-2 gap-4">
                                <Card pad="md"><Stat value="6h 04m" label="Focus this week" delta="+8%" deltaTone="good" /></Card>
                                <Card pad="md"><Stat value="18" label="Sessions" delta="-2" deltaTone="bad" /></Card>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Harness controls */}
            <div className="fixed bottom-3 right-3 z-[70] flex flex-wrap items-center justify-end gap-1.5 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] p-2 shadow-[var(--fz-shadow-2)] max-w-[520px]">
                {(['expanded', 'rail', 'hidden'] as const).map((m) => (
                    <Button key={m} size="sm" variant={sidebar.mode === m ? 'primary' : 'ghost'} onClick={() => sidebar.setMode(m)}>{m}</Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => { if (sidebar.mode !== 'hidden') sidebar.setMode('hidden'); sidebar.forcePeek(); }}>peek</Button>
                <Button
                    size="sm"
                    variant={light ? 'primary' : 'ghost'}
                    onClick={() => { setLight((v) => !v); void setDashboardColorMode(light ? 'dark' : 'light'); }}
                >
                    {light ? 'light' : 'dark'}
                </Button>
                <Button size="sm" variant={pro ? 'primary' : 'ghost'} onClick={() => setPro((v) => !v)}>{pro ? 'pro' : 'free'}</Button>
                <Button size="sm" variant={showGallery ? 'primary' : 'ghost'} onClick={() => setShowGallery((v) => !v)}>gallery</Button>
                {ACCENTS.map((a) => (
                    <button
                        key={a.id}
                        type="button"
                        aria-label={`Accent ${a.label}`}
                        title={a.label}
                        onClick={() => applyAccentHue(accentHueFor(a.id))}
                        className="size-4 rounded-full border border-white/20"
                        style={{ background: `oklch(0.68 0.15 ${a.hue})` }}
                    />
                ))}
            </div>
        </div>
    );
}

// ?app=1 renders the real OptionsApp inside the real shell (tabs via ?tab=,
// dialogs via ?click=<css selector> clicked after mount). Otherwise the
// standalone sidebar/gallery harness renders.
const previewQ = new URLSearchParams(window.location.search);
if (previewQ.get('light') === '1') void setDashboardColorMode('light');
if (previewQ.get('app') === '1') {
    // checkSession() skips fetchEngineState when Supabase is configured (sync
    // path); in the harness there's no backend, so pull the mock engine state
    // once the store has initialized.
    window.setTimeout(() => {
        const s = useAuthStore.getState();
        void s.fetchEngineState().then(() => s.refreshStats());
    }, 400);
}

if (previewQ.get('palette') === '1') {
    const query = previewQ.get('paletteQuery') ?? '';
    window.setTimeout(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        if (query) {
            window.setTimeout(() => {
                const input = document.querySelector<HTMLInputElement>('input[placeholder*="command" i]');
                if (input) {
                    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
                    setter.call(input, query);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, 150);
        }
    }, 1000);
}

if (previewQ.get('click')) {
    const selector = previewQ.get('click')!;
    const delay = Number(previewQ.get('clickDelay') ?? 1200);
    window.setTimeout(() => {
        const el = document.querySelector<HTMLElement>(selector);
        el?.click();
        const sel2 = previewQ.get('click2');
        if (sel2) {
            window.setTimeout(() => document.querySelector<HTMLElement>(sel2)?.click(), 400);
        }
    }, delay);
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ToastProvider>
            {previewQ.get('app') === '1' ? <OptionsApp /> : <App />}
            {previewQ.get('app') === '1' && previewQ.get('dialog') === 'smart-youtube' && (
                <SmartYouTubeModal
                    open
                    onClose={() => { }}
                    onSave={async () => { }}
                    settings={normalizeSmartYouTube({ enabled: true, blockShorts: true, blockedCategoryIds: ['10', '20', '23', '24'] })}
                />
            )}
            {previewQ.get('dialog') === 'forest-stats' && (
                <ForestStatsModal
                    open
                    onClose={() => { }}
                    fmtClean={(m) => `${Math.floor(m / 60)}h ${m % 60}m`}
                    display={{
                        trees: new Array(14).fill(null).map((_, i) => ({
                            id: `t${i}`, species: 'pine', plantedAt: Date.now() - i * 86400000,
                            gx: i % 7, gy: Math.floor(i / 7),
                            cleanMinutes: 300 + i * 60, displayMinutes: 300 + i * 60,
                            stageIndex: Math.min(4, i % 5), stageKey: 'mature', progress: 0.4,
                        })) as never,
                        multiplier: 1, recoveryRemainingMin: 0, totalCleanMinutes: 4520, matureCount: 6, slipsToday: 0,
                    }}
                />
            )}
            {previewQ.get('dialog') === 'delete-account' && (
                <DeleteAccountModal
                    open
                    email="dev@focuznow.com"
                    googleSignIn={false}
                    onClose={() => { }}
                    onConfirm={async () => ({ ok: true })}
                />
            )}
            {previewQ.get('dialog') === 'daily-mirror' && (
                <DailyFocusMirrorModal
                    onClose={() => { }}
                    mirror={{
                        id: 'm1', date: 'Yesterday', generatedAt: Date.now(),
                        plannedMinutes: 180, completedMinutes: 137, biggestDistraction: 'youtube.com',
                        projectedDelayDays: 2, overrideCount: 1, blockCount: 9, promiseCount: 2,
                        contractGoal: 'Finish the physics problem set without YouTube breaks.',
                    }}
                />
            )}
            {previewQ.get('dialog') === 'booking' && (
                <BookingNotificationModal
                    onDismiss={() => { }}
                    onView={() => { }}
                    bookings={[{
                        id: 'b1', slug: 'coffee-chat', booking_date: new Date().toISOString().slice(0, 10),
                        start_min: 14 * 60, duration_min: 30, guest_name: 'Maya Chen',
                        guest_email: 'maya@example.com', guest_phone: null, guest_details: 'Looking forward to it!',
                        link_title: 'Coffee chat', link_payload: {}, created_at: new Date().toISOString(),
                    }]}
                />
            )}
        </ToastProvider>
    </StrictMode>,
);
