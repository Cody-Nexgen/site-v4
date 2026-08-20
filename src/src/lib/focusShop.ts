export type ShopItemType = 'frame' | 'badge' | 'widget';

export type ShopItem = {
    id: string;
    name: string;
    description: string;
    type: ShopItemType;
    cost: number;
    /** Short profile mark (badges) or catalog label. */
    mark: string;
    cssClass?: string;
    /** Hex used for preview swatches only. */
    swatch: string;
};

export const SHOP_TYPE_LABELS: Record<ShopItemType, string> = {
    frame: 'Frames',
    badge: 'Marks',
    widget: 'Widget',
};

export const SHOP_ITEMS: ShopItem[] = [
    {
        id: 'frame_minimal',
        name: 'Hairline',
        description: 'A single white edge. Quiet and sharp.',
        type: 'frame',
        cost: 150,
        mark: 'LINE',
        cssClass: 'focus-frame-minimal',
        swatch: '#e8e8ea',
    },
    {
        id: 'frame_neon',
        name: 'Signal',
        description: 'Cool teal rim with a soft outer ring.',
        type: 'frame',
        cost: 250,
        mark: 'SIGNAL',
        cssClass: 'focus-frame-neon',
        swatch: '#6ec8c4',
    },
    {
        id: 'frame_gold',
        name: 'Gilt',
        description: 'Warm metal edge for your level mark.',
        type: 'frame',
        cost: 300,
        mark: 'GILT',
        cssClass: 'focus-frame-gold',
        swatch: '#c4a35a',
    },
    {
        id: 'badge_sprout',
        name: 'Sprout',
        description: 'A small growth mark for your profile.',
        type: 'badge',
        cost: 100,
        mark: 'SPROUT',
        swatch: '#6b9b7a',
    },
    {
        id: 'badge_shield',
        name: 'Aegis',
        description: 'For block streaks and deep sessions.',
        type: 'badge',
        cost: 150,
        mark: 'AEGIS',
        swatch: '#8a9bb0',
    },
    {
        id: 'badge_laser',
        name: 'Vector',
        description: 'High-contrast mark beside your name.',
        type: 'badge',
        cost: 150,
        mark: 'VECTOR',
        swatch: '#d0d0d4',
    },
    {
        id: 'widget_glow',
        name: 'Halo',
        description: 'Soft light around the timer widget.',
        type: 'widget',
        cost: 400,
        mark: 'HALO',
        cssClass: 'focus-widget-glow',
        swatch: '#f2f2f4',
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

/** @deprecated Use badgeMark */
export function badgeEmoji(itemId: string | undefined): string | undefined {
    return badgeMark(itemId);
}

export function shopItemsByType(type: ShopItemType): ShopItem[] {
    return SHOP_ITEMS.filter((item) => item.type === type);
}
