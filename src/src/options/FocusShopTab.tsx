import { useMemo, useState } from 'react';
import { getLevelProgress } from '../lib/focusProgression';
import { useFocusProgression, sendProgressionMessage } from '../hooks/useFocusProgression';
import {
    SHOP_ITEMS,
    SHOP_TYPE_LABELS,
    getShopItem,
    shopCoverUrl,
    type ShopItem,
    type ShopItemType,
} from '../lib/focusShop';

const CARD =
    'rounded-2xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface-raised)]';
const PRIMARY_BTN =
    'px-3.5 py-2 rounded-xl bg-[var(--dashboard-text)] text-[var(--dashboard-bg)] text-xs font-semibold hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed';
const GHOST_BTN =
    'px-3.5 py-2 rounded-xl bg-[var(--dashboard-interactive)] text-[var(--dashboard-text-secondary)] text-xs font-semibold hover:bg-[var(--dashboard-interactive-hover)]';

type Filter = 'all' | ShopItemType;

function LevelMark({
    level,
    frameClass,
    size = 'md',
}: {
    level: number;
    frameClass?: string;
    size?: 'md' | 'lg';
}) {
    const box =
        size === 'lg'
            ? 'h-20 w-20 text-3xl rounded-2xl'
            : 'h-14 w-14 text-xl rounded-xl';
    return (
        <div
            className={`${box} flex items-center justify-center font-semibold tabular-nums text-[var(--dashboard-text)] bg-[var(--dashboard-interactive)] border border-[var(--dashboard-border)] ${frameClass ?? ''}`}
        >
            {level}
        </div>
    );
}

function FramePreview({ item, level }: { item: ShopItem; level: number }) {
    return (
        <div className="flex h-full min-h-[9.5rem] items-center justify-center bg-[var(--dashboard-interactive)]">
            <LevelMark level={level} frameClass={item.cssClass} size="lg" />
        </div>
    );
}

function BadgePreview({ item }: { item: ShopItem }) {
    return (
        <div className="flex h-full min-h-[9.5rem] items-center justify-center bg-[var(--dashboard-interactive)]">
            <span
                className="rounded-lg border px-3 py-2 text-[11px] font-semibold tracking-[0.22em]"
                style={{
                    borderColor: `${item.swatch}55`,
                    color: item.swatch,
                    background: `${item.swatch}12`,
                }}
            >
                {item.mark}
            </span>
        </div>
    );
}

function WidgetPreview({ item }: { item: ShopItem }) {
    return (
        <div className="flex h-full min-h-[9.5rem] items-center justify-center bg-[var(--dashboard-interactive)]">
            <div
                className={`w-28 rounded-2xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface-raised)] px-3 py-4 text-center ${item.cssClass ?? ''}`}
            >
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--dashboard-text-muted)]">
                    Focus
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--dashboard-text)]">
                    24:00
                </p>
                <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-[var(--dashboard-border)]">
                    <div className="h-full w-2/3 rounded-full" style={{ background: item.swatch }} />
                </div>
            </div>
        </div>
    );
}

function ProductPreview({ item, level }: { item: ShopItem; level: number }) {
    const cover = shopCoverUrl(item.id);
    if (cover) {
        return (
            <div className="relative min-h-[11rem] overflow-hidden bg-[#0a0a0b]">
                <img
                    src={cover}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
            </div>
        );
    }
    if (item.type === 'frame') return <FramePreview item={item} level={level} />;
    if (item.type === 'badge') return <BadgePreview item={item} />;
    return <WidgetPreview item={item} />;
}

function ProductCard({
    item,
    level,
    owned,
    equipped,
    canAfford,
    busy,
    onBuy,
    onEquip,
}: {
    item: ShopItem;
    level: number;
    owned: boolean;
    equipped: boolean;
    canAfford: boolean;
    busy: boolean;
    onBuy: () => void;
    onEquip: () => void;
}) {
    return (
        <article
            className={`${CARD} overflow-hidden transition-[border-color,box-shadow] ${
                equipped ? 'border-[var(--dashboard-text-secondary)]' : ''
            }`}
        >
            <div className="relative">
                <ProductPreview item={item} level={level} />
                <div className="absolute left-3 top-3 flex gap-1.5">
                    <span className="rounded-md bg-[var(--dashboard-surface-raised)]/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dashboard-text-muted)] backdrop-blur-sm">
                        {SHOP_TYPE_LABELS[item.type]}
                    </span>
                    {equipped && (
                        <span className="rounded-md bg-[var(--dashboard-text)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dashboard-bg)]">
                            On
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--dashboard-text)]">{item.name}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--dashboard-text-muted)]">
                            {item.description}
                        </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--dashboard-text)]">
                        {item.cost}
                        <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-[var(--dashboard-text-muted)]">
                            coins
                        </span>
                    </p>
                </div>

                {!owned ? (
                    <button
                        type="button"
                        disabled={!canAfford || busy}
                        onClick={onBuy}
                        className={`w-full ${PRIMARY_BTN}`}
                    >
                        {canAfford ? 'Buy' : 'Need more coins'}
                    </button>
                ) : (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onEquip}
                        className={`w-full ${equipped ? GHOST_BTN : PRIMARY_BTN}`}
                    >
                        {equipped ? 'Remove' : 'Equip'}
                    </button>
                )}
            </div>
        </article>
    );
}

