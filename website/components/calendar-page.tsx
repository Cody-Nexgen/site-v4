"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Link2,
  Plus,
  Copy,
  ExternalLink,
  Clock,
  Users,
} from "lucide-react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import InstallExtensionCard from "@/components/InstallExtensionCard";
import { CHROME_EXTENSION_STORE_URL } from "@/lib/site-config";
import {
  fetchMySchedulingLinks,
  fetchHostBookingsForCalendar,
  type MySchedulingLink,
  type HostBookingNotification,
} from "@/lib/scheduling/api";
import { formatSlotLabel } from "@/lib/scheduling/slots";
import {
  hasFocuzNowExtension,
  redirectToExtension,
  syncSessionWithExtension,
} from "@/lib/extension-utils";

interface CalendarPageProps {
  session: any;
  onBack: () => void;
}

type LinkTypeChoice = "recurring" | "oneoff";

export default function CalendarPage({ session, onBack }: CalendarPageProps) {
  const [showNewLinkModal, setShowNewLinkModal] = useState(false);
  const [links, setLinks] = useState<MySchedulingLink[]>([]);
  const [bookings, setBookings] = useState<HostBookingNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [hasExtension, setHasExtension] = useState(false);

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  useEffect(() => {
    setHasExtension(hasFocuzNowExtension());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [linkRows, bookingRows] = await Promise.all([
        fetchMySchedulingLinks(supabase),
        fetchHostBookingsForCalendar(supabase),
      ]);
      if (cancelled) return;
      setLinks(linkRows);
      setBookings(bookingRows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const bookingsForDay = (day: Date) =>
    bookings.filter((b) => isSameDay(new Date(`${b.booking_date}T00:00:00`), day));

  const openExtensionForLinkCreation = (type: LinkTypeChoice) => {
    setShowNewLinkModal(false);
    if (hasExtension) {
      syncSessionWithExtension(session);
      redirectToExtension();
      setNotice(
        `Opening the FocuzNow extension to finish creating your ${type === "recurring" ? "recurring" : "one-off"} link…`
      );
    } else {
      window.open(CHROME_EXTENSION_STORE_URL, "_blank");
      setNotice("Install the FocuzNow extension to create scheduling links with full drag-and-drop editing.");
    }
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/schedule/${slug}`;
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(url);
    }
    setNotice("Booking link copied to clipboard.");
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Calendar</h1>
              <p className="text-sm text-zinc-500">
                <a href="/app" onClick={(e) => { e.preventDefault(); onBack(); }} className="hover:text-white transition-colors underline underline-offset-2">
                  Back to dashboard
                </a>
              </p>
            </div>
          </div>
          <NeonButton onClick={() => setShowNewLinkModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> New scheduling link
          </NeonButton>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {notice && (
          <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm text-purple-200">
            {notice}
          </div>
        )}

        {/* Week strip */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">This week</h2>
            <span className="text-xs text-zinc-500">
              {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dayBookings = bookingsForDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={`rounded-xl border p-3 min-h-[110px] ${
                    isToday ? "border-purple-500/40 bg-purple-500/5" : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {format(day, "EEE")}
                    </span>
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday ? "bg-purple-600 text-white" : "text-zinc-300"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayBookings.slice(0, 3).map((b) => (
                      <div
                        key={b.id}
                        className="text-[11px] font-medium px-1.5 py-1 rounded-lg bg-purple-500/15 text-purple-200 truncate"
                        title={`${b.guest_name} — ${b.link_title}`}
                      >
                        {formatSlotLabel(b.start_min)} · {b.guest_name}
                      </div>
                    ))}
                    {dayBookings.length > 3 && (
                      <div className="text-[10px] text-zinc-500">+{dayBookings.length - 3} more</div>
                    )}
                    {dayBookings.length === 0 && <div className="text-[10px] text-zinc-600">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Saved scheduling links */}
          <GlassCard className="p-0 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Your scheduling links</h2>
              <Link2 className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="flex-1 p-2 max-h-[360px] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-sm text-zinc-500">Loading…</div>
              ) : links.length > 0 ? (
                <div className="space-y-1">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{link.title}</p>
                        <p className="text-xs text-zinc-500">
                          {link.type === "recurring" ? "Recurring" : "One-off"} · {link.durationMin}m · /schedule/{link.slug}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => copyLink(link.slug)}
                          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Copy booking link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <a
                          href={`/schedule/${link.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Preview booking page"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-zinc-500 gap-2">
                  <CalendarIcon className="w-6 h-6" />
                  <p className="text-sm">No scheduling links yet</p>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Upcoming bookings */}
          <GlassCard className="p-0 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Upcoming bookings</h2>
              <Users className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="flex-1 p-2 max-h-[360px] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-sm text-zinc-500">Loading…</div>
              ) : bookings.length > 0 ? (
                <div className="space-y-1">
                  {bookings.slice(0, 20).map((b) => (
                    <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {b.guest_name} · {b.link_title}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {format(new Date(`${b.booking_date}T00:00:00`), "EEE, MMM d")} at {formatSlotLabel(b.start_min)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
                  <p className="text-sm">No bookings yet</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Drag-edit calendar needs the extension */}
        <InstallExtensionCard
          title="Drag-and-drop calendar & full editing needs the extension"
          description="Create recurring or one-off links with custom availability, drag events to reschedule, and manage calendar groups in the FocuzNow browser extension — everything syncs back here automatically."
        />
      </main>

      {/* New link type modal — same UX as the extension's "New scheduling link" panel */}
      <AnimatePresence>
        {showNewLinkModal && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setShowNewLinkModal(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="schedule-link-type-title"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-white/12 bg-[rgba(22,24,32,0.72)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Scheduling</p>
              <h2 id="schedule-link-type-title" className="mt-1 text-xl font-semibold tracking-tight text-white">
                New scheduling link
              </h2>
              <p className="mt-1 text-sm text-neutral-400">
                Choose a recurring weekly link or a one-off date-based link.
              </p>
              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  onClick={() => openExtensionForLinkCreation("recurring")}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left transition-colors hover:bg-white/[0.08]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                    <Link2 size={16} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-white">Recurring link</span>
                    <span className="block text-xs text-neutral-500">Weekly availability that repeats</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openExtensionForLinkCreation("oneoff")}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left transition-colors hover:bg-white/[0.08]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
                    <Link2 size={16} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-white">One-off link</span>
                    <span className="block text-xs text-neutral-500">Specific dates only</span>
                  </span>
                </button>
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                {hasExtension
                  ? "This opens the extension so you can finish setting availability and save."
                  : "You'll need the browser extension to finish creating the link."}
              </p>
              {!hasExtension && (
                <a
                  href={CHROME_EXTENSION_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block text-center text-xs font-semibold text-purple-300 hover:text-white transition-colors"
                >
                  Install the extension →
                </a>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
