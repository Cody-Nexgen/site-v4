import { useMemo, useState, type ReactNode } from 'react';
import { Check, Coins, Eye, RotateCcw } from 'lucide-react';
import { getLevelProgress, EVENT_REWARDS } from '../lib/focusProgression';
import { useFocusProgression, sendProgressionMessage } from '../hooks/useFocusProgression';
import { useAuthStore } from '../lib/store';
import { SHOP_ITEMS, getShopItem, type ShopItem, type ShopItemType } from '../lib/focusShop';
import { GlassCard } from './OptionsApp';
import { Banner } from '../components/fz/Banner';
import { Button } from '../components/fz/Button';
import { Dialog } from '../components/fz/Dialog';
import { SegmentedControl } from '../components/fz/SegmentedControl';
import { Skeleton } from '../components/fz/Skeleton';

type Filter = 'all' | ShopItemType;

const TYPE_LABEL: Record<ShopItemType, string> = { frame: 'Frame', badge: 'Mark', widget: 'Timer' };

const EARN = [
    { label: 'Finish a Pomodoro', coins: EVENT_REWARDS.pomodoro_complete.coins },
    { label: 'Check in a habit', coins: EVENT_REWARDS.habit_checkin.coins },
    { label: 'Unlock an achievement', coins: EVENT_REWARDS.achievement_unlock.coins },
    { label: 'Resist a blocked site', coins: EVENT_REWARDS.block_resisted.coins, note: 'up to 10 a day' },
];

/** `frame_neon` → `focus-equipped-frame-neon` (the class the level card uses). */
const frameClassFor = (item?: ShopItem) => (item?.cssClass ? `focus-equipped-${item.id.replace('_', '-')}` : '');

// ---------------------------------------------------------
// Previews — the real cosmetic, drawn flat, not a photo of it
// ---------------------------------------------------------

function LevelMark({ level, frame, size = 56 }: { level: number; frame?: ShopItem; size?: number }) {
    return (
        <span
            className={`flex shrink-0 items-center justify-center rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] font-semibold tabular-nums text-[var(--fz-text-1)] ${frameClassFor(frame)}`}
            style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
            {level}
        </span>
    );
}

function MarkChip({ item }: { item: ShopItem }) {
    return (
        <span
            className="rounded-md border px-1.5 py-px text-[10px] font-semibold tracking-[0.14em]"
            style={{
                // Blend toward the theme's text colour so pale marks stay readable on light surfaces.
                color: `color-mix(in oklab, ${item.swatch} 72%, var(--fz-text-1))`,
                borderColor: `color-mix(in oklab, ${item.swatch} 45%, transparent)`,
                background: `color-mix(in oklab, ${item.swatch} 9%, transparent)`,
            }}
        >
            {item.mark}
        </span>
    );
}

function TimerWidget({ item, compact = false }: { item?: ShopItem; compact?: boolean }) {
    return (
        <div
            className={`rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] text-center ${compact ? 'w-24 px-2.5 py-2.5' : 'w-28 px-3 py-3'} ${item?.cssClass ?? ''}`}
        >
            <p className="text-[10px] text-[var(--fz-text-4)]">Focus</p>
            <p className={`font-semibold tabular-nums text-[var(--fz-text-1)] ${compact ? 'text-lg' : 'text-xl'}`}>24:00</p>
            <div className="mx-auto mt-1.5 h-1 w-14 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                <div className="h-full w-2/3 rounded-full bg-[var(--fz-text-2)]" />
            </div>
        </div>
    );
}

function ItemPreview({ item, level, name }: { item: ShopItem; level: number; name: string }) {
    if (item.type === 'frame') return <LevelMark level={level} frame={item} size={64} />;
    if (item.type === 'badge') {
        return (
            <span className="flex items-center gap-2 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-3 py-2">
                <span className="size-6 rounded-full bg-[var(--fz-bg-active)]" />
                <span className="text-[13px] font-medium text-[var(--fz-text-1)]">{name}</span>
                <MarkChip item={item} />
            </span>
        );
    }
    return <TimerWidget item={item} compact />;
}

// ---------------------------------------------------------
// Page
// ---------------------------------------------------------

