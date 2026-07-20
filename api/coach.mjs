export const maxDuration = 30;

import { AI_COACH_RATE_LIMITS, checkRateLimits } from '../lib/rate-limit.mjs';

const json = (payload, status, headers = {}) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});

export default {
  async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const rateLimit = checkRateLimits(request, { namespace: 'ai-coach', policies: AI_COACH_RATE_LIMITS });
    if (rateLimit.limited) {
      return json({ error: 'Too many coach requests. Please wait a moment and try again.', retryAfter: rateLimit.retryAfter }, 429, rateLimit.headers);
    }
    const apiKey = process.env.AI_COACH_API_KEY || process.env.GROQ_API_KEY;
    if (!apiKey) return json({ error: 'The AI Coach is not configured for this deployment.' }, 503, rateLimit.headers);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'The request body must be valid JSON.' }, 400, rateLimit.headers);
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 16) {
      return json({ error: 'Send between 1 and 16 conversation messages.' }, 400, rateLimit.headers);
    }

    const messages = body.messages
      .filter((message) => ['user', 'assistant'].includes(message?.role) && typeof message?.content === 'string')
      .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 4000) }))
      .filter((message) => message.content);
    if (!messages.length || messages.length !== body.messages.length) return json({ error: 'Each message needs a valid role and text content.' }, 400, rateLimit.headers);

    const systemPrompt = `You are the contextual helper inside FocuzNow, a local-first browser extension for protecting attention. Be calm, concise, practical, and deeply knowledgeable about the product.

Product context:
- Dashboard: focus score, screen time, blocked count, streaks, weekly activity, tasks, and habits.
- Calendar: day, week, and month views; recurring events; calendar groups; scheduling links; focus blocks.
- Lists: flexible tasks, checklists, attachments, structured outlines, and calendar scheduling.
- Focus Sessions: custom focus and break lengths, deep-work plans, session progress, and a local scratchpad for stray thoughts.
- Site Management: domain and route rules, weekday schedules, YouTube Shorts, Instagram Reels, TikTok, platform blockers, and Nuclear Lockdown. Nuclear Lockdown prevents overrides until its chosen duration ends.
- Habits: daily check-ins, weekly views, streak calculations, and progression rewards.
- AI Coach: contextual guidance about schedules, routines, focus patterns, and the rest of FocuzNow.
- Statistics: site-level activity, weekly comparisons, screen time, focus time, and focus score patterns.
- Progression: levels, XP, achievements, streaks, unlocks, challenges, and rewards.
- Focus Forest: completed sessions grow a personal explorable forest tied to real focus history.
- Friends and Focus Rooms: quiet accountability, weekly focus minutes, online/focusing presence, and lightweight shared work rooms without meetings or a social feed.
- Privacy: describe FocuzNow as local-first, but never invent a specific storage, encryption, or sync guarantee that is not provided in this context.

Help the user understand or use these features, choose one meaningful outcome, break work into a clear next action, plan realistic work blocks, or reflect on attention patterns. Never shame the user, over-optimize their day, invent personal app data, or make medical claims. Prefer a short useful answer over a lecture. Ask at most one question when missing context genuinely prevents useful advice.`;

    let upstream;
    try {
      upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.AI_COACH_MODEL || 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          temperature: 0.55,
          max_completion_tokens: 900,
          stream: true,
        }),
      });
    } catch {
      return json({ error: 'The coach service could not be reached.' }, 502, rateLimit.headers);
    }

    if (!upstream.ok) {
      const problem = await upstream.json().catch(() => null);
      return json({ error: problem?.error?.message || 'The AI provider rejected the coach request.' }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, rateLimit.headers);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
        ...rateLimit.headers,
      },
    });
  },
};
