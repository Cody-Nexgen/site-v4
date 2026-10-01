/** Beam Z mark. On the black landing page the dark tile gets a hairline so it doesn't vanish. */
const Z_PATH = 'M20 17.8 H47.2 V22.2 L22.8 41.8 H47.2 L44 46.2 H16.8 V41.8 L29.2 22.2 H16.8 Z';

export function Mark({ size = 28, className = '', title }: { size?: number; className?: string; title?: string }) {
    return (
        <svg
            viewBox="0 0 64 64"
            width={size}
            height={size}
            fill="none"
            className={`shrink-0 ${className}`}
            role={title ? 'img' : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : true}
        >
            <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="16" fill="#0A0B0D" stroke="rgb(255 255 255 / 0.16)" strokeWidth="1.5" />
            <path d={Z_PATH} fill="#F4F2EE" stroke="#F4F2EE" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
    );
}