export default function FocusShopTab() {
    const { progression, refresh } = useFocusProgression();
    const profileName = useAuthStore((s) => s.engineState.profileUsername || s.engineState.profileName || 'you');
    const [filter, setFilter] = useState<Filter>('all');
    const [tryOn, setTryOn] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<ShopItem | null>(null);
    const [busyId, setBusyId] = useState('');
    const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

    const items = useMemo(() => (filter === 'all' ? SHOP_ITEMS : SHOP_ITEMS.filter((i) => i.type === filter)), [filter]);

    if (!progression) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-44 w-full rounded-xl" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-64 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    const level = getLevelProgress(progression.xp).level;
    const owned = new Set(progression.ownedCosmetics);
    const coins = progression.coins;
    const equipped = progression.equippedCosmetics;
    const trying = tryOn ? getShopItem(tryOn) : undefined;
    // What the look preview shows: the tried-on item in its slot, equipped items elsewhere.
    const look = (type: ShopItemType) => (trying?.type === type ? trying : getShopItem(equipped[type] ?? ''));
    const lookFrame = look('frame');
    const lookMark = look('badge');
    const lookWidget = look('widget');
    const ownedCount = SHOP_ITEMS.filter((i) => owned.has(i.id)).length;

    const equip = async (item: ShopItem, off = false) => {
        setBusyId(item.id);
        await sendProgressionMessage({ type: 'EQUIP_COSMETIC', cosmeticType: item.type, itemId: off ? null : item.id });
        await refresh();
        setBusyId('');
    };

    const buy = async (item: ShopItem) => {
        setBusyId(item.id);
        setBanner(null);
        const resp = await sendProgressionMessage<{ ok: boolean; error?: string }>({
            type: 'PURCHASE_SHOP_ITEM',
            itemId: item.id,
            cost: item.cost,
        });
        if (!resp.ok) {
            setBusyId('');
            setBanner({ ok: false, text: resp.error === 'Not enough coins' ? `You need ${item.cost - coins} more coins for ${item.name}.` : resp.error ?? "Couldn't complete that purchase. Try again." });
            return;
        }
        await sendProgressionMessage({ type: 'EQUIP_COSMETIC', cosmeticType: item.type, itemId: item.id });
        await refresh();
        setBusyId('');
        setConfirm(null);
        if (tryOn === item.id) setTryOn(null);
        setBanner({ ok: true, text: `${item.name} is yours and equipped.` });
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {banner && (
                <Banner tone={banner.ok ? 'info' : 'danger'} onDismiss={() => setBanner(null)}>
                    {banner.text}
                </Banner>
            )}

            {/* Your look + wallet */}
            <GlassCard>
                <div className="grid md:grid-cols-[minmax(0,1fr)_300px] md:divide-x md:divide-[var(--fz-border)]">
                    <div className="p-5">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[14px] font-semibold text-[var(--fz-text-1)]">Your look</p>
                            {trying && (
                                <span className="flex items-center gap-2 text-[12px] text-[var(--fz-text-3)]">
                                    Trying on {trying.name}
                                    <Button size="sm" variant="ghost" iconLeft={<RotateCcw size={12} />} onClick={() => setTryOn(null)}>
                                        Reset
                                    </Button>
                                </span>
                            )}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-6 rounded-lg bg-[var(--fz-bg-hover)] px-5 py-5">
                            <LevelMark level={level} frame={lookFrame} size={72} />
                            <div className="min-w-0">
                                <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--fz-text-1)]">
                                    <span className="truncate">{profileName}</span>
                                    {lookMark && <MarkChip item={lookMark} />}
                                </p>
                                <p className="text-meta mt-0.5">Level {level}</p>
                                <p className="text-meta mt-2">
                                    {[lookFrame?.name && `${lookFrame.name} frame`, lookMark?.name && `${lookMark.name} mark`, lookWidget?.name && `${lookWidget.name} timer`]
                                        .filter(Boolean)
                                        .join(' · ') || 'Nothing equipped yet'}
                                </p>
                            </div>
                            <div className="ml-auto">
                                <TimerWidget item={lookWidget} />
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-[var(--fz-border)] p-5 md:border-t-0">
                        <p className="text-meta">Balance</p>
                        <p className="mt-0.5 flex items-center gap-2 text-[28px] font-semibold leading-8 tabular-nums text-[var(--fz-text-1)]">
                            <Coins size={20} className="text-[var(--fz-text-3)]" />
                            {coins.toLocaleString()}
                        </p>
                        <p className="text-meta mt-1">
                            {ownedCount} of {SHOP_ITEMS.length} collected
                        </p>
                        <ul className="mt-4 space-y-1.5">
                            {EARN.map((e) => (
                                <li key={e.label} className="flex items-baseline justify-between gap-3 text-[12px]">
                                    <span className="text-[var(--fz-text-3)]">
                                        {e.label}
                                        {e.note && <span className="text-[var(--fz-text-4)]"> · {e.note}</span>}
                                    </span>
                                    <span className="shrink-0 font-medium tabular-nums text-[var(--fz-text-2)]">+{e.coins}</span>
                                </li>
                            ))}
                            <li className="flex items-baseline justify-between gap-3 text-[12px]">
                                <span className="text-[var(--fz-text-3)]">Complete a challenge</span>
                                <span className="shrink-0 font-medium text-[var(--fz-text-2)]">varies</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </GlassCard>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl
                    size="sm"
                    idPrefix="shop-filter"
                    value={filter}
                    onChange={setFilter}
                    options={[
                        { value: 'all' as const, label: 'All' },
                        { value: 'frame' as const, label: 'Frames' },
                        { value: 'badge' as const, label: 'Marks' },
                        { value: 'widget' as const, label: 'Timer' },
                    ]}
                />
                <p className="text-meta">{items.length} {items.length === 1 ? 'item' : 'items'}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                    const isOwned = owned.has(item.id);
                    const isOn = equipped[item.type] === item.id;
                    const busy = busyId === item.id;
                    const short = item.cost - coins;
                    let action: ReactNode;
                    if (isOn) {
                        action = (
                            <Button size="sm" loading={busy} iconLeft={<Check size={13} />} onClick={() => void equip(item, true)} title="Take it off">
                                Equipped
                            </Button>
                        );
                    } else if (isOwned) {
                        action = (
                            <Button size="sm" loading={busy} onClick={() => void equip(item)}>
                                Equip
                            </Button>
                        );
                    } else if (short <= 0) {
                        action = (
                            <Button size="sm" variant="primary" onClick={() => setConfirm(item)}>
                                Buy
                            </Button>
                        );
                    } else {
                        action = (
                            <span className="w-28 text-right">
                                <span className="text-meta block tabular-nums">{short.toLocaleString()} more coins</span>
                                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                                    <span className="block h-full rounded-full bg-[var(--fz-text-3)]" style={{ width: `${Math.max(3, (coins / item.cost) * 100)}%` }} />
                                </span>
                            </span>
                        );
                    }
                    return (
                        <GlassCard key={item.id} className={isOn ? 'ring-1 ring-[var(--fz-text-3)]' : ''}>
                            <button
                                type="button"
                                onClick={() => setTryOn(tryOn === item.id ? null : item.id)}
                                aria-pressed={tryOn === item.id}
                                title={isOwned ? 'Show it in your look' : 'Try it on'}
                                className="group relative flex h-36 w-full items-center justify-center border-b border-[var(--fz-border)] bg-[var(--fz-bg-hover)] transition-colors hover:bg-[var(--fz-bg-active)]"
                            >
                                <ItemPreview item={item} level={level} name={profileName} />
                                <span
                                    className={`absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-opacity ${
                                        tryOn === item.id
                                            ? 'bg-[var(--fz-text-1)] text-[var(--fz-bg-app)] opacity-100'
                                            : 'bg-[var(--fz-bg-overlay)] text-[var(--fz-text-2)] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                                    }`}
                                >
                                    <Eye size={11} />
                                    {tryOn === item.id ? 'Trying on' : 'Try on'}
                                </span>
                            </button>
                            <div className="flex items-end justify-between gap-3 p-4">
                                <div className="min-w-0">
                                    <p className="text-meta">{TYPE_LABEL[item.type]}</p>
                                    <p className="text-[14px] font-semibold text-[var(--fz-text-1)]">{item.name}</p>
                                    <p className="text-meta mt-0.5 line-clamp-2">{item.description}</p>
                                    {!isOwned && (
                                        <p className="mt-2 flex items-center gap-1 text-[13px] font-medium tabular-nums text-[var(--fz-text-2)]">
                                            <Coins size={13} className="text-[var(--fz-text-4)]" />
                                            {item.cost.toLocaleString()}
                                        </p>
                                    )}
                                    {isOwned && !isOn && <p className="text-meta mt-2">Owned</p>}
                                </div>
                                <div className="shrink-0">{action}</div>
                            </div>
                        </GlassCard>
                    );
                })}
            </div>

            <Dialog
                open={!!confirm}
                onClose={() => busyId === '' && setConfirm(null)}
                title={confirm ? `Buy ${confirm.name}?` : 'Buy item?'}
                size="sm"
                footer={
                    confirm && (
                        <>
                            <Button variant="ghost" disabled={busyId !== ''} onClick={() => setConfirm(null)}>
                                Cancel
                            </Button>
                            <Button variant="primary" loading={busyId === confirm.id} onClick={() => void buy(confirm)} data-autofocus>
                                Buy and equip
                            </Button>
                        </>
                    )
                }
            >
                {confirm && (
                    <div className="flex items-center gap-4">
                        <div className="flex h-24 w-32 shrink-0 items-center justify-center rounded-lg bg-[var(--fz-bg-hover)]">
                            <ItemPreview item={confirm} level={level} name={profileName} />
                        </div>
                        <div className="text-body-sm text-[var(--fz-text-2)]">
                            <p className="flex items-center gap-1 font-medium tabular-nums text-[var(--fz-text-1)]">
                                <Coins size={13} className="text-[var(--fz-text-4)]" />
                                {confirm.cost.toLocaleString()} coins
                            </p>
                            <p className="text-meta mt-1">You'll have {(coins - confirm.cost).toLocaleString()} left.</p>
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
}
