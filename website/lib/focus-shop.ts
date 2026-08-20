/** Mirror of extension focusShop badge marks for the website. */
export function badgeMark(itemId: string | undefined): string | undefined {
  const map: Record<string, string> = {
    badge_laser: "LASER",
    badge_shield: "SHIELD",
    badge_sprout: "SPROUT",
  };
  return itemId ? map[itemId] : undefined;
}

/** @deprecated Use badgeMark */
export function badgeEmoji(itemId: string | undefined): string | undefined {
  return badgeMark(itemId);
}
