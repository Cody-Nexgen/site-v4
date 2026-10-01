/** Copy and data for the landing page. Claims here are checked against the product. */

/** The Pro price lives in Stripe (STRIPE_PRICE_ID). Update this if it changes there. */
export const PRO_PRICE = { amount: '$8', period: 'per month' };

export type SceneId = 'block' | 'focus' | 'plan' | 'pass' | 'insights';

export const SCENES: { id: SceneId; label: string; title: string; body: string }[] = [
    {
        id: 'block',
        label: 'Block',
        title: 'Block what pulls you away',
        body: 'Block sites, whole categories, or only YouTube Shorts. Always, on a schedule, or just while you focus.',
    },
    {
        id: 'focus',
        label: 'Focus',
        title: 'Sessions that keep you honest',
        body: 'A Pomodoro timer that blocks distractions while it runs and counts every minute you win back.',
    },
    {
        id: 'plan',
        label: 'Plan',
        title: 'Your day in one calm place',
        body: 'Calendar, lists, and a booking link people can use to find time with you. All in the same dashboard.',
    },
    {
        id: 'pass',
        label: 'FocuzPass',
        title: 'Passwords that stay yours',
        body: 'A built-in password manager. Your vault is encrypted with AES-256 on your device and never leaves it.',
    },
    {
        id: 'insights',
        label: 'Insights',
        title: 'See where your time goes',
        body: 'Screen time, a daily focus score, and an AI Coach that turns your patterns into rules. AI Coach is part of Pro.',
    },
];

export const FREE_FEATURES = [
    'Block sites, categories, and schedules',
    'Smart YouTube and Shorts blocking',
    'Pomodoro sessions and Nuclear Lockdown',
    'Calendar, Lists, and booking links',
    'FocuzPass password manager',
    'Screen time, habits, Forest, and achievements',
];

export const PRO_FEATURES = [
    'AI Coach that can plan, block, and adjust for you',
    'Future Self contracts',
    'Find sites to block by name',
    'File uploads in Lists',
];

export const FAQ: { q: string; a: string }[] = [
    {
        q: 'What is FocuzNow?',
        a: 'A browser extension and web dashboard that blocks distractions, runs focus sessions, and keeps your calendar, lists, and passwords in one place.',
    },
    {
        q: 'Which browsers does it work in?',
        a: 'FocuzNow is a Chrome extension, so it runs in Chrome and other Chromium browsers such as Brave, Edge, and Vivaldi.',
    },
    {
        q: 'Can FocuzNow see my passwords?',
        a: 'No. FocuzPass encrypts your vault with AES-256 on your device, using a key derived from your master password. The vault never leaves your browser.',
    },
    {
        q: 'What is Nuclear Lockdown?',
        a: 'Nuclear Lockdown blocks everything on your blocklist for a set time with no easy override. Use it when you need maximum focus for deep work.',
    },
    {
        q: 'Where is my data stored?',
        a: 'Browsing analytics and block settings are stored locally on your device. We don’t sell your browsing history, and AI Coach only uses the context you agree to share.',
    },
    {
        q: 'Can I use it on more than one device?',
        a: 'Sign in with the same account to sync your profile and Pro subscription. Blocklists and analytics stay local to each browser unless you turn on cloud sync.',
    },
    {
        q: 'How do I cancel Pro?',
        a: 'Open Account, then Manage subscription. Stripe’s billing portal lets you update your payment method or cancel anytime.',
    },
];
