/**
 * FocuzNow workspace icon set.
 * 16px grid, 1.5 stroke, round caps/joins, pure outline.
 * Outer stroke edges sit on the 2..14 live area (circles may overshoot 0.25–0.5 for optical balance).
 * Only fills allowed: points <= 2px.
 */
import type { ReactNode } from 'react';

type IconProps = {
    size?: number;
    className?: string;
    strokeWidth?: number;
};

function Svg({ size = 16, className, strokeWidth = 1.5, children }: IconProps & { children: ReactNode }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            shapeRendering="geometricPrecision"
            className={className}
            aria-hidden="true"
            focusable="false"
        >
            {children}
        </svg>
    );
}

function Point({ cx, cy, r = 1 }: { cx: number; cy: number; r?: number }) {
    return <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;
}

/* ---------- navigation ---------- */

export function IconDashboard(p: IconProps) {
    return (
        <Svg {...p}>
            <rect x="2.75" y="2.75" width="3.75" height="3.75" rx="1.25" />
            <rect x="9.5" y="2.75" width="3.75" height="3.75" rx="1.25" />
            <rect x="2.75" y="9.5" width="3.75" height="3.75" rx="1.25" />
            <rect x="9.5" y="9.5" width="3.75" height="3.75" rx="1.25" />
        </Svg>
    );
}

export function IconFocuzPass(p: IconProps) {
    return (
        <Svg {...p}>
            <circle cx="5.25" cy="10.75" r="3" />
            <path d="M7.4 8.6 13.25 2.75M11.5 4.5l1.75 1.75M9.5 6.5l1.5 1.5" />
        </Svg>
    );
}

export function IconCalendar(p: IconProps) {
    return (
        <Svg {...p}>
            <rect x="2.75" y="3.5" width="10.5" height="9.75" rx="2" />
            <path d="M5.75 2.25v2.5M10.25 2.25v2.5M2.75 6.75h10.5" />
            <Point cx={5.75} cy={9.75} r={0.9} />
        </Svg>
    );
}

export function IconLists(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M6.5 4.25h6.75M6.5 8h6.75M6.5 11.75h6.75" />
            <Point cx={3.25} cy={4.25} />
            <Point cx={3.25} cy={8} />
            <Point cx={3.25} cy={11.75} />
        </Svg>
    );
}

export function IconPomodoro(p: IconProps) {
    return (
        <Svg {...p}>
            <circle cx="8" cy="8.75" r="4.75" />
            <path d="M6.25 1.75h3.5M8 1.75V4M8 6.25v2.5l1.75 1" />
        </Svg>
    );
}

export function IconBlocklist(p: IconProps) {
    return (
        <Svg {...p}>
            <circle cx="8" cy="8" r="5.75" />
            <path d="M3.95 3.95l8.1 8.1" />
        </Svg>
    );
}

export function IconHabits(p: IconProps) {
    return (
        <Svg {...p}>
            <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="3" />
            <path d="M5.5 8.25l1.75 1.75L10.75 6.25" />
        </Svg>
    );
}

export function IconAiCoach(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M7 3.75C7.35 6.6 8.4 7.65 11.25 8 8.4 8.35 7.35 9.4 7 12.25 6.65 9.4 5.6 8.35 2.75 8 5.6 7.65 6.65 6.6 7 3.75Z" />
            <path d="M12.25 2.25v3M10.75 3.75h3" />
        </Svg>
    );
}

export function IconStats(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M3.75 13.25v-4M8 13.25V2.75M12.25 13.25V6.75" />
        </Svg>
    );
}

export function IconProgress(p: IconProps) {
    return (
        <Svg {...p}>
            <circle cx="8" cy="6.25" r="3.75" />
            <path d="M5.75 9.25 4.75 14.25 8 12.5l3.25 1.75-1-5" />
        </Svg>
    );
}

