/**
 * Demo mode for the AI Coach: local session store + fake streaming replies.
 * Active when `?coachDemo=1` is in the URL or Supabase isn't configured.
 */
import { isSupabaseConfigured } from '../supabase';
import { fallbackTitleFromMessage } from '../chatTitle';
import type { AiCoachModelId } from '../aiCoachModels';

const STORE_KEY = 'focuznow-coach-demo-v1';

export function isCoachDemo(): boolean {
    if (typeof window !== 'undefined') {
        if (new URLSearchParams(window.location.search).get('coachDemo') === '1') return true;
    }
    return !isSupabaseConfigured();
}

export type DemoChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};

export type DemoSession = {
    id: string;
    title: string;
    updated_at: string;
    messages: DemoChatMessage[];
};

type DemoStore = { sessions: DemoSession[] };

const SEED: { title: string; turns: [string, string][] }[] = [
    {
        title: 'Deep work plan for finals week',
        turns: [
            ['help me plan deep work for finals week', "Here's a simple structure for finals week:\n\n- **Two 90-minute blocks** before lunch — hardest subject first\n- One 45-minute review block after dinner\n- Keep YouTube and Reddit blocked until your evening break\n\nWant me to block those sites during your study hours?"],
            ['yes block them 9am to 6pm', "Done — I scheduled a block on your distracting sites from 9:00 to 18:00 every day this week.\n\nTip: pair it with a 50/10 Pomodoro so you still get real breaks."],
        ],
    },
    {
        title: 'Why my focus score dropped',
        turns: [
            ['why did my focus score drop this week', "Your score dipped mainly because evening screen time went up ~40% and two focus sessions ended early.\n\n- Biggest leak: **youtube.com** after 9pm\n- Longest clean streak: Tuesday morning (3.2h)\n\nA bedtime wind-down block would probably recover most of it."],
        ],
    },
    {
        title: 'Pomodoro vs 52/17 method',
        turns: [
            ['pomodoro vs 52/17 which is better for studying', "Short version:\n\n| Method | Work | Break | Best for |\n| --- | --- | --- | --- |\n| Pomodoro | 25m | 5m | Getting started, low energy |\n| 52/17 | 52m | 17m | Deep reading, problem sets |\n\n**52/17 wins for studying** once you can hold attention — the longer block keeps you in flow. Start with Pomodoro on days you feel resistance."],
            ['set my timer to 52/17', 'Done — your Pomodoro preset is now 52 minutes focus / 17 minutes break.'],
        ],
    },
    {
        title: 'Block YouTube during study hours',
        turns: [
            ['block youtube during my study hours', "Blocked **youtube.com** on weekdays 9:00–17:00.\n\nIf you need it for a lecture, ask me for a 10-minute temporary unlock instead of removing the block."],
        ],
    },
    {
        title: 'Spanish vocab study schedule',
        turns: [
            ['make me a schedule for learning spanish vocab', "Here's a light daily routine:\n\n1. **Morning (10m):** review yesterday's cards\n2. **Lunch (10m):** 8 new words\n3. **Evening (5m):** quick recall test\n\nConsistency beats volume — 25 focused minutes a day beats a 2-hour Sunday cram."],
        ],
    },
    {
        title: 'Morning routine for early classes',
        turns: [
            ['help me build a morning routine for my 8am classes', "Try this 45-minute sequence:\n\n- Wake → water + light, no phone\n- 10m movement\n- 15m review of the day's one big task\n- Leave a 10m buffer\n\nThe key move is **keeping your phone blocked** until you're out the door — want me to schedule that?"],
        ],
    },
    {
        title: 'Weekly screen time review',
        turns: [
            ['review my screen time this week', "This week vs last:\n\n- Total screen time: **down 12%**\n- Focus sessions: 14 (up from 9)\n- Worst slot: Sundays after 8pm\n\nYou're trending the right way. The one lever left is late-night browsing."],
        ],
    },
    {
        title: 'Savanna ecosystem essay outline',
        turns: [
            ['outline an essay about the savanna ecosystem', "A clean five-part outline:\n\n1. **Intro** — where savannas are, why they matter\n2. Climate drivers — seasonal rain + fire\n3. Keystone species — grasses, grazers, predators\n4. Human pressure — farming, fragmentation\n5. **Conclusion** — conservation outlook\n\nWant me to expand any section?"],
        ],
    },
];

let memStore: DemoStore | null = null;

