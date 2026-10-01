import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickGreeting, formatShortDuration, type GreetingContext } from './greeting';

const base = (over: Partial<GreetingContext> = {}): GreetingContext => ({
    now: new Date(2026, 8, 23, 15, 0), // Wed 3pm
    name: 'Cole',
    streak: 0,
    bestStreak: 0,
    nuclearActive: false,
    pomodorosToday: 0,
    planDone: 0,
    planTotal: 0,
    screenMsToday: 0,
    chatCount: 5,
    ...over,
});
const first = () => 0.5; // never triggers the rare line (< 0.08)

test('plain afternoon falls back to a rotating hello', () => {
    const g = pickGreeting(base(), first);
    assert.match(g.title, /Cole/);
    assert.ok(['tod', 'hey', 'back', 'plan', 'fresh', 'wind'].includes(g.id));
    // every fallback variant is reachable across the rng range
    const ids = new Set([0.1, 0.3, 0.5, 0.7, 0.9].map((r) => pickGreeting(base(), () => r).id));
    assert.ok(ids.size > 1);
});

test('late night and early morning', () => {
    assert.match(pickGreeting(base({ now: new Date(2026, 8, 23, 1, 30) }), first).title, /Cole\?$/);
    assert.equal(pickGreeting(base({ now: new Date(2026, 8, 23, 5, 10) }), () => 0).title, 'Someone’s an early bird!');
});

test('special dates beat everything', () => {
    const g = pickGreeting(base({ now: new Date(2026, 9, 31, 2, 0), nuclearActive: true }), first);
    assert.equal(g.id, 'halloween');
});

test('nuclear beats odd hours', () => {
    assert.equal(pickGreeting(base({ nuclearActive: true, now: new Date(2026, 8, 23, 2) }), first).id, 'nuclear');
});

test('streak personal best and top site nudge', () => {
    assert.equal(pickGreeting(base({ streak: 12, bestStreak: 12 }), first).id, 'pb');
    const g = pickGreeting(base({ topSite: { domain: 'www.youtube.com', ms: 72 * 60_000 } }), first);
    assert.equal(g.title, 'YouTube again, Cole?');
    assert.equal(g.sub, '1h 12m today. Want a hand with that?');
});

test('first chat and rare line', () => {
    assert.equal(pickGreeting(base({ chatCount: 0 }), first).id, 'first');
    assert.match(pickGreeting(base(), () => 0.01).id, /^rare-/);
});

test('formatShortDuration', () => {
    assert.equal(formatShortDuration(45 * 60_000), '45m');
    assert.equal(formatShortDuration(120 * 60_000), '2h');
    assert.equal(formatShortDuration(95 * 60_000), '1h 35m');
});
