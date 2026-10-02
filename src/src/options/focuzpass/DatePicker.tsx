import { useRef, useState, type KeyboardEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';

/**
 * A date field with FocuzPass's own calendar (the browser's native one looked out of place). Values
 * are "yyyy-mm-dd", the same as the native date input, so saved items read the same.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parse(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
}

function iso(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function sameDay(a: Date | null, b: Date | null): boolean {
    return Boolean(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());
}

export function DatePicker({
    value,
    onChange,
    placeholder = 'Choose a date',
    min,
    ariaLabel,
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    min?: string;
    ariaLabel?: string;
    className?: string;
}) {
    const selected = parse(value);
    const minDate = min ? parse(min) : null;
    const today = new Date();
    const [open, setOpen] = useState(false);
    // The month on show and the day the keyboard is on.
    const [cursor, setCursor] = useState<Date>(() => selected ?? today);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);

    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const years = Array.from({ length: today.getFullYear() + 30 - 1900 + 1 }, (_, i) => today.getFullYear() + 30 - i);

    const disabled = (day: Date) => Boolean(minDate && day < minDate);
    const pick = (day: Date) => {
        if (disabled(day)) return;
        onChange(iso(day));
        setOpen(false);
        triggerRef.current?.focus();
    };
    const moveTo = (date: Date) => {
        setCursor(date);
        // Keep focus on the day the keyboard moved to, once it renders.
        requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${iso(date)}"]`)?.focus());
    };
    const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
        const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (event.key in steps) {
            event.preventDefault();
            moveTo(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + steps[event.key]!));
        } else if (event.key === 'PageUp' || event.key === 'PageDown') {
            event.preventDefault();
            moveTo(new Date(cursor.getFullYear(), cursor.getMonth() + (event.key === 'PageUp' ? -1 : 1), cursor.getDate()));
        }
    };
    const label = selected ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(selected) : '';

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={`vault-date-trigger${className ? ` ${className}` : ''}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={ariaLabel ? `${ariaLabel}: ${label || 'not set'}` : undefined}
                onClick={() => {
                    if (!open) setCursor(selected ?? today);
                    setOpen((was) => !was);
                }}
            >
                <span className={label ? '' : 'is-placeholder'}>{label || placeholder}</span>
                <CalendarDays size={14} aria-hidden="true" />
            </button>
            <FloatingPanel anchor={triggerRef} open={open} onClose={() => setOpen(false)} role="dialog" minWidth={268} maxHeight={360} className="vault-date-popover">
                <div className="vault-date-head">
                    <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month"><ChevronLeft size={14} /></button>
                    <select value={month} onChange={(event) => setCursor(new Date(year, Number(event.target.value), 1))} aria-label="Month">
                        {MONTHS.map((name, i) => <option key={name} value={i}>{name}</option>)}
                    </select>
                    <select value={year} onChange={(event) => setCursor(new Date(Number(event.target.value), month, 1))} aria-label="Year">
                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month"><ChevronRight size={14} /></button>
                </div>
                <div className="vault-date-weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
                <div ref={gridRef} className="vault-date-grid" role="grid" onKeyDown={onGridKey}>
                    {days.map((day) => {
                        const outside = day.getMonth() !== month;
                        const isSelected = sameDay(day, selected);
                        return (
                            <button
                                key={iso(day)}
                                type="button"
                                data-day={iso(day)}
                                tabIndex={sameDay(day, cursor) ? 0 : -1}
                                disabled={disabled(day)}
                                aria-pressed={isSelected}
                                aria-label={new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(day)}
                                className={`${outside ? 'is-outside' : ''}${isSelected ? ' is-selected' : ''}${sameDay(day, today) ? ' is-today' : ''}`}
                                onClick={() => pick(day)}
                                onFocus={() => setCursor(day)}
                            >
                                {day.getDate()}
                            </button>
                        );
                    })}
                </div>
                <div className="vault-date-foot">
                    <button type="button" onClick={() => pick(today)} disabled={disabled(today)}>Today</button>
                    {value && <button type="button" onClick={() => { onChange(''); setOpen(false); }}>Clear</button>}
                </div>
            </FloatingPanel>
        </>
    );
}
