import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, format } from 'date-fns';
import { Check, ChevronLeft, Clock, Globe, Link2, MapPin, Phone, User } from 'lucide-react';
import type { SchedulingLink } from '@/lib/scheduling/types';
import {
    createSchedulingBooking,
    fetchBookedSlots,
    fetchSchedulingLink,
    notifySchedulingBooking,
} from '@/lib/scheduling/api';
import { guestFieldsForLocation, validateGuestInput } from '@/lib/scheduling/guestFields';
import { slotsForDay, type BookedSlot } from '@/lib/scheduling/slots';
import BookingScheduler from './BookingScheduler';
import HostProfile, { hostProfileFromLink } from './HostProfile';

function parseSlug(): string {
    const path = window.location.pathname.replace(/\/$/, '');
    const parts = path.split('/').filter(Boolean);
    const i = parts.indexOf('schedule');
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
    return new URLSearchParams(window.location.search).get('slug') || '';
}

function locationMeta(link: SchedulingLink) {
    const value = link.locationValue?.trim();
    switch (link.locationType) {
        case 'phone':
            return { icon: Phone, label: 'Phone call', detail: value || 'Host will call you' };
        case 'in_person':
            return { icon: MapPin, label: 'In person', detail: value || 'Location shared after booking' };
        case 'custom':
            return { icon: MapPin, label: 'Meeting details', detail: value || 'See host instructions' };
        case 'link':
            return { icon: Link2, label: 'Video / link', detail: value || 'Link shared after booking' };
        default:
            return null;
    }
}

type Step = 'schedule' | 'details';

type Props = {
    client: SupabaseClient;
};

