export type ShopItemType = 'frame' | 'badge' | 'widget';

export type ShopItem = {
    id: string;
    name: string;
    description: string;
    type: ShopItemType;
    cost: number;
    /** Short mark shown in UI instead of emoji (e.g. "GOLD"). */
    mark: string;
    cssClass?: string;
};

export const SHOP_TYPE_LABELS: Record<ShopItemType, string> = {
    frame: 'Frames',
    badge: 'Badges',
    widget: 'Widgets',
};

export const SHOP_ITEMS: ShopItem[] = [
    {
        id: 'frame_gold',
        name: 'Gold Frame',
        description: 'Warm metal edge for your level mark',
        type: 'frame',
        cost: 300,
        mark: 'GOLD',
        cssClass: 'focus-frame-gold',
    },
    {
        id: 'frame_neon',
        name: 'Signal Frame',
        description: 'Cool cyan edge with a soft outer ring',
        type: 'frame',
        cost: 250,
        mark: 'SIGNAL',
        cssClass: 'focus-frame-neon',
    },
    {
        id: 'frame_minimal',
        name: 'Line Frame',
        description: 'Thin white outline, nothing else',
        type: 'frame',
        cost: 150,
        mark: 'LINE',
        cssClass: 'focus-frame-minimal',
    },
    {
        id: 'badge_laser',
        name: 'Laser Mark',
        description: 'Shown beside your name on your profile',
        type: 'badge',
        cost: 150,
        mark: 'LASER',
    },
    {
        id: 'badge_shield',
        name: 'Shield Mark',
        description: 'For long block streaks and deep sessions',
        type: 'badge',
        cost: 150,
        mark: 'SHIELD',
    },
    {
        id: 'badge_sprout',
        name: 'Sprout Mark',
        description: 'Quiet nod to forest growth',
        type: 'badge',
        cost: 100,
        mark: 'SPROUT',
    },
    {
        id: 'widget_glow',
        name: 'Soft Glow',
        description: 'Gentle halo on the timer widget',
        type: 'widget',
        cost: 400,
        mark: 'GLOW',
        cssClass: 'focus-widget-glow',
    },
];

export function getShopItem(id: string): ShopItem | undefined {
    return SHOP_ITEMS.find((item) => item.id === id);
}

export function frameCssClass(itemId: string | undefined): string | undefined {
    return getShopItem(itemId ?? '')?.cssClass;
}

export function badgeMark(itemId: string | undefined): string | undefined {
    return getShopItem(itemId ?? '')?.mark;
}

/** @deprecated Use badgeMark — kept for older call sites. */
export function badgeEmoji(itemId: string | undefined): string | undefined {
    return badgeMark(itemId);
}

export function shopItemsByType(type: ShopItemType): ShopItem[] {
    return SHOP_ITEMS.filter((item) => item.type === type);
}
