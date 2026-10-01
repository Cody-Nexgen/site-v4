/**
 * App-wide icon grammar (§1.5) — extends the sidebar set with the utility
 * glyphs the primitives and shell need. Same 16px grid / 1.6 stroke / round
 * caps. Lucide remains allowed inside screens at strokeWidth 1.6.
 */
import type { ReactNode } from 'react';

export type IconProps = {
    size?: number;
    className?: string;
    strokeWidth?: number;
};

function Svg({ size = 16, className, strokeWidth = 1.6, children }: IconProps & { children: ReactNode }) {
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
            className={className}
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

export function IconX(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M4 4l8 8M12 4l-8 8" />
        </Svg>
    );
}

export function IconCheck(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M2.5 8.5l3.5 3.5 7.5-8" />
        </Svg>
    );
}

export function IconChevronRight(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M6 3.5 10.5 8 6 12.5" />
        </Svg>
    );
}

export function IconChevronLeft(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M10 3.5 5.5 8 10 12.5" />
        </Svg>
    );
}

export function IconChevronUp(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M3.5 10 8 5.5l4.5 4.5" />
        </Svg>
    );
}

export function IconPin(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M9.5 2.5 13.5 6.5l-2 .5-3 3-.5 2L4.5 8.5l2-.5 3-3 .5-2z" />
        </Svg>
    );
}

export function IconDot(p: IconProps) {
    return (
        <Svg {...p}>
            <circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none" />
        </Svg>
    );
}

export function IconPanelLeftOpen(p: IconProps) {
    return (
        <Svg {...p}>
            <rect x="2.2" y="2.6" width="11.6" height="10.8" rx="1.6" />
            <path d="M6.2 2.6v10.8" />
            <path d="M9 6.2 10.6 8 9 9.8" />
        </Svg>
    );
}

export function IconExternalLink(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M6.5 3.5H4A1.5 1.5 0 002.5 5v7A1.5 1.5 0 004 13.5h7a1.5 1.5 0 001.5-1.5V9.5" />
            <path d="M9.5 2.5h4v4" />
            <path d="M13.5 2.5 8 8" />
        </Svg>
    );
}

export function IconCopy(p: IconProps) {
    return (
        <Svg {...p}>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
            <path d="M10.5 5.5V4A1.5 1.5 0 009 2.5H4A1.5 1.5 0 002.5 4v5A1.5 1.5 0 004 10.5h1.5" />
        </Svg>
    );
}

export function IconEye(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z" />
            <circle cx="8" cy="8" r="1.8" />
        </Svg>
    );
}

export function IconEyeOff(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M3.2 5.2C2.1 6.3 1.6 8 1.6 8s2.4 4.4 6.4 4.4c1 0 1.9-.2 2.7-.6" />
            <path d="M6.6 4.3C7 4.1 7.5 4 8 4c4 0 6.4 4 6.4 4s-.5.9-1.4 1.8" />
            <path d="M6.2 6.2a1.9 1.9 0 002.6 2.6" />
            <path d="M2.5 2.5l11 11" />
        </Svg>
    );
}

export function IconPlus(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M8 3v10M3 8h10" />
        </Svg>
    );
}

export function IconMinus(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M3 8h10" />
        </Svg>
    );
}

export function IconLock(p: IconProps) {
    return (
        <Svg {...p}>
            <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
            <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
            <circle cx="8" cy="10" r="0.8" fill="currentColor" stroke="none" />
        </Svg>
    );
}

export function IconBolt(p: IconProps) {
    return (
        <Svg {...p}>
            <path
                d="M9.2 1.5 3.8 8.9h3.6L6.4 14.5 12.2 7.1H8.6z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth={0.8}
            />
        </Svg>
    );
}

export function IconDots(p: IconProps) {
    return (
        <Svg {...p}>
            <circle cx="3.5" cy="8" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="12.5" cy="8" r="1.1" fill="currentColor" stroke="none" />
        </Svg>
    );
}

export function IconInfo(p: IconProps) {
    return (
        <Svg {...p}>
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 7.4v3.2" />
            <circle cx="8" cy="5" r="0.8" fill="currentColor" stroke="none" />
        </Svg>
    );
}

export function IconWarning(p: IconProps) {
    return (
        <Svg {...p}>
            <path d="M8 2.5 14.5 13h-13L8 2.5z" />
            <path d="M8 6.6v3" />
            <circle cx="8" cy="11.2" r="0.7" fill="currentColor" stroke="none" />
        </Svg>
    );
}

export function IconClock(p: IconProps) {
    return (
        <Svg {...p}>
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 5v3.2l2.2 1.4" />
        </Svg>
    );
}

/* Re-export the navigation/chrome glyph set so all icons share one entry point. */
export * from '../../options/SidebarIcons';
