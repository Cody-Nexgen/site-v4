import type { ReactNode } from 'react';

/**
 * The single page container for every scrolling workspace tab.
 *
 * Before this existed each tab set its own max-width, alignment and padding —
 * ten different widths between 768px and full-bleed, some centred, some pinned
 * left — so the content lurched sideways on every sidebar click. Tabs must not
 * set `max-w-*`, `mx-auto`, `px-*`, `pt-*` or `pb-*` on their root any more;
 * this owns all of it. Internal rhythm stays `space-y-6`.
 *
 * Full-height tabs (calendar, lists, ai_coach, focuzpass) bypass this entirely
 * and are laid out by OptionsApp — they manage their own scroll containers.
 */

const CONTENT_MAX_WIDTH = 'max-w-[1120px]';

type Props = {
    /** Page title. Defaults to the sidebar label via OptionsApp. */
    title?: string;
    /** Small meta line above the title — used only for the Overview date. */
    eyebrow?: ReactNode;
    /** One line under the title. Keep it to a sentence. */
    description?: ReactNode;
    /** Right-aligned page actions, level with the title. */
    actions?: ReactNode;
    /** Drops the max-width for canvas-style pages (Forest). Padding is kept. */
    fullBleed?: boolean;
    /** Hides the header for pages that own their own hero. */
    hideHeader?: boolean;
    children: ReactNode;
};

export function PageShell({
    title,
    eyebrow,
    description,
    actions,
    fullBleed = false,
    hideHeader = false,
    children,
}: Props) {
    const showHeader = !hideHeader && Boolean(title || eyebrow || description || actions);

    return (
        <div className={`w-full ${fullBleed ? '' : CONTENT_MAX_WIDTH} mx-auto px-6 pt-6 pb-16`}>
            {showHeader && (
                <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0">
                        {eyebrow && (
                            <p className="text-meta text-[var(--fz-text-3)]">{eyebrow}</p>
                        )}
                        {title && (
                            <h1 className="text-title-1 mt-1 text-[var(--fz-text-1)]">{title}</h1>
                        )}
                        {description && (
                            <p className="text-body-sm mt-1 text-[var(--fz-text-3)]">{description}</p>
                        )}
                    </div>
                    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                </header>
            )}
            {children}
        </div>
    );
}

export default PageShell;
