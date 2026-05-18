/**
 * Auth page carousel — replace images in /public/auth/ (same filenames).
 * Supported: .webp, .jpg, .jpeg, .png, .svg
 */
export type AuthSlide = {
    /** Path from site root, e.g. /auth/slide-1.webp */
    src: string;
    title: string;
    subtitle: string;
};

export const AUTH_SLIDES: AuthSlide[] = [
    {
        src: '/auth/slide-1.svg',
        title: 'Focus without friction',
        subtitle: 'Block distractions and protect deep work from one place.',
    },
    {
        src: '/auth/slide-2.svg',
        title: 'See where time goes',
        subtitle: 'Understand your habits and build a sustainable focus routine.',
    },
    {
        src: '/auth/slide-3.svg',
        title: 'Stay in flow',
        subtitle: 'Timers, blocklists, and coaching that fit how you actually work.',
    },
];
