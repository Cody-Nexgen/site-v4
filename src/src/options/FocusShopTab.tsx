import { useState } from 'react';
import { useFocusProgression, sendProgressionMessage } from '../hooks/useFocusProgression';
import { SHOP_ITEMS, getShopItem } from '../lib/focusShop';
import { FocusLevelCard } from '../components/FocusLevelCard';

export default function FocusShopTab() {
    const { progression, refresh } = useFocusProgression();
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

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
            setNotice(`Purchased ${getShopItem(itemId)?.name}!`);
            await refresh();
        } else {
            setError(resp.error ?? 'Purchase failed');
        }
    };

    const handleEquip = async (type: 'frame' | 'badge' | 'widget', itemId: string | null) => {
        await sendProgressionMessage({
            type: 'EQUIP_COSMETIC',
            cosmeticType: type,
            itemId,
        });
        await refresh();
    };

    const owned = new Set(progression.ownedCosmetics);

    return (
        <div className="space-y-6 pt-6 animate-fade-in-up max-w-4xl pb-20">
            <div>
                <p className="focuz-section-label">Cosmetics</p>
                <h1 className="text-3xl font-semibold text-white tracking-tight">Focuz Shop</h1>
                <p className="text-sm text-neutral-500 mt-1">
                    Earn coins from real sessions, blocks, and habits. Spend on cosmetics only — never pay-to-win.
                </p>
            </div>

            <FocusLevelCard progression={progression} />

            {notice && (
                <p className="text-sm text-green-400 font-medium">{notice}</p>
            )}
            {error && (
                <p className="text-sm text-red-400 font-medium">{error}</p>
            )}

            <section>
                <h2 className="text-sm font-semibold text-white mb-3">Cosmetics</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SHOP_ITEMS.map((item) => {
                        const isOwned = owned.has(item.id);
                        const isEquipped =
                            progression.equippedCosmetics[item.type] === item.id;

                        return (
                            <div
                                key={item.id}
                                className={`rounded-2xl border bg-[#0c0c0e] p-5 flex flex-col transition-colors duration-150 ${
                                    isEquipped ? 'border-purple-500/40' : 'border-white/[0.06]'
                                }`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-lg">
                                        {item.preview}
                                    </div>
                                    {isOwned && (
                                        <span
                                            className={`text-[10px] font-medium uppercase tracking-wide ${
                                                isEquipped ? 'text-purple-400' : 'text-neutral-500'
                                            }`}
                                        >
                                            {isEquipped ? 'Equipped' : 'Owned'}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-semibold text-white">{item.name}</p>
                                <p className="text-xs text-neutral-500 mt-1 mb-4 flex-1">{item.description}</p>
                                {!isOwned ? (
                                    <button
                                        type="button"
                                        disabled={progression.coins < item.cost}
                                        onClick={() => handlePurchase(item.id, item.cost)}
                                        className="w-full px-4 py-2 rounded-xl bg-white/[0.06] text-neutral-300 text-xs font-semibold hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 tabular-nums"
                                    >
                                        Buy · {item.cost} coins
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleEquip(
                                                item.type,
                                                isEquipped ? null : item.id,
                                            )
                                        }
                                        className={`w-full px-4 py-2 rounded-xl text-xs font-semibold transition-colors duration-150 ${
                                            isEquipped
                                                ? 'bg-purple-500 text-white hover:bg-purple-400'
                                                : 'bg-white text-black hover:bg-neutral-200'
                                        }`}
                                    >
                                        {isEquipped ? 'Unequip' : 'Equip'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
