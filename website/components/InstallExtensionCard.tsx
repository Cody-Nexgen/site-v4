import { CHROME_EXTENSION_STORE_URL } from '@/lib/site-config';

type Props = {
  title: string;
  description: string;
};

/** Shown on web for browser-only tasks (blocking, history, live gamification stats). */
export default function InstallExtensionCard({ title, description }: Props) {
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