function readStore(): DemoStore {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const raw = window.localStorage.getItem(STORE_KEY);
            if (raw) return JSON.parse(raw) as DemoStore;
        } else if (memStore) {
            return memStore;
        }
    } catch { /* fallthrough */ }
    const sessions: DemoSession[] = SEED.map((s, i) => ({
        id: `demo-${i + 1}`,
        title: s.title,
        updated_at: new Date(Date.now() - i * 3600_000 * 7).toISOString(),
        messages: s.turns.flatMap(([u, a]) => [
            { role: 'user' as const, content: u },
            { role: 'assistant' as const, content: a },
        ]),
    }));
    const store = { sessions };
    writeStore(store);
    return store;
}

function writeStore(store: DemoStore) {
    memStore = store;
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
        }
    } catch { /* storage full — demo only */ }
}

export function listSessions(): { id: string; title: string; updated_at: string }[] {
    return readStore()
        .sessions.map(({ id, title, updated_at }) => ({ id, title, updated_at }))
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export function loadMessages(id: string): DemoChatMessage[] {
    return readStore().sessions.find((s) => s.id === id)?.messages ?? [];
}

export function createSession(): DemoSession {
    const store = readStore();
    const session: DemoSession = {
        id: `demo-${crypto.randomUUID()}`,
        title: 'New chat',
        updated_at: new Date().toISOString(),
        messages: [],
    };
    store.sessions.unshift(session);
    writeStore(store);
    return session;
}

export function renameSession(id: string, title: string) {
    const store = readStore();
    const s = store.sessions.find((x) => x.id === id);
    if (s) {
        s.title = title;
        s.updated_at = new Date().toISOString();
        writeStore(store);
    }
}

export function deleteSession(id: string) {
    const store = readStore();
    store.sessions = store.sessions.filter((x) => x.id !== id);
    writeStore(store);
}

export function appendTurn(id: string, user: string, assistant: string) {
    const store = readStore();
    const s = store.sessions.find((x) => x.id === id);
    if (!s) return;
    s.messages.push({ role: 'user', content: user }, { role: 'assistant', content: assistant });
    s.updated_at = new Date().toISOString();
    writeStore(store);
}

/* ---------------- fake streaming ---------------- */

const REPLIES = [
    "Here's a plan that usually works:\n\n- Break it into one small first step you can do in under 10 minutes\n- Schedule it as a focus block so it has a protected time slot\n- Block your top distraction while you're in the block\n\nWant me to set that up for you?",
    "Good question — the highest-leverage move is usually the boring one:\n\n1. Pick a fixed daily time\n2. Shrink the scope until it feels easy\n3. Track it as a habit so the streak carries you\n\nConsistency beats intensity here.",
    "Let's make it concrete. A quick plan:\n\n- Define what \"done\" looks like in one sentence\n- Do a 25-minute Pomodoro on just the first piece\n- Review what got in the way, then adjust\n\nShall I start a focus session for it now?",
    "I'd suggest a simple experiment:\n\n| Day | Action |\n| --- | --- |\n| Today | One 45-minute block, phone blocked |\n| Tomorrow | Same block, note what broke focus |\n| Day 3 | Fix the biggest leak |\n\nThree days of data beats a perfect plan.",
    "Here's the pattern I usually see:\n\n- The work isn't hard — the *starting* is\n- A visible timer lowers the activation energy\n- A pre-committed block removes the decision\n\n**Start tiny:** one Pomodoro today, then decide if you need more.",
    "A few thoughts:\n\n1. Protect a morning block — willpower is highest early\n2. Keep the task list to three items max\n3. End each block by writing the next action\n\nThat last habit makes restarting almost frictionless.",
    "Try the 2-minute version first: do the smallest possible piece right now. If it still feels heavy after that, the task needs splitting, not more discipline.\n\n- Split it until each piece takes < 30 minutes\n- Put the first piece on today's plan",
    "Here's a tighter way to think about it:\n\n- **Input:** what you'll do (controllable)\n- **Output:** what you hope happens (not controllable)\n\nCommit to the input — e.g. \"two focus blocks daily\" — and let the output follow.",
    "Quick win: pair it with an existing anchor.\n\n- After lunch → 25m focus block\n- After dinner → 10m review\n\nAnchored habits stick about twice as often as floating ones. Want me to add these to your routine?",
    "Let's troubleshoot it like a system:\n\n1. When did it last work? Do that again.\n2. What's the biggest leak? Block it.\n3. What's the smallest version? Do it today.\n\nMost motivation problems are actually friction problems.",
    "I'd go with a weekly cadence:\n\n- **Mon–Thu:** deep work blocks on the hard part\n- **Fri:** review + plan next week\n- **Weekend:** light maintenance only\n\nThe review day is the one people skip — don't.",
    "Honest answer: you probably don't need a better system, you need fewer open loops.\n\n- Write down everything competing for attention\n- Pick one\n- Block the rest, literally, with a focus session\n\nI can start one whenever you're ready.",
    "Here's a practical take:\n\n1. Do it at the same time every day — timing is the strongest cue\n2. Keep a visible streak somewhere\n3. Never miss twice\n\nRule 3 is the whole game.",
    "Short version: energy management matters more than time management.\n\n- Hard task → your peak hours\n- Admin → your slump hours\n- **Nothing** → after 10pm, that's recovery time\n\nWhen's your peak — morning or evening?",
];

/* Replies that write a Library document (see lib/coach/docBlocks.ts). */
const DOC_REPLIES: { match: RegExp; reply: string }[] = [
    {
        match: /study|exam|finals|revision/i,
        reply: [
            "Here's a study plan built around spaced sessions — I saved it to your Library so you can tweak it.",
            '',
            '~~~focuz-doc',
            'title: Study plan — this week',
            'type: study',
            '---',
            '# Study plan — this week',
            '',
            'Three focused sessions a day beats one marathon. Each block is **50 minutes on, 10 off**, phone blocked.',
            '',
            '| Day | Morning (50m) | Afternoon (50m) | Evening review (20m) |',
            '| --- | --- | --- | --- |',
            '| Mon | New material: chapter 1 | Practice problems | Flashcards |',
            '| Tue | Chapter 2 | Chapter 1 recall test | Flashcards |',
            '| Wed | Chapter 3 | Mixed practice | Summary sheet |',
            '| Thu | Weakest topic | Past paper, timed | Mistake log |',
            '| Fri | Chapter 4 | Teach-back (explain aloud) | Plan next week |',
            '',
            '## Rules',
            '',
            '- [ ] Start every session by writing one question you want answered',
            '- [ ] Block YouTube, Reddit and Discord during blocks',
            '- [ ] Stop at the timer — even mid-thought',
            '',
            '> Spacing + retrieval practice roughly doubles retention versus rereading.',
            '~~~',
            '',
            'Want me to put these blocks on your calendar?',
        ].join('\n'),
    },
    {
        match: /routine|morning|wake|wind[- ]?down/i,
        reply: [
            'Here you go — a routine that gets you into deep work fast. Saved to your Library.',
            '',
            '~~~focuz-doc',
            'title: Morning routine for focused days',
            'type: routine',
            '---',
            '# Morning routine for focused days',
            '',
            '## 07:00 – 07:30 · Wake without the phone',
            '',
            '- [ ] Water and daylight before any screen',
            '- [ ] 10-minute walk or stretch',
            '',
            '## 07:30 – 08:00 · Set the day',
            '',
            '- [ ] Write the **one thing** that makes today a win',
            '- [ ] Check the planner, move anything unrealistic',
            '',
            '## 08:00 – 09:30 · First deep-work block',
            '',
            '- [ ] Start a 90-minute focus session',
            '- [ ] Nuclear-block social and video sites until 09:30',
            '',
            '## Guardrails',
            '',
            '- No email or chat before the first block ends',
            '- If you miss a morning, just restart at the next block — never miss twice',
            '~~~',
            '',
            'I can schedule the 08:00 block every weekday if you want.',
        ].join('\n'),
    },
    {
        match: /./,
        reply: [
            "I turned your goals into a focus plan for the week and saved it to your Library.",
            '',
            '~~~focuz-doc',
            'title: Weekly focus plan',
            'type: plan',
            '---',
            '# Weekly focus plan',
            '',
            '**Theme:** ship the essay draft and keep study sessions consistent.',
            '',
            '## Priorities',
            '',
            '1. Essay outline → full draft by Thursday',
            '2. Four study sessions for finals',
            '3. Keep the focus streak alive (one block minimum per day)',
            '',
            '## Deep-work blocks',
            '',
            '| Day | Block | Focus |',
            '| --- | --- | --- |',
            '| Mon | 09:00 – 10:30 | Essay outline |',
            '| Tue | 09:00 – 10:30 | Draft intro + section 1 |',
            '| Wed | 14:00 – 15:30 | Study: weakest topic |',
            '| Thu | 09:00 – 11:00 | Finish draft |',
            '| Fri | 10:00 – 11:00 | Review + plan next week |',
            '',
            '## Blocklist during blocks',
            '',
            '- youtube.com, reddit.com, instagram.com, tiktok.com',
            '',
            '## Checklist',
            '',
            '- [ ] Protect the Monday block',
            '- [ ] Review screen time Friday',
            '~~~',
            '',
            'Want me to add these blocks to your calendar and turn on the blocklist?',
        ].join('\n'),
    },
];

const DOC_INTENT = /\b(document|doc)\b|focus plan|weekly plan|study plan|routine|plan for (this|the) week|plan (this|my) week/i;

const THINK_LINES = [
    'Let me think about what they are really asking…',
    'Checking their focus context and recent patterns…',
    'Weighing a couple of approaches — keep it actionable…',
    'Drafting a concise answer with concrete next steps…',
];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/** Trailing words that read as a cut-off phrase in a title. */
const DANGLING_WORDS = new Set([
    'or', 'and', 'to', 'for', 'with', 'of', 'the', 'a', 'an', 'in', 'on', 'vs',
]);

function trimDangling(title: string): string {
    const words = title.split(/\s+/);
    while (words.length > 2 && DANGLING_WORDS.has(words[words.length - 1].toLowerCase())) {
        words.pop();
    }
    return words.join(' ');
}

/** Curated titles for prompts the demo actually seeds/suggests. */
const CURATED_TITLES: [RegExp, string][] = [
    [/focus plan|weekly plan|goals into/i, 'Weekly focus plan'],
    [/study plan/i, 'Study plan for this week'],
    [/finals|exam week/i, 'Deep work plan for finals week'],
    [/pomodoro|52\/17|longer blocks/i, 'Pomodoro vs longer focus blocks'],
    [/youtube|reddit|distract|block/i, 'Blocking distracting sites'],
    [/screen time|analytics|score/i, 'Weekly screen time review'],
    [/spanish|vocab/i, 'Spanish vocab study schedule'],
    [/savanna|essay|outline/i, 'Savanna ecosystem essay outline'],
    [/morning|routine|early class/i, 'Morning routine for early classes'],
    [/schedule|auto-?schedule|plan my|deep work/i, 'Deep work schedule for today'],
    [/lockdown|lock in|nuclear/i, 'Focus lockdown session'],
    [/habit|streak/i, 'Building a daily habit'],
];

export function streamDemoReply(opts: {
    model: AiCoachModelId;
    text: string;
    attachments?: { name: string; textContent?: string }[];
    signal?: AbortSignal;
    onThinking?: (lines: string[], done: boolean) => void;
    onDelta: (visible: string) => void;
    onDone: (full: string) => void;
}): void {
    const { model, attachments, signal, onThinking, onDelta, onDone } = opts;

    const fileNote = attachments?.find((a) => a.textContent != null);
    const wantsDoc = DOC_INTENT.test(opts.text) && !/\[User attached a file:/.test(opts.text);
    let reply = wantsDoc ? DOC_REPLIES.find((d) => d.match.test(opts.text))!.reply : pick(REPLIES);
    if (fileNote) {
        const lines = fileNote.textContent!.split('\n').length;
        reply = `I read **${fileNote.name}** (${lines} lines). ` + reply;
    }

    let stopped = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
        const t = window.setTimeout(() => {
            if (!stopped) fn();
        }, ms);
        timers.push(t);
    };
    signal?.addEventListener('abort', () => {
        stopped = true;
        timers.forEach((t) => window.clearTimeout(t));
    });

    const startAnswer = () => {
        // Stream word chunks with jitter.
        const chunks = reply.split(/(?<=\s)/);
        let i = 0;
        let visible = '';
        const step = () => {
            if (stopped) return;
            const n = 1 + Math.floor(Math.random() * 2);
            visible += chunks.slice(i, i + n).join('');
            i += n;
            onDelta(visible);
            if (i < chunks.length) {
                later(step, 18 + Math.random() * 27);
            } else {
                onDone(reply);
            }
        };
        step();
    };

    if (model === 'gemini-2.5-pro' && onThinking) {
        const thought: string[] = [];
        const thinkMs = 1500 + Math.random() * 1500;
        const perLine = thinkMs / THINK_LINES.length;
        THINK_LINES.forEach((line, idx) => {
            later(() => {
                thought.push(line);
                onThinking([...thought], idx === THINK_LINES.length - 1);
            }, perLine * (idx + 0.5));
        });
        later(startAnswer, thinkMs);
    } else {
        later(startAnswer, 300 + Math.random() * 300);
    }
}

/** Deterministic demo title — curated for known prompts, else trimmed fallback. */
export function demoTitleFor(userMessage: string): string {
    const curated = CURATED_TITLES.find(([re]) => re.test(userMessage));
    if (curated) return curated[1];
    return trimDangling(fallbackTitleFromMessage(userMessage));
}
