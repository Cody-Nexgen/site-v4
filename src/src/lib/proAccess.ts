/** True when an API/error message is about subscription tier, not Vertex/GCP "project" etc. */
export function isProSubscriptionError(message: string | undefined, code?: string): boolean {
    if (code === 'PRO_REQUIRED' || code === 'NOT_PRO') return true;
    if (!message) return false;
    const lower = message.toLowerCase();
    return (
        lower.includes('pro feature') ||
        lower.includes('upgrade to pro') ||
        lower.includes('upgrade to continue') ||
        lower.includes('unlock ai coach') ||
        (lower.includes('upgrade') && lower.includes('pro'))
    );
}
