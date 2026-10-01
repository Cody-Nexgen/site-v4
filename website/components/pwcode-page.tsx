import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase as siteSupabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { embedSrc, readEmbedToHost } from "@focuz/lib/focuzPass/embed";
import "@/focuz-web.css";

type Phase =
  | { kind: "booting" }
  | { kind: "missing" }
  | { kind: "outdated" }
  | { kind: "ready"; src: string; origin: string; scheme: "light" | "dark" }
  | { kind: "error"; message: string };

/** Reads the code from the link (focuznow.com/pwcode#CODE) once, then takes it out of the address bar and history. */
function takeCodeFromUrl(): string | undefined {
  const raw = window.location.hash.replace(/^#/, "") || new URLSearchParams(window.location.search).get("c") || "";
  if (raw) window.history.replaceState(null, "", window.location.pathname);
  return raw || undefined;
}

/**
 * focuznow.com/pwcode: type (or open the QR link for) a transfer code from another device, and
 * the vault lands in the FocuzPass of the extension installed in this browser. The card is the
 * extension's own page in a frame, so the code, the transfer and the other vault's master
 * password never touch this site's code.
 */
export default function PwCodePage() {
  const [phase, setPhase] = useState<Phase>({ kind: "booting" });
  const [height, setHeight] = useState(180);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [initialCode] = useState(() => (typeof window === "undefined" ? undefined : takeCodeFromUrl()));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Theme and design tokens, same order as the web dashboard.
        window.__FOCUZ_SITE_SUPABASE__ = siteSupabase as never;
        const { installWebChromeShim, findFocuzPassEmbed } = await import("@focuz/lib/platform/webPlatform");
        installWebChromeShim();
        const { bindSiteSupabaseClient } = await import("@focuz/lib/supabase");
        const { initializeDashboardColorMode, resolveDashboardColorMode } = await import("@focuz/lib/themes");
        bindSiteSupabaseClient(siteSupabase as never, { url: supabaseUrl, anonKey: supabaseAnonKey });
        document.documentElement.classList.add("focuz-web-dashboard");
        const mode = await initializeDashboardColorMode();
        await Promise.all([import("@focuz/styles/focuzDesign.css"), import("@focuz/index.css")]);
        const lookup = await findFocuzPassEmbed();
        if (cancelled) return;
        if (lookup.kind !== "ready") return setPhase({ kind: lookup.kind });
        const scheme = resolveDashboardColorMode(mode);
        const src = embedSrc(lookup.embedUrl, { view: "receive", theme: scheme, code: initialCode });
        setPhase({ kind: "ready", src, origin: new URL(lookup.embedUrl).origin, scheme });
      } catch (error) {
        if (!cancelled) setPhase({ kind: "error", message: error instanceof Error ? error.message : "The page didn't load." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialCode]);

  // The card inside the frame reports its height so the page flows around it.
  useEffect(() => {
    if (phase.kind !== "ready") return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || event.origin !== phase.origin) return;
      const message = readEmbedToHost(event.data);
      if (message?.type === "focuzpass-embed:height" && message.height) setHeight(message.height);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [phase]);

  return (
    <div className="focuz-dashboard flex min-h-screen flex-col items-center bg-[var(--fz-bg)] px-4 pb-16 pt-[12vh] text-[var(--fz-text-1)]">
      <div className="w-full max-w-[30rem]">
        <a href="/" className="mb-8 inline-flex items-center gap-2 text-[13px] font-semibold tracking-[-0.01em] text-[var(--fz-text-2)] hover:text-[var(--fz-text-1)]">
          FocuzNow
        </a>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Add passwords to FocuzPass</h1>
        <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--fz-text-3)]">
          Copy a vault from another device into FocuzPass in this browser. It arrives encrypted and stays on this device.
        </p>

        <div className="mt-7">
          {phase.kind === "booting" && (
            <Card>
              <div className="flex justify-center py-10">
                <div className="size-6 animate-spin rounded-full border-2 border-[var(--fz-border-strong)] border-t-[var(--fz-text-2)]" />
              </div>
            </Card>
          )}

          {(phase.kind === "missing" || phase.kind === "outdated") && (
            <Card>
              <Notice title={phase.kind === "missing" ? "FocuzNow isn't installed in this browser" : "Update FocuzNow to continue"}>
                {phase.kind === "missing"
                  ? "FocuzPass keeps passwords in the FocuzNow extension, so the transfer has to land there. Install the extension in this browser (or open this page in the browser that has it), then reload."
                  : "This version of the extension is too old for this page. Update it (or reload it in chrome://extensions), then reload this page."}
                <button type="button" onClick={() => window.location.reload()} className="mt-4 block rounded-[8px] bg-[var(--fz-text-1)] px-3.5 py-2 text-[13px] font-medium text-[var(--fz-bg)]">
                  Reload
                </button>
              </Notice>
            </Card>
          )}

          {phase.kind === "error" && (
            <Card>
              <Notice title="Something went wrong">{phase.message}</Notice>
            </Card>
          )}

          {phase.kind === "ready" && (
            <iframe
              ref={frameRef}
              src={phase.src}
              title="FocuzPass"
              allow="camera; clipboard-write"
              className="block w-full border-0 bg-transparent"
              // Same color-scheme as the frame's page, or Chrome paints an opaque backdrop behind it.
              style={{ height, colorScheme: phase.scheme }}
            />
          )}
        </div>

        <p className="mt-5 text-[12.5px] leading-[1.55] text-[var(--fz-text-4)]">
          No code yet? On the device that has your passwords, open FocuzPass and choose Transfer.
        </p>
      </div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-[16px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] p-5 shadow-[0_1px_2px_oklch(0_0_0/0.08)]">{children}</div>;
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="py-1">
      <p className="text-[15px] font-medium text-[var(--fz-text-1)]">{title}</p>
      <div className="mt-1.5 text-[13.5px] leading-[1.55] text-[var(--fz-text-3)]">{children}</div>
    </div>
  );
}
