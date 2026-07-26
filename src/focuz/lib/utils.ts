import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatHistoryUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');

    if (hostname.includes('google') && urlObj.pathname === '/search') {
      const query = urlObj.searchParams.get('q');
      if (query) return `${query} - Google`;
    }

    if (hostname.includes('yahoo') && urlObj.pathname.includes('/search')) {
      const query = urlObj.searchParams.get('p');
      if (query) return `${query} - Yahoo`;
    }

    if (hostname.includes('bing') && urlObj.pathname === '/search') {
      const query = urlObj.searchParams.get('q');
      if (query) return `${query} - Bing`;
    }

    return hostname + (urlObj.pathname.length > 1 ? urlObj.pathname : '');
  } catch (e) {
    return url;
  }
}