export function IconChallenges(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M8.75 1.75 3.5 9h4l-.75 5.25L12.5 7h-4l.25-5.25Z" />
        </Svg>
    );
}

export function IconForest(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M8 1.75l4.25 5.5h-2l3 4H2.75l3-4h-2L8 1.75Z" />
            <path d="M8 11.25v3" />
        </Svg>
    );
}

export function IconFriends(p: IconProps) {
    return (
        <Svg {...p}>
            <circle cx="6" cy="5.25" r="2.5" />
            <path d="M1.75 13.5c.4-2.35 2-3.75 4.25-3.75s3.85 1.4 4.25 3.75" />
            <path d="M10.25 2.9a2.5 2.5 0 0 1 0 4.7M12 9.9c1.2.55 2 1.75 2.25 3.6" />
        </Svg>
    );
}

/* ---------- chrome / utility ---------- */

export function IconSearch(p: IconProps) {
    return (
        <Svg {...p}>
            <circle cx="7" cy="7" r="4.25" />
            <path d="M10.25 10.25 13.5 13.5" />
        </Svg>
    );
}

export function IconChevronDown(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M5 6.5 8 9.5l3-3" />
        </Svg>
    );
}

export function IconPanelLeftClose(p: IconProps) {
    return (
        <Svg {...p}>
            <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2.25" />
            <path d="M6.25 2.75v10.5" />
        </Svg>
    );
}

export function IconSun(p: IconProps) {
    return (
        <Svg {...p}>
            <circle cx="8" cy="8" r="2.75" />
            <path d="M8 1.75v1.25M8 13v1.25M1.75 8H3M13 8h1.25M3.6 3.6l.9.9M11.5 11.5l.9.9M12.4 3.6l-.9.9M4.5 11.5l-.9.9" />
        </Svg>
    );
}

export function IconMoon(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M13.25 9.6A5.5 5.5 0 1 1 6.4 2.75a4.25 4.25 0 0 0 6.85 6.85Z" />
        </Svg>
    );
}

export function IconUser(p: IconProps) {
    return (
        <Svg {...p}>
            <circle cx="8" cy="5.5" r="2.75" />
            <path d="M3 13.75c.6-2.6 2.5-4 5-4s4.4 1.4 5 4" />
        </Svg>
    );
}

export function IconSettings(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M2.75 5H7M10 5h3.25M2.75 11H5M8 11h5.25" />
            <circle cx="8.5" cy="5" r="1.5" />
            <circle cx="6.5" cy="11" r="1.5" />
        </Svg>
    );
}

export function IconHelp(p: IconProps) {
    return (
        <Svg {...p}>
            <circle cx="8" cy="8" r="5.75" />
            <path d="M6.25 6.4a1.85 1.85 0 0 1 3.6.6c0 1.25-1.85 1.6-1.85 2.75" />
            <Point cx={8} cy={11.4} r={0.85} />
        </Svg>
    );
}

export function IconShop(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M3.75 5.25h8.5l-.6 7.6a1.5 1.5 0 0 1-1.5 1.4H5.85a1.5 1.5 0 0 1-1.5-1.4Z" />
            <path d="M6 7V4.5a2 2 0 0 1 4 0V7" />
        </Svg>
    );
}

export function IconLogout(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M6.25 2.75H4.5a1.75 1.75 0 0 0-1.75 1.75v7a1.75 1.75 0 0 0 1.75 1.75h1.75" />
            <path d="M10.25 5l3 3-3 3M13.25 8H6.5" />
        </Svg>
    );
}

export function IconSparkle(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M8 2.75C8.4 6 9.55 7.35 13.25 8 9.55 8.65 8.4 10 8 13.25 7.6 10 6.45 8.65 2.75 8 6.45 7.35 7.6 6 8 2.75Z" />
        </Svg>
    );
}

export function IconArrowRight(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M3.75 8h8.5M9 4.75 12.25 8 9 11.25" />
        </Svg>
    );
}

