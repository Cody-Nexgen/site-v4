import { useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { GlassCard } from '../OptionsApp';
import { SettingsSearchContext, matchesQuery } from './settingsCore';

/**
 * A titled group of settings. Hidden automatically (CSS :has) when a
 * search leaves none of its rows visible.
 */
export function SettingsSection({
    id,
    title,
    description,
    action,
    children,
}: {
    id: string;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section id={`settings-${id}`} data-settings-section={id} className="settings-section scroll-mt-6">
            <div className="mb-2.5 flex items-end justify-between gap-3 px-0.5">
                <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-[var(--fz-text-1)]">{title}</h2>
                    {description && <p className="text-meta mt-0.5">{description}</p>}
                </div>
                {action}
            </div>
            <GlassCard>
                <div className="divide-y divide-[var(--fz-border)]">{children}</div>
            </GlassCard>
        </section>
    );
}

/**
 * One setting: label + description on the left, control on the right
 * (or below, when `stacked`). Filters itself against the search query.
 */
export function SettingRow({
    title,
    description,
    keywords,
    control,
    children,
    stacked = false,
    tone,
    htmlFor,
}: {
    title: string;
    description?: ReactNode;
    /** Extra words people might search for; include the description when it isn't a plain string. */
    keywords?: string;
    /** Right-aligned control (switch, select…). */
    control?: ReactNode;
    /** Content under the text (forms, lists). */
    children?: ReactNode;
    stacked?: boolean;
    tone?: 'danger';
    htmlFor?: string;
}) {
    const query = useContext(SettingsSearchContext);
    if (!matchesQuery(query, [title, typeof description === 'string' ? description : undefined, keywords])) return null;
    const Label = htmlFor ? 'label' : 'p';
    return (
        <div data-setting-row className={cn('px-5 py-4', stacked && 'space-y-3')}>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="min-w-0 flex-1 basis-56">
                    <Label
                        htmlFor={htmlFor}
                        className={cn('block text-[13px] font-medium', tone === 'danger' ? 'text-[var(--fz-danger)]' : 'text-[var(--fz-text-1)]')}
                    >
                        {title}
                    </Label>
                    {description && <div className="text-meta mt-0.5 max-w-xl leading-relaxed">{description}</div>}
                </div>
                {control && <div className="flex shrink-0 items-center gap-2">{control}</div>}
            </div>
            {children}
        </div>
    );
}
