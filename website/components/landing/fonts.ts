/** Satoshi for headlines, from Fontshare (a stylesheet link, not a package). */
const DISPLAY_FONT = 'https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap';

export function loadDisplayFont() {
    if (typeof document === 'undefined' || document.querySelector(`link[href="${DISPLAY_FONT}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = DISPLAY_FONT;
    document.head.appendChild(link);
}
