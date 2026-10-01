import { motion } from 'framer-motion';
import { Calendar, Mail, Phone, User, X } from 'lucide-react';
import type { HostBookingNotification } from '../lib/schedulingApi';
import { formatBookingWhen } from '../lib/bookingCalendarSync';
import { Button } from './fz/Button';

type Props = {
    bookings: HostBookingNotification[];
    onDismiss: () => void;
    onView?: () => void;
};

export function BookingNotificationModal({ bookings, onDismiss, onView }: Props) {
    if (bookings.length === 0) return null;

    return (
        <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex w-[360px] max-w-[calc(100vw-2.5rem)] flex-col gap-2">
            {bookings.map((b, i) => (
                <motion.div
                    key={b.id}
                    initial={{ opacity: 0, x: 32 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.24, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    className="pointer-events-auto rounded-xl border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] p-4 shadow-2xl"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[var(--fz-text-1)]">New booking</p>
                            <p className="mt-0.5 text-[12px] text-[var(--fz-text-3)]">
                                {b.link_title} · added to your calendar
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onDismiss}
                            className="shrink-0 rounded-md p-1 text-[var(--fz-text-4)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                            aria-label="Dismiss"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="mt-3 space-y-1.5 text-[12px] text-[var(--fz-text-3)]">
                        <p className="flex items-center gap-2">
                            <Calendar size={13} className="shrink-0 text-[var(--fz-text-4)]" />
                            {formatBookingWhen(b)} · {b.duration_min} min
                        </p>
                        <p className="flex items-center gap-2">
                            <User size={13} className="shrink-0 text-[var(--fz-text-4)]" />
                            {b.guest_name}
                            {b.guest_email && (
                                <span className="flex items-center gap-1.5 truncate text-[var(--fz-text-4)]">
                                    <Mail size={12} /> {b.guest_email}
                                </span>
                            )}
                        </p>
                        {b.guest_phone && (
                            <p className="flex items-center gap-2">
                                <Phone size={13} className="shrink-0 text-[var(--fz-text-4)]" />
                                {b.guest_phone}
                            </p>
                        )}
                        {b.guest_details && (
                            <p className="pl-5 text-[11px] leading-relaxed text-[var(--fz-text-4)]">{b.guest_details}</p>
                        )}
                    </div>
                    <div className="mt-3 flex gap-2">
                        <Button variant="primary" size="sm" className="flex-1" onClick={() => { onView?.(); onDismiss(); }}>
                            View
                        </Button>
                        <Button variant="secondary" size="sm" onClick={onDismiss}>Dismiss</Button>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
