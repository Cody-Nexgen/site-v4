import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COACH_TOKEN_LIMITS, estimateTokens, formatPercent, limitHit, tallyUsage, usagePercent, type UsageEntry } from './usage';

const now = new Date(2026, 8, 24, 15, 0); // Thu 3pm
const at = (hoursAgo: number, tokens: number, think = false): UsageEntry => ({
    t: now.getTime() - hoursAgo * 3_600_000,
    tokens,
    think,
});

test('tallies tokens into today, rolling week and Think today', () => {
    const u = tallyUsage([at(1, 8_000), at(2, 20_000, true), at(20, 5_000), at(24 * 6, 7_000), at(24 * 8, 9_000)], now);
    assert.equal(u.today, 28_000); // 1h + 2h ago (20h ago is yesterday)
    assert.equal(u.thinkToday, 20_000);
    assert.equal(u.week, 40_000); // 8-day-old entry dropped
});

test('percentages of the tier budget, capped at 100, formatted for display', () => {
    const pro = COACH_TOKEN_LIMITS.pro;
    const p = usagePercent({ today: pro.day / 4, week: pro.week * 2, thinkToday: pro.thinkDay / 10 }, 'pro');
    assert.deepEqual(p, { day: 25, week: 100, think: 10 });
    assert.equal(usagePercent({ today: 0, week: 0, thinkToday: 5 }, 'free').think, 0); // no Think budget → 0%
    assert.deepEqual([0, 0.2, 1.4, 99.6].map(formatPercent), ['0', '<1', '1', '100']);
});

test('limits trip on used-up budgets, Think only when sending with Think', () => {
    const pro = COACH_TOKEN_LIMITS.pro;
    assert.equal(limitHit({ today: 10, week: 10, thinkToday: 10 }, 'pro'), null);
    assert.equal(limitHit({ today: pro.day, week: 10, thinkToday: 0 }, 'pro'), 'day');
    assert.equal(limitHit({ today: 10, week: pro.week, thinkToday: 0 }, 'pro'), 'week');
    assert.equal(limitHit({ today: 10, week: 10, thinkToday: pro.thinkDay }, 'pro'), null);
    assert.equal(limitHit({ today: 10, week: 10, thinkToday: pro.thinkDay }, 'pro', true), 'thinkDay');
});

test('estimates scale with text and include prompt overhead', () => {
    assert.equal(estimateTokens(''), 3_000);
    assert.equal(estimateTokens('a'.repeat(4_000), 'b'.repeat(400)), 3_000 + 1_100);
});
