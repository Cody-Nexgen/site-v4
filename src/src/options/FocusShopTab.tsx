import { useMemo, useState } from 'react';
import { useFocusProgression, sendProgressionMessage } from '../hooks/useFocusProgression';
import {
    SHOP_ITEMS,
    SHOP_TYPE_LABELS,
    getShopItem,
    shopItemsByType,
    type ShopItem,
    type ShopItemType,
} from '../lib/focusShop';
import { FocusLevelCard } from '../components/FocusLevelCard';

function ItemPreview({ item }: { item: ShopItem }) {
    if (item.type === 'frame') {
        return (
            <div
                className={`h-14 w-14 rounded-md bg-[#161618] flex items-center justify-center text-sm font-semibold tabular-nums text-neutral-200 ${item.cssClass ?? ''}`}
                aria-hidden
            >
                12
            </div>
        );
    }

    if (item.type === 'badge') {
        return (
            <div
                className="h-14 min-w-[4.5rem] px-2 rounded-md border border-white/[0.1] bg-[#161618] flex items-center justify-center"
                aria-hidden
            >
                <span className="text-[10px] font-semibold tracking-[0.18em] text-neutral-300">
                    {item.mark}
                </span>
            </div>
        );
    }

    return (
        <div
            className={`h-14 w-20 rounded-md border border-white/[0.08] bg-[#161618] flex items-center justify-center ${item.cssClass ?? ''}`}
            aria-hidden
        >
            <div className="h-2 w-10 rounded-full bg-white/25" />
        </div>
    );
}

function ShopRow({
    item,
    owned,
    equipped,
    coins,
    onPurchase,
    onEquip,
}: {
    item: ShopItem;
    owned: boolean;
    equipped: boolean;
    coins: number;
    onPurchase: () => void;
    onEquip: () => void;
}) {
    return (
        <div
            className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-white/[0.06] py-4 last:border-b-0 ${
                equipped ? 'bg-white/[0.02]' : ''
            }`}
        >
            <ItemPreview item={item} />
            <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    {owned && (
                        <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                            {equipped ? 'Equipped' : 'Owned'}
                        </span>
                    )}
                </div>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{item.description}</p>
            </div>
            <div className="shrink-0">
                {!owned ? (
                    <button
                        type="button"
                        disabled={coins < item.cost}
                        onClick={onPurchase}
                        className="min-w-[7.5rem] px-3 py-2 rounded-md border border-white/[0.1] bg-transparent text-xs font-semibold text-neutral-200 hover:bg-white/[0.04] disabled:opacity-35 disabled:cursor-not-allowed tabular-nums"
                    >
                        {item.cost} coins
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onEquip}
                        className={`min-w-[7.5rem] px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                            equipped
                                ? 'border border-white/[0.14] text-neutral-300 hover:bg-white/[0.04]'
                                : 'bg-white text-black hover:bg-neutral-200'
                        }`}
                    >
                        {equipped ? 'Unequip' : 'Equip'}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function FocusShopTab() {
    const { progression, refresh } = useFocusProgression();
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

    const sections = useMemo(
        () => (['frame', 'badge', 'widget'] as ShopItemType[]).map((type) => ({
            type,
            label: SHOP_TYPE_LABELS[type],
            items: shopItemsByType(type),
        })),
        [],
    );

    if (!progression) {
        return (
            <div className="pt-6 text-neutral-500 text-sm animate-pulse">Loading shop…</div>
        );
    }

    const handlePurchase = async (itemId: string, cost: number) => {
        setError('');
        setNotice('');
        const resp = await sendProgressionMessage<{ ok: boolean; error?: string }>({
            type: 'PURCHASE_SHOP_ITEM',
            itemId,
            cost,
        });
        if (resp.ok) {
            setNotice(`Purchased ${getShopItem(itemId)?.name ?? 'item'}.`);
            await refresh();
        } else {
            setError(resp.error ?? 'Purchase failed');
        }
    };

    const handleEquip = async (type: ShopItemType, itemId: string | null) => {
        await sendProgressionMessage({
            type: 'EQUIP_COSMETIC',
            cosmeticType: type,
            itemId,
        });
        await refresh();
    };

    const owned = new Set(progression.ownedCosmetics);

    return (
        <div className="space-y-10 pt-6 animate-fade-in-up max-w-3xl pb-20">
            <header className="border-b border-white/[0.06] pb-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Cosmetics
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Shop</h1>
                <p className="mt-2 max-w-lg text-sm text-neutral-500 leading-relaxed">
                    Coins come from sessions, blocks, and habits. Spend them on frames, profile marks,
                    and widget accents — never on power.
                </p>
            </header>

            <FocusLevelCard progression={progression} />

            {notice && <p className="text-sm text-emerald-400/90">{notice}</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}

            {sections.map((section) => (
                <section key={section.type}>
                    <div className="mb-1 flex items-end justify-between gap-3">
                        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                            {section.label}
                        </h2>
                        <span className="text-[11px] tabular-nums text-neutral-600">
                            {section.items.length}
                        </span>
                    </div>
                    <div className="border-t border-white/[0.08]">
                        {section.items.map((item) => {
                            const isOwned = owned.has(item.id);
                            const isEquipped =
                                progression.equippedCosmetics[item.type] === item.id;
                            return (
                                <ShopRow
                                    key={item.id}
                                    item={item}
                                    owned={isOwned}
                                    equipped={isEquipped}
                                    coins={progression.coins}
                                    onPurchase={() => handlePurchase(item.id, item.cost)}
                                    onEquip={() =>
                                        handleEquip(item.type, isEquipped ? null : item.id)
                                    }
                                />
                            );
                        })}
                    </div>
                </section>
            ))}

            {/* Keep catalog length assertable for debugging without rendering emoji grid */}
            <p className="sr-only">{SHOP_ITEMS.length} items in catalog</p>
        </div>
    );
}
