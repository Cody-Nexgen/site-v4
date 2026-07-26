export type ShopItemType = 'frame' | 'badge' | 'widget';

export type ShopItem = {
    id: string;
    name: string;
    description: string;
    type: ShopItemType;
    cost: number;
    preview: string;
    cssClass?: string;
};

export const SHOP_ITEMS: ShopItem[] = [
    {
        id: 'frame_gold',
        name: 'Gold Frame',
        description: 'A golden border for your profile',
        type: 'frame',
        cost: 300,
        preview: '✨',
        cssClass: 'focus-frame-gold',
    },
    {
        id: 'frame_neon',
        name: 'Neon Frame',
        description: 'Electric purple glow border',
        type: 'frame',
        cost: 250,
        preview: '💜',
        cssClass: 'focus-frame-neon',
    },
    {
        id: 'frame_minimal',
        name: 'Minimal Frame',
        description: 'Clean white outline',
        type: 'frame',
        cost: 150,
        preview: '⬜',
        cssClass: 'focus-frame-minimal',
    },
    {
        id: 'badge_laser',
        name: 'Laser Badge',
        description: 'Show off laser focus on your profile',
        type: 'badge',
        cost: 150,
        preview: '💎',
    },
    {
        id: 'badge_shield',
        name: 'Shield Badge',
        description: 'Distraction shield veteran',
        type: 'badge',
        cost: 150,
        preview: '🛡️',
    },
    {
        id: 'badge_sprout',
        name: 'Sprout Badge',
        description: 'Forest growth enthusiast',
        type: 'badge',
        cost: 100,
        preview: '🌱',
    },
    {
        id: 'widget_glow',
        name: 'Glow Widget',
        description: 'Adds a soft glow to your timer widget',
        type: 'widget',
        cost: 400,
        preview: '🔆',
        cssClass: 'focus-widget-glow',
    },
];

export function getShopItem(id: string): ShopItem | undefined {
    return SHOP_ITEMS.find((item) => item.id === id);
}

export function frameCssClass(itemId: string | undefined): string | undefined {
    return getShopItem(itemId ?? '')?.cssClass;
}

export function badgeEmoji(itemId: string | undefined): string | undefined {
    return getShopItem(itemId ?? '')?.preview;
}
