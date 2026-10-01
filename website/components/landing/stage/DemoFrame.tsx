import { useEffect, useRef, useState, type CSSProperties } from 'react';

type DemoFrameProps = {
    /** Query string for /demo.html, e.g. "tab=calendar" or "view=popup". */
    query: string;
    width: number;
    height: number;
    /** Changing this replays the frame's own animation (the FocuzPass sign-in). */
    replay?: number;
    className?: string;
    style?: CSSProperties;
};

/**
 * The real extension UI (demo.html, running on demo data) at a fixed size. It's decoration
 * here: not focusable, no pointer events, and it fades in once it has painted.
 */
export function DemoFrame({ query, width, height, replay = 0, className = '', style }: DemoFrameProps) {
    const ref = useRef<HTMLIFrameElement>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.source === ref.current?.contentWindow && event.data?.type === 'fzl-demo-ready') setReady(true);
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    useEffect(() => {
        if (!ready || !replay) return;
        ref.current?.contentWindow?.postMessage({ type: 'fzl-demo-replay' }, window.location.origin);
    }, [replay, ready]);

    return (
        <iframe
            ref={ref}
            src={`/demo.html?${query}`}
            title="FocuzNow demo"
            aria-hidden
            tabIndex={-1}
            // Backup in case the ready message is missed.
            onLoad={() => window.setTimeout(() => setReady(true), 2500)}
            className={className}
            style={{
                width,
                height,
                border: 0,
                display: 'block',
                pointerEvents: 'none',
                colorScheme: 'dark',
                opacity: ready ? 1 : 0,
                transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                ...style,
            }}
        />
    );
}
