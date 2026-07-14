/** YouTube Data API v3 key — set VITE_YOUTUBE_DATA_API_KEY in src/.env before build. */
export function getConfiguredYouTubeApiKey(): string {
    const key = import.meta.env.VITE_YOUTUBE_DATA_API_KEY?.trim();
    return key || '';
}
