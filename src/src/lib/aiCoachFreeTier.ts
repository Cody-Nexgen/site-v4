/** Canned AI Coach replies for non-Pro users (no API calls). */

const OPENERS = [
    "I'd love to help with that",
    'Good question',
    'Let me check what I can do',
    "Here's the thing",
    'So',
];

const BODIES = [
    "FocuzNow AI Coach runs on **Pro** — streaming replies, smart blocking, habits, and screen-time insights all need an active subscription.",
    "Right now your account is on the free plan, so I can't run real coaching or change settings from chat. **Pro** unlocks the full agent.",
    "I'm the AI Coach, but without Pro I can only point you to upgrade. Subscribers get live help, analytics, and one-tap focus actions.",
    "Think of Pro as the switch that turns me from a preview into your actual focus copilot — blocks, themes, pomodoro, and analytics included.",
];

const CLOSERS = [
    'Head to **Account** in the sidebar, then **Upgrade to Pro** when you are ready.',
    'Open **Account settings** and tap **Upgrade to Pro** to unlock me.',
    'You can upgrade anytime from **Account → Upgrade to Pro**.',
];

export function pickFreeTierCoachReply(): string {
    const o = OPENERS[Math.floor(Math.random() * OPENERS.length)];
    const b = BODIES[Math.floor(Math.random() * BODIES.length)];
    const c = CLOSERS[Math.floor(Math.random() * CLOSERS.length)];
    return `${o} — ${b}\n\n${c}`;
}
