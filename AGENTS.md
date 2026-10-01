# FocuzNow — notes for coding agents (Codex, Cursor, Claude)

Read this first, then `docs/focuzpass-cloud-plan.md` (the FocuzPass Cloud plan and phase status).

## The project
- `src/`: the Chrome MV3 extension (React + Vite + TypeScript). It includes FocuzPass, a zero-knowledge password manager.
- `website/`: the React/Vite site (focuznow.com, the dashboard at `/app`, the web vault at `/vault`).
- `supabase/`: migrations, edge functions, SQL tests (run with PGlite: `supabase/tests/run-with-pglite.mjs`).
- The owner browses in **Vivaldi** (Chromium) on Windows 11. The extension is loaded unpacked from `src/dist`.

## Rules (the owner's)
- **Don't commit, don't deploy, don't add dependencies.** The website isn't deployed yet. Edge functions may be deployed.
- **Database migrations need explicit approval.** Never run a plain `supabase db push`: the remote history has diverged (see the plan doc). `20260929180000_focuzpass_cloud.sql` is applied; the attachments migration is not approved.
- Release order: website first, then the extension.
- **Ask the owner to test in the browser** instead of running long headless test sessions. Give exact steps and say what they should see.
- Back up files before big rewrites (`backups/<name>-<date>/` + RESTORE.md).
- Design: FocuzNow's own look (Beam Z mark, `--fz-*` tokens), both light and dark. Don't copy competitors.
- Never extract credentials, never put the user's passwords into anything, never sign in as the user.

## Build and check (run in `src/`)
```
node node_modules/typescript/bin/tsc -b
node node_modules/eslint/bin/eslint.js <files>
node ./scripts/run-tests.mjs            # unit tests (177 passing); `npm test` fails under cmd
node node_modules/vite/bin/vite.js build   # writes src/dist; the owner then reloads it in vivaldi://extensions
```
Known lint errors that aren't ours: `vaultCore.ts` `inboxPublicJwk` (`_d`, `_ops`, `_ext`), two in `FocuzPassTab.tsx`.
The previous working build is kept in `backups/dist-working-2026-09-30/`.

## FocuzPass passkeys (the current work, 2026-09-30)
FocuzPass acts as a passkey provider inside the browser:
- `src/public/focuzpass-passkeys.js`: the page script. It runs in the page's own JS world, in every frame, and is registered by the service worker while passkeys are on. It wraps `navigator.credentials.create/get` and is versioned (`VERSION`, currently 6): a newer copy takes over from an older one already in the page.
- `src/src/content/passkeyEntry.ts` + `passkeyRequests.ts`: the content script, which runs at document_start, top frame only. It listens for the page script's requests and shows the prompt: a pill, top centre, site icon, title and subtitle, actions on the right. Answers are marked `live`; a copy cut off by an extension reload stays quiet.
- `src/src/content/passkeyOffer.ts` + `focuzPassOverlay.ts`: passkeys offered in the autofill dropdown (conditional mediation).
- `src/src/background/focuzPassBridge.ts`:
  - `PASSKEY_PREFLIGHT/CREATE/GET` (the origin is checked against what the browser reports);
  - `reconnectPasskeyTabs` re-injects into open tabs on install or update;
  - while the vault is unlocked, a 20 s `getPlatformInfo` call keeps the worker awake.
- `src/src/lib/focuzPass/passkeys/webauthn.ts`: the authenticator (ES256, "none" attestation, PRF). AAGUID `6d3f2a8c-4b1e-4f7a-9c2d-5e8b7a1f0c34`.
- Confirmed working by the owner: save and sign-in on discord.com and google.com.
- The console shows `[FocuzPass] passkey …` timing lines and `[FocuzPass] the browser's own passkeys …` lines (diagnostics; remove once passkeys are settled).

## Open items
1. **"Extension context invalidated" when signing in to FocuzPass, sometimes.** Likely cause: a page that was open when the extension was reloaded or updated. It might be the website's FocuzPass embed frame (`src/focuzpass-embed/`), the autofill overlay in a page, or the unlock window. That page still runs the old copy, whose `chrome.runtime` is gone. The overlay already throws "Extension reloaded. Refresh this page…" (`focuzPassOverlay.ts` `runtimeSendMessage`). Fix to do: find which surface shows it. When `chrome.runtime?.id` is gone, reload the frame/page automatically, or show a "FocuzNow was updated — reload" state instead of the raw error. The site script already reconnects dashboard tabs (`reconnectDashboardTabs` in `service-worker.js`); the embed iframe may need the same.
2. **Show "FocuzPass" + Beam Z on Google's passkey list (and other sites).** Sites look up the passkey's AAGUID in the community list https://github.com/passkeydev/passkey-authenticator-aaguids. The entry is ready in `docs/aaguid-submission/aaguid-entry.json`, with icons `focuzpass-icon-light.svg` and `focuzpass-icon-dark.svg`. To do: fork that repo, add the entry to its `aaguid.json` (follow their README/CONTRIBUTING format), and open a PR. The owner said yes to opening it under their GitHub account. Once merged, existing FocuzPass passkeys show the new name too.
3. Passkeys "Use another device": it hands off to the browser correctly. On Google's "approve a new passkey" step, Windows refused even with FocuzPass's passkeys off, so that refusal isn't FocuzPass.
4. Speed: if "Checking"/"Saving" is still slow, look at the timing lines. The worker staying awake while unlocked and items being encrypted in parallel (`vaultCore.encryptDocument`) were the last fixes.
5. **Website deployed to production 2026-09-30** (owner asked; `vercel --prod` from the repo root, project `focuznowwebsite-wscx`). `/`, `/app` and `/vault` return 200. But `www.focuznow.com/vault` serves the main site's page (title "FocuzNow"), not the standalone `website/vault.html`. Its CSP meta tag and the `/vault` headers from `website/vercel.json` (CSP, X-Frame-Options DENY, no-store) are missing. Check which `vercel.json` the project uses (repo root vs `website/`) and whether `vault.html` is in the build output. The web vault inside `/app` (FocuzPass tab without the extension) isn't affected.
6. **AI coach models (owner may swap):**
   - The server is `supabase/functions/_shared/aiCoachChat.ts` (`CoachModelId`, `COACH_MODELS`) and `supabase/functions/ai-coach-chat/index.ts` (the default model). After changing them, run `supabase functions deploy ai-coach-chat`.
   - The UI lists models in `src/src/lib/aiCoachModels.ts`, plus references in `AiCoachPage.tsx`, `lib/coach/demoCoach.ts` and its test, `options/ListsTab.tsx`, `options/legacy/LegacyListsTab.tsx`, and `website/components/ui/error-modal.tsx`.
   - **Since 2026-09-30 the AI goes through Vertex AI (express mode):** `GEMINI_API_BASE = https://aiplatform.googleapis.com/v1/publishers/google` in `_shared/geminiAi.ts`. The Supabase secret `GEMINI_API_KEY` holds the Vertex API key (sent as `x-goog-api-key`). `ai-coach-chat` and `extract-image-text` are deployed with it. The owner chose Gemini 2.5 Flash (regular) and 2.5 Pro (think) to fit the $8/month price.
   - Think mode sends `thinkingConfig.thinkingBudget` (`_shared/geminiAi.ts`). Gemini 3 models use `thinkingLevel`, so switch to that if a Gemini 3 model rejects it.
7. Not started: the web vault on its own origin (needs a deploy); a new master password reaching other devices (phase 6); FocuzPass for Windows (phase 8, undecided).
