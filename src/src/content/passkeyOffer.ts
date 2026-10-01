/**
 * Passkeys FocuzPass can offer in its sign-in suggestions right now: set while a page is waiting
 * for a passkey in the username field (conditional mediation), cleared when it's answered or the
 * page stops waiting. passkeyRequests.ts sets it; the FocuzPass overlay shows it.
 */

export type PasskeyOfferAccount = { credentialId: string; userName: string; title: string; lastUsedAt?: string };
export type PasskeyOffer = { id: string; rpId: string; accounts: PasskeyOfferAccount[]; choose: (credentialId: string) => void };

let offer: PasskeyOffer | null = null;
const watchers = new Set<() => void>();

export function setPasskeyOffer(next: PasskeyOffer | null) {
    offer = next;
    for (const watcher of watchers) watcher();
}

export function clearPasskeyOffer(id: string) {
    if (offer?.id === id) offer = null;
}

export function currentPasskeyOffer(): PasskeyOffer | null {
    return offer;
}

/** Called whenever a new offer arrives (the overlay opens for a username field that's already focused). */
export function watchPasskeyOffer(watcher: () => void): () => void {
    watchers.add(watcher);
    return () => watchers.delete(watcher);
}