export default function FocusShopTab() {
    const { progression, refresh } = useFocusProgression();
    const [filter, setFilter] = useState<Filter>('all');
    const [busyId, setBusyId] = useState('');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

    const items = useMemo(
        () => (filter === 'all' ? SHOP_ITEMS : SHOP_ITEMS.filter((item) => item.type === filter)),
        [filter],
    );

    if (!progression) {
        return (
            <div className="pt-6 text-sm text-[var(--dashboard-text-muted)] animate-pulse">
                Loading shop…
            </div>
        );
    }

    const progress = getLevelProgress(progression.xp);
    const owned = new Set(progression.ownedCosmetics);
    const equippedFrame = getShopItem(progression.equippedCosmetics.frame ?? '');
    const equippedBadge = getShopItem(progression.equippedCosmetics.badge ?? '');
    const equippedWidget = getShopItem(progression.equippedCosmetics.widget ?? '');
    const frameClass = equippedFrame?.cssClass
        ? `focus-equipped-${equippedFrame.id.replace('_', '-')}`
        : '';

    const handlePurchase = async (item: ShopItem) => {
        setError('');
        setNotice('');
        setBusyId(item.id);
        const resp = await sendProgressionMessage<{ ok: boolean; error?: string }>({
            type: 'PURCHASE_SHOP_ITEM',
            itemId: item.id,
            cost: item.cost,
        });
        setBusyId('');
        if (resp.ok) {
            setNotice(`Added ${item.name} to your inventory.`);
            await refresh();
        } else {
            setError(resp.error ?? 'Purchase failed');
        }
    };

    const handleEquip = async (item: ShopItem, unequip: boolean) => {
        setBusyId(item.id);
        await sendProgressionMessage({
            type: 'EQUIP_COSMETIC',
            cosmeticType: item.type,
            itemId: unequip ? null : item.id,
        });
        setBusyId('');
        await refresh();
    };

    const filters: { id: Filter; label: string }[] = [
        { id: 'all', label: 'All' },
        { id: 'frame', label: 'Frames' },
        { id: 'badge', label: 'Marks' },
        { id: 'widget', label: 'Widget' },
    ];

    return (
        <div className="max-w-4xl space-y-8 pt-6 pb-20 animate-fade-in-up">
            <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="focuz-section-label">Studio</p>
                    <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--dashboard-text)]">
                        Shop
                    </h1>
                    <p className="mt-2 max-w-md text-sm text-[var(--dashboard-text-muted)]">
                        Cosmetics only. Coins come from real sessions — nothing here changes focus power.
                    </p>
                </div>
                <div className="text-left sm:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--dashboard-text-muted)]">
                        Balance
                    </p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--dashboard-text)]">
                        {progression.coins.toLocaleString()}
                    </p>
                </div>
            </header>

            <section className={`${CARD} p-5 sm:p-6`}>
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <LevelMark
                            level={progress.level}
                            frameClass={frameClass}
                            size="lg"
                        />
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--dashboard-text-muted)]">
                                Your look
                            </p>
                            <p className="mt-1 text-lg font-semibold text-[var(--dashboard-text)]">
                                Level {progress.level}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                {equippedBadge ? (
                                    <span
                                        className="rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em]"
                                        style={{
                                            borderColor: `${equippedBadge.swatch}55`,
                                            color: equippedBadge.swatch,
                                        }}
                                    >
                                        {equippedBadge.mark}
                                    </span>
                                ) : (
                                    <span className="text-xs text-[var(--dashboard-text-muted)]">
                                        No mark equipped
                                    </span>
                                )}
                                {equippedWidget && (
                                    <span className="text-xs text-[var(--dashboard-text-muted)]">
                                        · {equippedWidget.name} on timer
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="sm:max-w-[14rem]">
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--dashboard-interactive)]">
                            <div
                                className="h-full rounded-full bg-[var(--dashboard-text-secondary)] transition-all"
                                style={{ width: `${progress.progressPct}%` }}
                            />
                        </div>
                        <p className="mt-2 text-xs tabular-nums text-[var(--dashboard-text-muted)]">
                            {progress.xp.toLocaleString()} XP · {progress.progressPct}% to next
                        </p>
                    </div>
                </div>
            </section>

            {(notice || error) && (
                <p className={`text-sm ${error ? 'text-red-400' : 'text-emerald-500'}`}>
                    {error || notice}
                </p>
            )}

            <div className="flex gap-1 border-b border-[var(--dashboard-border)]">
                {filters.map((entry) => {
                    const active = filter === entry.id;
                    return (
                        <button
                            key={entry.id}
                            type="button"
                            onClick={() => setFilter(entry.id)}
                            className={`-mb-px px-3 py-2.5 text-xs font-semibold transition-colors ${
                                active
                                    ? 'border-b-2 border-[var(--dashboard-text)] text-[var(--dashboard-text)]'
                                    : 'border-b-2 border-transparent text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text-secondary)]'
                            }`}
                        >
                            {entry.label}
                        </button>
                    );
                })}
            </div>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                    const isOwned = owned.has(item.id);
                    const isEquipped = progression.equippedCosmetics[item.type] === item.id;
                    return (
                        <ProductCard
                            key={item.id}
                            item={item}
                            level={progress.level}
                            owned={isOwned}
                            equipped={isEquipped}
                            canAfford={progression.coins >= item.cost}
                            busy={busyId === item.id}
                            onBuy={() => void handlePurchase(item)}
                            onEquip={() => void handleEquip(item, isEquipped)}
                        />
                    );
                })}
            </section>
        </div>
    );
}
