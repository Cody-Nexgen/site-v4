import { useEffect, useMemo, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { FREE_FOCUS_ROOM_MAX_MIN, PRO_FOCUS_ROOM_MAX_MIN } from '../lib/focusRoomRtc';

const PRESETS = [15, 25, 45, 60, 90, 120, 180] as const;

type Props = {
  open: boolean;
  value: number;
  maxMinutes: number;
  isPro: boolean;
  onClose: () => void;
  onConfirm: (minutes: number) => void;
  onUpgrade?: () => void;
};

function clampMinutes(value: number, max: number) {
  return Math.min(Math.max(5, Math.round(value)), max);
}

/** Custom duration picker for Focus Rooms (replaces bare number inputs). */
export function FocusRoomDurationModal({
  open,
  value,
  maxMinutes,
  isPro,
  onClose,
  onConfirm,
  onUpgrade,
}: Props) {
  const [draft, setDraft] = useState(() => clampMinutes(value, maxMinutes));

  useEffect(() => {
    if (!open) return;
    setDraft(clampMinutes(value, maxMinutes));
  }, [open, value, maxMinutes]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') onConfirm(clampMinutes(draft, maxMinutes));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, draft, maxMinutes, onClose, onConfirm]);

  const presets = useMemo(
    () => PRESETS.filter((p) => p <= maxMinutes),
    [maxMinutes],
  );

  if (!open) return null;

  const hours = Math.floor(draft / 60);
  const mins = draft % 60;
  const label =
    hours > 0
      ? mins > 0
        ? `${hours}h ${mins}m`
        : `${hours}h`
      : `${draft}m`;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-room-duration-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.1] bg-[#111113] shadow-[0_32px_80px_-24px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(255,255,255,0.06), transparent 55%)',
            }}
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
                <Clock size={18} className="text-neutral-200" />
              </div>
              <div>
                <h2 id="focus-room-duration-title" className="text-base font-semibold text-white tracking-tight">
                  Room duration
                </h2>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  How long should this focus room run?
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="px-5 py-6 space-y-6">
          <div className="text-center">
            <p className="text-5xl font-semibold tracking-tight text-white tabular-nums">{label}</p>
            <p className="mt-2 text-xs text-neutral-500">
              {draft} minutes · max {maxMinutes}m
              {isPro ? ' (Pro)' : ' (Free)'}
            </p>
          </div>

          <div>
            <input
              type="range"
              min={5}
              max={maxMinutes}
              step={5}
              value={draft}
              onChange={(e) => setDraft(clampMinutes(Number(e.target.value), maxMinutes))}
              className="focuz-duration-range w-full"
              aria-label="Duration in minutes"
            />
            <div className="mt-1.5 flex justify-between text-[10px] font-medium text-neutral-600 tabular-nums">
              <span>5m</span>
              <span>{maxMinutes}m</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {presets.map((p) => {
              const active = draft === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDraft(p)}
                  className={`rounded-xl px-3.5 py-2 text-sm font-semibold tabular-nums transition-colors border ${
                    active
                      ? 'bg-white text-neutral-950 border-white'
                      : 'bg-white/[0.03] text-neutral-300 border-white/[0.08] hover:bg-white/[0.07] hover:text-white'
                  }`}
                >
                  {p}m
                </button>
              );
            })}
          </div>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Custom minutes
            </span>
            <input
              type="number"
              min={5}
              max={maxMinutes}
              value={draft}
              onChange={(e) =>
                setDraft(clampMinutes(Number(e.target.value) || 5, maxMinutes))
              }
              className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-white/25 tabular-nums"
            />
          </label>

          {!isPro && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-100/90 leading-relaxed">
              Free rooms max out at <strong>{FREE_FOCUS_ROOM_MAX_MIN}m</strong>. Pro unlocks up to{' '}
              {PRO_FOCUS_ROOM_MAX_MIN}m.
              {onUpgrade ? (
                <button
                  type="button"
                  onClick={() => onUpgrade()}
                  className="ml-1 font-bold underline underline-offset-2"
                >
                  Upgrade
                </button>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-white/[0.06] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(clampMinutes(draft, maxMinutes))}
            className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-100 transition-colors"
          >
            Set {label}
          </button>
        </div>
      </div>
    </div>
  );
}

type TriggerProps = {
  value: number;
  onClick: () => void;
  className?: string;
};

/** Compact control that opens the duration modal. */
export function FocusRoomDurationTrigger({ value, onClick, className = '' }: TriggerProps) {
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  const label =
    hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${value} min`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#121214]/80 px-4 py-3 text-left outline-none transition-colors hover:border-white/20 hover:bg-white/[0.04] focus-visible:border-white/30 ${className}`}
    >
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#949ba4]">
          Duration
        </span>
        <span className="mt-0.5 block text-sm font-semibold text-white tabular-nums">{label}</span>
      </span>
      <span className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-neutral-300 group-hover:text-white">
        Change
      </span>
    </button>
  );
}
