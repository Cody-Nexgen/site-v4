import { Calendar, Mail, Phone, User, X } from 'lucide-react';
import type { HostBookingNotification } from '../lib/schedulingApi';
import { formatBookingWhen } from '../lib/bookingCalendarSync';

type Props = {
    bookings: HostBookingNotification[];
    onDismiss: () => void;
};

export function BookingNotificationModal({ bookings, onDismiss }: Props) {
    if (bookings.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div
                role="dialog"
                aria-labelledby="booking-notify-title"
                className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121218] shadow-2xl overflow-hidden"
            >
                <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                    <div>
                        <h2 id="booking-notify-title" className="text-lg font-bold text-white">
                            New booking{bookings.length > 1 ? 's' : ''}
                        </h2>
                        <p className="text-xs text-neutral-500 mt-0.5">
                            Added to your calendar · host email sent
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5"
                        aria-label="Dismiss"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4">
                    {bookings.map((b) => (
                        <div
                            key={b.id}
                            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3"
                        >
                            <p className="font-bold text-white">{b.link_title}</p>
                            <div className="flex items-center gap-2 text-sm text-neutral-400">
                                <Calendar size={14} className="shrink-0" />
                                {formatBookingWhen(b)}
                                <span className="text-neutral-600">·</span>
                                {b.duration_min} min
                            </div>
                            <div className="space-y-1.5 text-sm">
                                <p className="flex items-center gap-2 text-neutral-300">
                                    <User size={14} className="text-neutral-500" />
                                    {b.guest_name}
                                </p>
                                {b.guest_email && (
                                    <p className="flex items-center gap-2 text-neutral-400">
                                        <Mail size={14} className="text-neutral-500" />
                                        {b.guest_email}
                                    </p>
                                )}
                                {b.guest_phone && (
                                    <p className="flex items-center gap-2 text-neutral-400">
                                        <Phone size={14} className="text-neutral-500" />
                                        {b.guest_phone}
                                    </p>
                                )}
                                {b.guest_details && (
                                    <p className="text-neutral-500 text-xs leading-relaxed pl-6">
                                        {b.guest_details}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="border-t border-white/[0.06] p-4">
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}
