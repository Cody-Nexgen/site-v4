import { CHROME_EXTENSION_STORE_URL } from '@/lib/site-config';
import { KeyRound } from 'lucide-react';

type Props = {
  title: string;
  description: string;
  variant?: 'default' | 'vault';
};

/** Shown on web for browser-only tasks (blocking, history, live gamification stats). */
export default function InstallExtensionCard({ title, description, variant = 'default' }: Props) {
  if (variant === 'vault') {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#202021] p-4 shadow-[0_1px_0_rgba(255,255,255,0.025)_inset]">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.09] bg-white/[0.04] text-neutral-300">
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-neutral-100">{title}</h3>
            <p className="mt-0.5 text-xs leading-5 text-neutral-500">{description}</p>
          </div>
          <a
            href={CHROME_EXTENSION_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="w-full shrink-0 rounded-md border border-white/[0.1] bg-white/[0.045] px-3 py-2 text-center text-xs font-medium text-neutral-300 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:w-auto"
          >
            Open in extension
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-400/25">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-neutral-400">{description}</p>
          <a
            href={CHROME_EXTENSION_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-neutral-200"
          >
            Install browser extension
          </a>
        </div>
      </div>
    </div>
  );
}
