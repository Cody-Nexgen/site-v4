/** Mirror of extension focusShop badge previews for the website. */
export function badgeEmoji(itemId: string | undefined): string | undefined {
  const map: Record<string, string> = {
    badge_laser: "💎",
    badge_shield: "🛡️",
    badge_sprout: "🌱",
  };
  return itemId ? map[itemId] : undefined;
}
