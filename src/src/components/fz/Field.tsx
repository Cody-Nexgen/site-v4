import {
    forwardRef,
    useId,
    useRef,
    type InputHTMLAttributes,
    type ReactNode,
    type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import { Menu, type MenuItem } from './Menu';
import { IconChevronDown } from './icons';
import { useState } from 'react';

const CONTROL =
    'w-full rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-2.5 text-[13px] text-[var(--fz-text-1)] placeholder:text-[var(--fz-text-4)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--fz-border-strong)] focus-visible:outline-2 focus-visible:outline-[var(--fz-focus-ring)] focus-visible:outline-offset-1 disabled:opacity-50';

export function Field({
    label,
    helper,
    error,
    htmlFor,
    children,
    className,
}: {
    label?: ReactNode;
    helper?: ReactNode;
    error?: ReactNode;
    htmlFor?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            {label && (
                <label htmlFor={htmlFor} className="text-label">
                    {label}
                </label>
            )}
            {children}
            {error ? (
                <p className="text-meta text-[var(--fz-danger)]">{error}</p>
            ) : helper ? (
                <p className="text-meta">{helper}</p>
            ) : null}
        </div>
    );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
    function Input({ className, invalid, ...rest }, ref) {
        return (
            <input
                ref={ref}
                aria-invalid={invalid || undefined}
                className={cn('h-8', CONTROL, invalid && 'border-[var(--fz-danger)]', className)}
                {...rest}
            />
        );
    },
);

export const Textarea = forwardRef<
    HTMLTextAreaElement,
    TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; autoGrow?: boolean }
>(function Textarea({ className, invalid, autoGrow, onInput, ...rest }, ref) {
    const inner = useRef<HTMLTextAreaElement | null>(null);
    return (
        <textarea
            ref={(el) => {
                inner.current = el;
                if (typeof ref === 'function') ref(el);
                else if (ref) ref.current = el;
            }}
            onInput={(e) => {
                if (autoGrow && inner.current) {
                    inner.current.style.height = 'auto';
                    inner.current.style.height = `${inner.current.scrollHeight}px`;
                }
                onInput?.(e);
            }}
            aria-invalid={invalid || undefined}
            className={cn('min-h-[64px] py-2 leading-[18px]', CONTROL, invalid && 'border-[var(--fz-danger)]', className)}
            {...rest}
        />
    );
});

export function Select({
    value,
    onChange,
    options,
    className,
    'aria-label': ariaLabel,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: ReactNode; icon?: ReactNode }[];
    className?: string;
    'aria-label'?: string;
}) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);
    const current = options.find((o) => o.value === value);
    const items: MenuItem[] = options.map((o) => ({
        id: o.value,
        label: o.label,
        icon: o.icon,
        checked: o.value === value,
        onSelect: () => onChange(o.value),
    }));
    return (
        <span className={cn('relative inline-flex', className)}>
            <button
                ref={anchorRef}
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className={cn('flex h-8 items-center justify-between gap-2', CONTROL, 'hover:bg-[var(--fz-bg-hover)]')}
            >
                <span className="truncate">{current?.label ?? value}</span>
                <IconChevronDown size={12} className="shrink-0 text-[var(--fz-text-4)]" />
            </button>
            <Menu open={open} onClose={() => setOpen(false)} anchor={anchorRef} items={items} />
        </span>
    );
}

export { useId as useFieldId };
