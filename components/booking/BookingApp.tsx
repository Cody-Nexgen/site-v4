import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    addDays,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Globe, Link2, MapPin, Phone } from 'lucide-react';
import type { SchedulingLink } from '@/lib/scheduling/types';
import {
    createSchedulingBooking,
    fetchBookedSlots,
    fetchSchedulingLink,
} from '@/lib/scheduling/api';
import { isDayBookable, slotsForDay, type BookedSlot } from '@/lib/scheduling/slots';

function parseSlug(): string {
    const path = window.location.pathname.replace(/\/$/, '');
    const parts = path.split('/').filter(Boolean);
    const i = parts.indexOf('schedule');
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
    return new URLSearchParams(window.location.search).get('slug') || '';
}

function locationLabel(link: SchedulingLink): string | null {
    if (!link.locationValue?.trim()) return null;
    switch (link.locationType) {
        case 'link':
            return link.locationValue;
        case 'phone':
            return 'Phone call';
        case 'in_person':
        case 'custom':
            return link.locationValue;
        default:
            return null;
    }
}

type Props = {
    client: SupabaseClient;
};

export default function BookingApp({ client }: Props) {
    const slug = useMemo(() => parseSlug(), []);
    const [link, setLink] = useState<SchedulingLink | null>(null);
    const [booked, setBooked] = useState<BookedSlot[]>([]);
    const [month, setMonth] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [selectedStartMin, setSelectedStartMin] = useState<number | null>(null);
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState('');

    const loadBooked = useCallback(
        async (activeSlug: string) => {
            const from = format(new Date(), 'yyyy-MM-dd');
            const to = format(addDays(new Date(), 120), 'yyyy-MM-dd');
            const slots = await fetchBookedSlots(client, activeSlug, from, to);
            setBooked(slots);
        },
        [client],
    );

    useEffect(() => {
        if (!slug) {
            setError('No scheduling link specified.');
            return;
        }

        let cancelled = false;

        (async () => {
            const found = await fetchSchedulingLink(client, slug);
            if (cancelled) return;
            if (!found) {
                setError(
                    'This scheduling link was not found. Ask the host to share a valid link or create one in FocuzNow.',
                );
                return;
            }
            setLink(found);
            await loadBooked(slug);
        })();

        return () => {
            cancelled = true;
        };
    }, [slug, loadBooked, client]);

    const monthStart = startOfMonth(month);
    const gridDays = eachDayOfInterval({
        start: startOfWeek(monthStart),
        end: endOfWeek(endOfMonth(monthStart)),
    });

    const daySlots = selectedDay && link ? slotsForDay(link, selectedDay, booked) : [];

    const selectedSlotLabel =
        selectedStartMin != null
            ? daySlots.find((s) => s.startMin === selectedStartMin)?.label
            : null;

    const handleConfirm = async () => {
        if (!link || !selectedDay || selectedStartMin == null) return;
        if (!guestName.trim() || !guestEmail.trim()) {
            setError('Please enter your name and email.');
            return;
        }
        if (link.locationType === 'phone' && !guestPhone.trim()) {
            setError('Please enter your phone number.');
            return;
        }

        setSubmitting(true);
        setError('');

        const result = await createSchedulingBooking(client, {
            slug: link.slug,
            bookingDate: format(selectedDay, 'yyyy-MM-dd'),
            startMin: selectedStartMin,
            guestName,
            guestEmail,
            guestPhone: guestPhone || undefined,
        });

        setSubmitting(false);

        if (!result.ok) {
            const msg = result.error || '';
            if (msg.includes('SLOT_TAKEN')) {
                setError('That time was just booked. Please pick another slot.');
                await loadBooked(link.slug);
            } else if (msg.includes('LINK_NOT_FOUND') || msg.includes('LINK_EXPIRED')) {
                setError('This scheduling link is no longer available.');
            } else {
                setError('Could not complete booking. Please try again.');
            }
            return;
        }

        setConfirmed(true);
    };

    if (error && !link) {
        return (
            <div className="min-h-screen bg-[#111] text-white flex items-center justify-center p-8">
                <p className="text-neutral-400 text-center max-w-md">{error}</p>
            </div>
        );
    }

    if (!link) {
        return (
            <div className="min-h-screen bg-[#111] text-white flex items-center justify-center">
                <p className="text-neutral-500">Loading…</p>
            </div>
        );
    }

    if (confirmed && selectedDay && selectedSlotLabel) {
        return (
            <div className="min-h-screen bg-[#111] text-white flex items-center justify-center p-8">
                <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#141414] p-8 text-center">
                    <h1 className="text-2xl font-black text-white mb-2">You&apos;re booked</h1>
                    <p className="text-neutral-400 text-sm mb-6">
                        {format(selectedDay, 'EEEE, MMMM d, yyyy')} at {selectedSlotLabel} ({link.timezone})
                    </p>
                    <p className="text-neutral-500 text-sm">
                        Confirmation sent to <span className="text-white">{guestEmail}</span>.
                    </p>
                </div>
            </div>
        );
    }

    const loc = locationLabel(link);

    return (
        <div className="min-h-screen bg-[#111] text-white flex flex-col md:flex-row">
            <aside className="md:w-[340px] border-b md:border-b-0 md:border-r border-white/10 p-8 flex flex-col gap-6">
                <h1 className="text-2xl font-black leading-tight">{link.title}</h1>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-sm font-black">
                        {link.hostName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-bold">{link.hostName}</p>
                        <p className="text-xs text-neutral-500">Organizer</p>
                    </div>
                </div>
                <p className="text-sm text-neutral-400">{link.durationMin} min</p>
                {link.description && <p className="text-sm text-neutral-500">{link.description}</p>}
                {loc && (
                    <div className="flex items-start gap-2 text-sm text-neutral-400">
                        {link.locationType === 'phone' ? (
                            <Phone size={16} className="shrink-0 mt-0.5" />
                        ) : link.locationType === 'in_person' ? (
                            <MapPin size={16} className="shrink-0 mt-0.5" />
                        ) : (
                            <Link2 size={16} className="shrink-0 mt-0.5" />
                        )}
                        <span className="break-all">{loc}</span>
                    </div>
                )}
            </aside>

            <main className="flex-1 p-8">
                <h2 className="text-lg font-bold mb-6">Pick a date and time</h2>
                <div className="flex flex-col lg:flex-row gap-8">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <button
                                type="button"
                                onClick={() => setMonth((m) => addDays(startOfMonth(m), -1))}
                                className="p-1 text-neutral-500 hover:text-white"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="font-bold min-w-[120px]">{format(month, 'MMMM yyyy')}</span>
                            <button
                                type="button"
                                onClick={() => setMonth((m) => addDays(endOfMonth(m), 1))}
                                className="p-1 text-neutral-500 hover:text-white"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-[10px] text-neutral-600 font-bold text-center mb-2">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                                <span key={d}>{d}</span>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {gridDays.map((day) => {
                                const inMonth = isSameMonth(day, month);
                                const hasSlots = slotsForDay(link, day, booked).length > 0;
                                const bookable = isDayBookable(link, day);
                                const sel = selectedDay && isSameDay(day, selectedDay);
                                return (
                                    <button
                                        key={day.toISOString()}
                                        type="button"
                                        disabled={!bookable || !hasSlots}
                                        onClick={() => {
                                            setSelectedDay(day);
                                            setSelectedStartMin(null);
                                            setError('');
                                        }}
                                        className={`h-9 text-sm font-bold rounded-lg transition-colors ${
                                            !inMonth
                                                ? 'text-neutral-800'
                                                : hasSlots
                                                  ? 'text-white hover:bg-white/10'
                                                  : 'text-neutral-700'
                                        } ${sel ? 'bg-blue-600 text-white' : ''}`}
                                    >
                                        {format(day, 'd')}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                        {selectedDay ? (
                            daySlots.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {daySlots.map((slot) => (
                                        <button
                                            key={slot.startMin}
                                            type="button"
                                            onClick={() => {
                                                setSelectedStartMin(slot.startMin);
                                                setError('');
                                            }}
                                            className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                                                selectedStartMin === slot.startMin
                                                    ? 'bg-blue-600 border-blue-500 text-white'
                                                    : 'border-white/10 text-white hover:bg-white/5'
                                            }`}
                                        >
                                            {slot.label}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-neutral-500 text-sm">No times available</p>
                            )
                        ) : (
                            <p className="text-neutral-500 text-sm">Select a date</p>
                        )}
                    </div>
                </div>

                {selectedStartMin != null && (
                    <div className="mt-8 max-w-md space-y-3 border-t border-white/10 pt-6">
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                            Your details
                        </p>
                        <input
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="Name"
                            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500/50"
                        />
                        <input
                            value={guestEmail}
                            onChange={(e) => setGuestEmail(e.target.value)}
                            type="email"
                            placeholder="Email"
                            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500/50"
                        />
                        {link.locationType === 'phone' && (
                            <input
                                value={guestPhone}
                                onChange={(e) => setGuestPhone(e.target.value)}
                                type="tel"
                                placeholder="Phone"
                                className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500/50"
                            />
                        )}
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={handleConfirm}
                            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm transition-colors"
                        >
                            {submitting ? 'Booking…' : 'Confirm booking'}
                        </button>
                    </div>
                )}

                <div className="mt-10 max-w-md">
                    <p className="text-xs font-bold text-neutral-500 mb-2">Time zone</p>
                    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/10 bg-black/30">
                        <span className="flex items-center gap-2 text-sm font-medium">
                            <Globe size={16} className="text-neutral-500" />
                            {link.timezone}
                        </span>
                        <span className="text-sm text-neutral-500">{format(new Date(), 'h:mm a')}</span>
                    </div>
                </div>
            </main>
        </div>
    );
}