export default function BookingApp({ client }: Props) {
    const slug = useMemo(() => parseSlug(), []);
    const [link, setLink] = useState<SchedulingLink | null>(null);
    const [booked, setBooked] = useState<BookedSlot[]>([]);
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [selectedStartMin, setSelectedStartMin] = useState<number | null>(null);
    const [step, setStep] = useState<Step>('schedule');
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [guestDetails, setGuestDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState('');

    const guestFields = useMemo(
        () => guestFieldsForLocation(link?.locationType),
        [link?.locationType],
    );

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

    const daySlots = selectedDay && link ? slotsForDay(link, selectedDay, booked) : [];

    const selectedSlotLabel =
        selectedStartMin != null
            ? daySlots.find((s) => s.startMin === selectedStartMin)?.label
            : null;

    const loc = link ? locationMeta(link) : null;
    const LocIcon = loc?.icon ?? MapPin;

    const handleConfirm = async () => {
        if (!link || !selectedDay || selectedStartMin == null) return;

        const validationError = validateGuestInput(guestFields, {
            name: guestName,
            email: guestEmail,
            phone: guestPhone,
            details: guestDetails,
        });
        if (validationError) {
            setError(validationError);
            return;
        }

        setSubmitting(true);
        setError('');

        const result = await createSchedulingBooking(client, {
            slug: link.slug,
            bookingDate: format(selectedDay, 'yyyy-MM-dd'),
            startMin: selectedStartMin,
            guestName,
            guestEmail: guestFields.email ? guestEmail : undefined,
            guestPhone: guestFields.phone ? guestPhone : undefined,
            guestDetails: guestFields.details ? guestDetails : undefined,
        });

        setSubmitting(false);

        if (!result.ok) {
            const msg = result.error || '';
            if (msg.includes('SLOT_TAKEN')) {
                setError('That time was just booked. Please pick another slot.');
                setStep('schedule');
                await loadBooked(link.slug);
            } else if (msg.includes('LINK_NOT_FOUND') || msg.includes('LINK_EXPIRED')) {
                setError('This scheduling link is no longer available.');
            } else {
                setError('Could not complete booking. Please try again.');
            }
            return;
        }

        if (result.bookingId) {
            const emailed = await notifySchedulingBooking(client, result.bookingId);
            if (!emailed.ok) {
                console.warn('Booking saved but confirmation email failed:', emailed.error);
            }
        } else {
            console.warn('Booking saved without booking_id — emails will not send until migrations are applied.');
        }

        setConfirmed(true);
    };

    if (error && !link) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#0c0c0f] via-[#111] to-[#0a0a0c] text-white flex items-center justify-center p-8">
                <p className="text-neutral-400 text-center max-w-md">{error}</p>
            </div>
        );
    }

    if (!link) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#0c0c0f] via-[#111] to-[#0a0a0c] text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                    <p className="text-neutral-500 text-sm">Loading schedule…</p>
                </div>
            </div>
        );
    }

    if (confirmed && selectedDay && selectedSlotLabel) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#0c0c0f] via-[#111] to-[#0a0a0c] text-white flex items-center justify-center p-6">
                <div className="max-w-md w-full rounded-3xl border border-emerald-500/20 bg-[#141414]/90 backdrop-blur p-8 text-center shadow-[0_0_60px_-12px_rgba(16,185,129,0.25)]">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
                        <Check size={28} className="text-emerald-400" strokeWidth={2.5} />
                    </div>
                    <h1 className="text-2xl font-black text-white mb-2">You&apos;re booked</h1>
                    <p className="text-neutral-300 text-sm mb-1">
                        {format(selectedDay, 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="text-white font-semibold mb-6">
                        {selectedSlotLabel} · {link.timezone}
                    </p>
                    {guestFields.email && guestEmail ? (
                        <p className="text-neutral-500 text-sm">
                            Confirmation sent to <span className="text-white">{guestEmail}</span>
                            {guestFields.email ? ' · reminder 24h before' : ''}.
                        </p>
                    ) : (
                        <p className="text-neutral-500 text-sm">
                            {hostProfileFromLink(link).displayName} has your details and will be in touch.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0c0c0f] via-[#111] to-[#0a0a0c] text-white">
            <div className="mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
                <aside className="border-b border-white/[0.06] bg-[#0e0e12]/80 p-8 lg:w-[360px] lg:border-b-0 lg:border-r lg:min-h-screen">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400/80 mb-3">
                        Book with
                    </p>
                    <h1 className="text-2xl font-black leading-tight mb-6">{link.title}</h1>

                    <HostProfile link={link} />

                    <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="flex items-center gap-2 text-sm text-neutral-300">
                            <Clock size={16} className="text-neutral-500 shrink-0" />
                            <span>{link.durationMin} minutes</span>
                        </div>
                        {loc && (
                            <div className="flex items-start gap-2 text-sm text-neutral-300">
                                <LocIcon size={16} className="text-neutral-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-neutral-200">{loc.label}</p>
                                    {loc.detail && (
                                        <p className="text-neutral-500 text-xs mt-0.5 break-all">{loc.detail}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {link.description && (
                        <p className="mt-4 text-sm text-neutral-500 leading-relaxed">{link.description}</p>
                    )}

                    <div className="mt-8 hidden lg:block">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-2">
                            Time zone
                        </p>
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                            <Globe size={14} />
                            {link.timezone}
                        </div>
                    </div>
                </aside>

                <main className="flex-1 p-6 lg:p-10">
                    <div className="mb-6 flex items-center gap-2 max-w-md">
                        {(['schedule', 'details'] as Step[]).map((s, i) => {
                            const labels = { schedule: 'Date & time', details: 'Details' };
                            const active = step === s;
                            const done = s === 'schedule' && !!selectedDay && selectedStartMin != null;
                            return (
                                <div key={s} className="flex items-center gap-2 flex-1">
                                    <div
                                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                                            active
                                                ? 'bg-blue-600 text-white'
                                                : done
                                                  ? 'bg-white/10 text-white'
                                                  : 'bg-white/[0.04] text-neutral-600'
                                        }`}
                                    >
                                        {i + 1}
                                    </div>
                                    <span
                                        className={`text-xs font-semibold hidden sm:inline ${
                                            active ? 'text-white' : 'text-neutral-600'
                                        }`}
                                    >
                                        {labels[s]}
                                    </span>
                                    {i < 1 && <div className="h-px flex-1 bg-white/[0.06]" />}
                                </div>
                            );
                        })}
                    </div>

                    {step === 'schedule' && (
                        <div>
                            <BookingScheduler
                                link={link}
                                booked={booked}
                                selectedDay={selectedDay}
                                selectedStartMin={selectedStartMin}
                                onSelectDay={(day) => {
                                    setSelectedDay(day);
                                    setError('');
                                }}
                                onSelectTime={(min) => {
                                    setSelectedStartMin(min);
                                    setError('');
                                }}
                            />
                            <button
                                type="button"
                                disabled={!selectedDay || selectedStartMin == null}
                                onClick={() => setStep('details')}
                                className="mt-6 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-sm transition-colors"
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    {step === 'details' && (
                        <div className="max-w-md">
                            <button
                                type="button"
                                onClick={() => setStep('schedule')}
                                className="text-sm text-neutral-500 hover:text-white mb-4 flex items-center gap-1"
                            >
                                <ChevronLeft size={16} /> Change date or time
                            </button>
                            <h2 className="text-lg font-bold mb-1">Your details</h2>
                            <p className="text-sm text-neutral-500 mb-6">
                                {link.locationType === 'phone'
                                    ? 'Name and phone so the host can reach you.'
                                    : link.locationType === 'in_person'
                                      ? 'Just your name to confirm the booking.'
                                      : link.locationType === 'custom'
                                        ? 'Name and any details the host asked for.'
                                        : 'We’ll send confirmation and a reminder to your email.'}
                            </p>

                            <div className="space-y-3">
                                <label className="block">
                                    <span className="text-xs font-medium text-neutral-500 mb-1.5 flex items-center gap-1.5">
                                        <User size={12} /> Name
                                    </span>
                                    <input
                                        value={guestName}
                                        onChange={(e) => setGuestName(e.target.value)}
                                        placeholder="Your name"
                                        className="w-full bg-[#1a1a1f] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                                    />
                                </label>

                                {guestFields.email && (
                                    <label className="block">
                                        <span className="text-xs font-medium text-neutral-500 mb-1.5">
                                            Email
                                        </span>
                                        <input
                                            value={guestEmail}
                                            onChange={(e) => setGuestEmail(e.target.value)}
                                            type="email"
                                            placeholder="you@email.com"
                                            className="w-full bg-[#1a1a1f] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                                        />
                                    </label>
                                )}

                                {guestFields.phone && (
                                    <label className="block">
                                        <span className="text-xs font-medium text-neutral-500 mb-1.5 flex items-center gap-1.5">
                                            <Phone size={12} /> Phone
                                        </span>
                                        <input
                                            value={guestPhone}
                                            onChange={(e) => setGuestPhone(e.target.value)}
                                            type="tel"
                                            placeholder="+1 (555) 000-0000"
                                            className="w-full bg-[#1a1a1f] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                                        />
                                    </label>
                                )}

                                {guestFields.details && (
                                    <label className="block">
                                        <span className="text-xs font-medium text-neutral-500 mb-1.5">
                                            Details
                                        </span>
                                        <textarea
                                            value={guestDetails}
                                            onChange={(e) => setGuestDetails(e.target.value)}
                                            placeholder="Anything the host should know"
                                            rows={4}
                                            className="w-full bg-[#1a1a1f] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 resize-none"
                                        />
                                    </label>
                                )}
                            </div>

                            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

                            <button
                                type="button"
                                disabled={submitting}
                                onClick={handleConfirm}
                                className="mt-6 w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm transition-colors shadow-lg shadow-blue-900/25"
                            >
                                {submitting ? 'Booking…' : 'Confirm booking'}
                            </button>
                        </div>
                    )}

                    <div className="mt-10 lg:hidden max-w-md">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-2">
                            Time zone
                        </p>
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                            <Globe size={14} />
                            {link.timezone}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
