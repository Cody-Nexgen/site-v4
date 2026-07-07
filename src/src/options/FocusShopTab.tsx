import { useState } from 'react';
import { GlassCard } from './OptionsApp';
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
        <div className="space-y-8 pt-6 animate-fade-in-up max-w-4xl pb-20">
            <div>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Cosmetics</p>
                <h1 className="text-4xl font-black text-white tracking-tighter">Focus Shop</h1>
                <p className="text-neutral-400 mt-2 text-sm">
                    Earn coins by focusing. Spend on cosmetics only — never pay-to-win.
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
                <h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-4">Shop</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SHOP_ITEMS.map((item) => {
                        const isOwned = owned.has(item.id);
                        const isEquipped =
                            progression.equippedCosmetics[item.type] === item.id;

                        return (
                            <GlassCard key={item.id} className="p-5 flex flex-col">
                                <div className="text-3xl mb-3">{item.preview}</div>
                                <p className="text-sm font-black text-white">{item.name}</p>
                                <p className="text-[11px] text-neutral-500 mt-1 mb-4 flex-1">{item.description}</p>
                                <div className="flex items-center justify-between gap-2">
                                    {!isOwned ? (
                                        <button
                                            type="button"
                                            disabled={progression.coins < item.cost}
                                            onClick={() => handlePurchase(item.id, item.cost)}
                                            className="flex-1 py-2.5 rounded-xl text-xs font-black bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                        >
                                            🪙 {item.cost}
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
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                                                isEquipped
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                                            }`}
                                        >
                                            {isEquipped ? 'Equipped' : 'Equip'}
                                        </button>
                                    )}
                                    {isOwned && (
                                        <span className="text-[10px] text-green-400 font-bold uppercase">Owned</span>
                                    )}
                                </div>
                            </GlassCard>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
