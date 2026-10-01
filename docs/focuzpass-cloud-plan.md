# FocuzPass Cloud — plan

Approved 2026-09-29 and being built phase by phase; each phase below says where it stands. Nothing is released yet. The FocuzPass Cloud database migration is applied.

FocuzPass today keeps the vault on one device. FocuzPass Cloud keeps it in sync across a user's
devices through Supabase, **zero-knowledge**: FocuzNow's servers only ever hold ciphertext and
can't open it, even with full database access. Cloud is the default for paying subscribers; free
users keep today's local vault.

---

## Decisions

| # | Decision | Status |
| --- | --- | --- |
| 1 | **FocuzPass on the website** | **Decided (2026-09-29):** keep it, but the website stops receiving vault contents. The tab becomes a frame of the extension's own FocuzPass page, which the site can't read into. See "FocuzPass on the website". |
| 2 | **Subscription lapses** | **Decided:** the vault goes read-only with no autofill. Resubscribing within 90 days brings everything back; the user can also download a CSV backup. See "Subscription lapses". |
| 3 | **Existing Pro users** with a local vault | Recommended: a one-time "Turn on sync" prompt, never an automatic move (they must save an Emergency Kit anyway). |
| 4 | **Recovery key** at setup | **Decided:** optional, suggested by default. |
| 5 | **Two-factor sign-in** for cloud | **Decided:** strongly encouraged at launch, required in a later phase. |
| 6 | **Argon2id** (new WASM dependency) | Recommended: later. PBKDF2 at 600k is acceptable because the Security Key already protects database dumps. |
| 7 | Enterprise (plan.md): org admins never get access to members' vaults | To confirm. |
| 8 | **Passkeys after a subscription lapses** | **Decided (2026-09-29):** passkey sign-in keeps working for the 90 days, with a notification every time showing how many days are left. New passkeys can't be saved (the vault is read-only). |
| 9 | **Passkeys for free users** | **Decided (2026-09-29):** they work, stored on that device only; no Cloud sync, so they don't reach other devices. |

---

## FocuzPass on the website

**Today:** the website's FocuzPass tab is website code that asks the extension for decrypted items through the page bridge. Anything that can run script on focuznow.com could read an unlocked vault: a bad npm update, a compromised deploy, or script injection.

**1Password's web app** is JavaScript their server sends, which decrypts in the page. Their protection is a very strict Content Security Policy and no third-party code. Their security write-up acknowledges that a compromised server could still send bad code. It's a good bar, but it isn't tamper-proof.

**FocuzPass can do better, because it already has an extension.**
- The website's FocuzPass tab becomes an `<iframe>` of an extension page: `chrome-extension://<id>/src/focuzpass-embed/index.html`.
- That page's code ships inside the extension, signed through the Chrome Web Store. The website can't change it.
- The browser keeps the frame's contents, typing and clipboard away from the website, because it's a different origin.
- The frame talks to the service worker as an extension page, never through the page bridge.

It looks the same to the user. What changes:

| | Today | With the frame |
| --- | --- | --- |
| Who runs the vault UI on focuznow.com | website code | extension code |
| Compromised site can read the vault | yes, if unlocked | no |
| Vault contents through the page bridge | yes | no: the bridge keeps only status, "open the unlock window" and ping |
| `/pwcode` master password typed into | website code | the extension frame |

**Rules for the frame**
- **Only focuznow.com can embed it.** Its `web_accessible_resources` entry matches focuznow.com (plus dev localhost on unpacked installs) with `use_dynamic_url`.
- **It checks who embedded it.** It verifies `location.ancestorOrigins` and refuses to render anywhere else, which stops other sites framing it to trick clicks.
- **It only accepts a theme hint from the parent**, and never posts anything back apart from its height.
- **Unlocking still happens in the extension's own window.** No web design can stop a compromised site from drawing a fake password box, so the frame never asks for the master password itself (except `/pwcode`'s "other vault" password, inside the frame).

**Related fix in the same phase:** today the whole options page (`src/options/*`) can be framed by any website (`<all_urls>`). Restrict that to focuznow.com, or remove it if nothing needs it.

**Also on the site:** a strict Content Security Policy, no third-party scripts on dashboard pages, and Subresource Integrity on assets. That's defence in depth for everything else the dashboard does.

## Phones and computers without the extension

The frame only works where the extension is installed, which means desktop Chrome and other Chromium browsers. Phones can't run it: Chrome on Android and iOS has no extensions. (Today FocuzPass doesn't work on phones at all, because the website tab needs the extension.)

With Cloud, the vault can reach phones through two clients.

**1. Web vault (cloud only, Pro) at `vault.focuznow.com`.** This is the 1Password/Bitwarden model: the page decrypts in the browser.
- **Sign-in:** account sign-in (two-factor), then master password plus Security Key the first time. Or approve the phone from a trusted computer: the phone shows a QR, the computer scans it, and both show the same 6-digit match code.
- **After that** the phone's browser is a trusted device and needs only the master password.
- **What it can do:** view, search, copy, add and edit.
- **What it can't do:** autofill other apps or sites. Browsers don't let a website do that.
- **Risk:** it brings back "the server sends the code", so it gets the strictest setup we can manage:
  - its own subdomain with nothing else on it (no marketing pages, no analytics, no third-party scripts);
  - strict CSP with Trusted Types;
  - Subresource Integrity;
  - a minimal dependency list;
  - release builds with published hashes.
- **Auto-lock** faster than the extension (e.g. 5 minutes, and on tab hide).
- **On desktop with the extension installed,** the site sends the user to the extension frame instead, which is stronger.

**2. Mobile app (later).** Real phone autofill (Android Autofill framework, iOS AutoFill credential provider) needs a native app. Same key design, same Supabase tables; the phone is just another trusted device. This is the long-term answer for phones and a separate project.

**Decided:** FocuzPass works without the extension through the web vault; with the extension it runs in the frame, which is the more secure path. The web vault needs Cloud (the vault has to come from somewhere), so it lands right after sync (phase 4). The mobile app comes after Cloud is stable.

---

## Tiers and defaults

| | Free | Pro | Pro, lapsed (≤ 90 days) |
| --- | --- | --- | --- |
| Local vault, autofill, generator, import | ✓ | ✓ | view and copy only (see below) |
| Transfer by code/QR, `.focuzpass` backup file | ✓ | ✓ | backup file and CSV export |
| Cloud sync across devices | — | ✓ (default at setup) | paused, restored on resubscribe |

- **New Pro user setting up FocuzPass:** setup creates a cloud vault by default: master password → Security Key → Emergency Kit → syncing. "Keep it on this device only" is a secondary option.
- **Pro user with an existing local vault:** a one-time prompt to turn on sync, never an automatic move.
- **Free user:** unchanged; cloud shows as a Pro feature.
- **Local-first either way.** Every device keeps a full encrypted copy and works offline; the cloud is replication. That's what makes lapses and outages harmless.
- **Enforced by the server, not the client.** Row-level security only accepts writes from entitled users. Reads and deletes are always allowed, so nobody is locked out of their own data.

---

## Keys

```
master password ──PBKDF2 600k──┐
                               ├─ HKDF ─→ key-encryption key ─wraps→ account key ─wraps→ vault keys ─encrypt→ items
Security Key (128-bit) ─HKDF───┘                                        │
                                                        recovery key (optional) ─wraps┘
```

- **Master password:** memorized. Unlocks FocuzPass day to day. Never leaves the device, never sent to the server, never the same as the account password.
- **Security Key:** 26 random characters (≥128 bits) with a version prefix, e.g. `A1-3KF9W-…`. Made once per account and kept on each trusted device. Shown once in the Emergency Kit. The server never has it.
- **Account key and vault keys:** random 256-bit AES-GCM keys. Changing the master password only re-wraps the account key, so no items are re-encrypted.
- **Why two secrets:** a leaked database plus the master password is useless without the Security Key. A stolen Security Key is useless without the master password. The account password protects neither; it only gates downloading ciphertext.
- **Crypto:** WebCrypto only, with no new dependencies: PBKDF2-SHA256, HKDF-SHA256, AES-256-GCM (random 96-bit IVs), ECDH P-256 for devices.
- **Binding:** every ciphertext carries associated data `fp2|user|record id|revision|key version`. A row copied to another id or replayed as a different revision fails to decrypt.
- **Versioning:** every stored structure has a format version, so key derivation, algorithms and key versions can be upgraded later.
- **Local mode gets the same hierarchy,** with the key-encryption key from the master password alone. That's what finally allows changing the master password (not possible today).

---

## What lives where

**Only on the device**
- The master password, the Security Key and all unwrapped keys (held in memory and the trusted-context session store).
- Device private keys.
- Every item field: titles, URLs, usernames, passwords, notes, one-time-code secrets, cards.
- Search, autofill matching and site icons.
- Emergency Kit generation.
- Never in logs, analytics or crash reports.

**In Supabase (ciphertext and what sync needs)**

| Table | Holds |
| --- | --- |
| `fp_accounts` | format version, KDF settings (algorithm, iterations, salt), Security Key version id (random, not derived from it), wrapped account key, optional recovery-wrapped account key, revision |
| `fp_keys` | per-vault keys wrapped by the account key, key version |
| `fp_records` | one row per item / vault / tag / synced setting: random id, kind, ciphertext, IV, key version, revision, deleted flag, `server_seq` (sync cursor), `updated_at` |
| `fp_devices` | id, public key, encrypted name, created, last seen, revoked |
| `fp_device_requests` | pending new-device approvals: new device's public key, encrypted answer, expiry (minutes) |
| `fp_security_events` | sign-ins, device added or removed, key rotations, password reset. No secrets. |

**Never in Supabase:** the master password, the Security Key, any hash of either, unwrapped keys, item plaintext, password hints.

**Row-level security (every table)**
- `user_id = auth.uid()` in both `using` and `with check`.
- No `anon` access. No security-definer shortcuts, apart from one entitlement check.
- Inserts and updates also require `private.has_pro_entitlement(auth.uid())`. This generalizes the existing attachments check: an active or trialing subscription, or a free Pro grant.
- Select and delete need only ownership.

**Triggers**
- Each write must carry `revision = old + 1`, rejecting stale writes.
- `server_seq` comes from a sequence.
- `updated_at = now()`.
- Size caps: ciphertext ≤ 256 KB, ≤ 20,000 records per user.

**Other server-side rules**
- Everything cascades on account deletion.
- Sync notifications use `postgres_changes`, which respects row-level security.

---

## Flows

**Setup (Pro, default)**
1. The user creates a master password.
2. The device generates the Security Key, account key and vault key, and uploads the wrapped keys and encrypted records.
3. The Emergency Kit is shown: Security Key, account email, sign-in address. It downloads as a one-page PDF with lines to write the FocuzNow password and master password on by hand (FocuzNow never has either), plus a setup code (QR) holding the email and Security Key for a new device.
4. The user must confirm they saved it by typing its last 4 characters.
5. Optionally, they create a recovery key.

**Unlock on a trusted device:** master password only. The Security Key is already on the device.

**Sync**
- Each device keeps a cursor and pulls records with a newer `server_seq`.
- It pushes local changes with the expected revision. On a conflict it pulls, merges and retries.
- If both sides changed the secret fields, both versions are kept and one is marked as a conflict copy, so nothing is lost silently.
- Deletes are tombstones.
- Each device remembers the highest revision it has seen per record and refuses older ones (rollback protection).

**New device** (sign in first; two-factor recommended). Either:
- **Type the Security Key and the master password.**
- **Scan the setup code on the Emergency Kit** (`FZKIT1{"e":email,"k":SecurityKey,"i":keyId}`). It fills in the email and Security Key; the FocuzNow password and master password are still typed. Needs a camera, so it's for the phone app and the web vault on phones (phases 4–5).
- **Approve from a trusted device:**
  1. The new device shows a QR code carrying its public key, reusing the transfer channel.
  2. Both screens show the same 6-digit code derived from both keys; the user checks they match (stops a server-in-the-middle).
  3. The trusted device sends the Security Key encrypted to the new device.
  4. The master password is still required.

**Revoking a device**
1. Mark it revoked.
2. An edge function (service role stays server-side) signs out its sessions.
3. The device already had the keys, so revoking prompts a Security Key rotation.

**Rotation**
- **Security Key:** new key → re-wrap the account key → update each trusted device → delete the old wrapped key.
- **After a real compromise:** also new account and vault keys, with every item re-encrypted on the device in resumable batches.
- **Old database backups** still hold the old keys; nothing can fix that. Keep backup retention short (7 days) and tell users to change their most important passwords.

**Account password reset:** email reset restores sign-in only. Every device is notified, and decrypting still needs the master password plus the Security Key (or a trusted device).

**Forgot master password**, in this order:
1. A trusted device with fingerprint/face unlock (WebAuthn PRF, later phase) sets a new one.
2. The recovery key sets a new one.
3. Otherwise, it's unrecoverable. Say so plainly at setup.

**Subscription lapses (decided)**
- **The vault goes read-only.** The user can open it, view, copy and search, but can't add, edit, import or autofill.
  - The server refuses writes (row-level security entitlement check).
  - The extension hides editing and turns off the in-page autofill overlay for that vault.
  - Local save prompts ("save this login?") are off too.
- **A banner offers two ways out:**
  - **Resubscribe:** within 90 days everything comes back as it was (cloud copy intact, sync resumes, autofill returns).
  - **Download a CSV backup.**
    - Asks for the master password again first.
    - Warns that the file is not encrypted.
    - Uses the same columns as the "Other app (CSV)" importer, so it re-imports cleanly anywhere, including FocuzPass itself.
    - The encrypted `.focuzpass` backup is offered alongside as the safer option.
- **Reminder emails** at 7, 30 and 83 days.
- **At 90 days the cloud copy is deleted** (scheduled edge function). Recommendation: devices keep their read-only copy, so nothing vanishes by surprise, and resubscribing later re-uploads from that copy.
- **The user can delete the cloud copy themselves** at any time.
- **Note:** free users get a local vault with autofill, so a lapsed user can export a CSV and import it into a free local vault. That's fine, but it leaves a plaintext file around. Worth considering a one-click "Keep it on this device (free, local-only)" that does the same move without the CSV.

---

## Code changes

| Area | Change |
| --- | --- |
| `lib/focuzPass/crypto.ts` | HKDF, key wrap/unwrap with associated data, ECDH device keys, Security Key generation/format |
| `lib/focuzPass/vaultCore.ts` | Key hierarchy; items as separate records instead of one blob; v1→v2 migration (atomic, resumable); change master password |
| `lib/focuzPass/types.ts` | v2 formats, cloud and device state |
| `lib/focuzPass/sync/` (new) | Push/pull, revisions, conflicts, tombstones, offline queue, high-water marks, realtime nudge |
| `background/focuzPassBridge.ts` | Cloud, device, rotation and recovery messages, extension pages only (not the website bridge) |
| `lib/focuzPass/transfer/` | Reused for device approval (plus the 6-digit match code) |
| `options/FocuzPassTab.tsx` + new screens | Setup wizard, Emergency Kit, devices, security activity, rotation, lapse banner |
| `supabase/migrations/` | Tables, row-level security, triggers, `private.has_pro_entitlement` |
| `supabase/functions/` | Revoke-device sessions; retention cleanup (scheduled) |
| Website | Never sees vault contents. FocuzPass tab and `/pwcode` become a frame of `src/focuzpass-embed/` (new extension page). Strict CSP. |
| `manifest.json` | `web_accessible_resources`: embed page for focuznow.com only; stop exposing `src/options/*` to every site |
| Web vault (new, phase 4) | A small separate app for `vault.focuznow.com` reusing `lib/focuzPass` crypto and sync, with its own hardened hosting config |

---

## Phases

Each phase ships on its own and tests its security boundary before moving on.

0. **Prerequisites**
   - Web bridge hardening. ✅ Done 2026-09-29.
   - FocuzPass on the website as an extension frame (website tab and `/pwcode`); the page bridge carries nothing from FocuzPass. ✅ Built 2026-09-29, not deployed. **Release order: website first, then the extension** (an older site build still asks the bridge for vault contents, which the new extension refuses).
   - Frame page embeddable by focuznow.com only; the dashboard renders nothing but the blocked view when another site frames it. ✅ Built 2026-09-29.
   - ✅ Built 2026-09-29: stop loading code from a third-party CDN at runtime. The site's built bundle imports `https://esm.sh/@supabase/supabase-js@2.39.3` (`website/lib/supabase.ts`, `website/supabase.ts`) and `https://esm.sh/@google/genai` (`components/ui/error-modal.tsx`), and `index.html` carries an esm.sh import map. Whatever esm.sh serves runs with the site's sign-in session. Import the npm packages instead.
   - Strict CSP on the site (after the above, so `script-src` can be `'self'`). ✅ Built 2026-09-29 in report-only mode with `script-src 'self'`, plus X-Frame-Options, nosniff and a referrer policy. A production-build check across the main pages showed nothing it would block. Enforce it after one release shows no reports.
   - Decisions 3, 6 and 7.
   - Check the Stripe webhook keeps `subscriptions` current. `stripeBilling.ts` notes the database can lag it, and the webhook itself isn't in this repo.
1. **Local key hierarchy (no server).**
   - Random vault key wrapped by the master password, automatic upgrade of existing vaults on unlock (with a kept copy until it checks out), change master password, backup packages v2. ✅ Built 2026-09-29, not released.
   - Still to do: records instead of one blob (needed for sync, so it goes with phase 3).
   - Tests: migration with no data loss, including an interrupted one; password change; everything still encrypted at rest.
2. **Cloud foundation.** ✅ Built 2026-09-29, not released. **The migration is applied to the live project (2026-09-29).**
   - Migration with tables, row-level security, triggers and entitlement (`supabase/migrations/20260929180000_focuzpass_cloud.sql`).
     - How it was applied: the remote migration history has diverged from `supabase/migrations/`, so a plain `supabase db push` would try to push many other files. Only this one went up, from a temporary folder holding empty placeholders for every version already on the server plus this file (dry run first).
     - Checked live afterwards: anon gets "permission denied" on all four tables, and the private functions aren't exposed over the API.
   - Security Key and Emergency Kit (`cloud/kitPdf.ts`: real PDFs made on the device, no library):
     - FocuzNow's Beam Z mark, three numbered steps (sign in, unlock, new device);
     - the Security Key in one box per character;
     - lines to write both passwords on;
     - a setup-code QR and a clickable sign-in link.
     - The recovery key is a separate PDF, because with a sign-in it opens the vault without the master password.
   - Pro setup wizard, a one-time prompt for Pro users, and a first upload that resumes if interrupted.
   - Tests:
     - SQL security tests in PGlite: a second user can't read or write the first user's rows; a lapsed user can read and delete but not write; anon gets nothing; stale revisions are refused; the record cap holds; account deletion cascades. 8 deliberately broken migrations are all caught.
     - Unit tests: nothing readable in what's sent; a database copy plus one secret opens nothing, while both secrets (or the recovery key) open everything.
     - PDF tests: valid structure (xref offsets, stream length, plain ASCII), escaping, the key boxed character by character (and still readable when copied out spaced), the setup code's contents. The QR was also checked by rendering the PDF and decoding it.
   - Before release: run the SQL tests against a real local Supabase (`supabase test db`) once Docker is available.
3. **Sync, a second device, the web vault, and passkeys.** ✅ Built 2026-09-29/30, not released.
   - **Sync** (`lib/focuzPass/cloud/sync.ts`):
     - every item, vault and tag is its own sealed record. Each device remembers the newest revision it has seen of each record and a fingerprint of it, so it knows what changed locally without keeping old copies;
     - a sync pulls, merges, then pushes. The server refuses anything but the next revision, so a device that lost the race pulls and merges again;
     - merging: an untouched copy takes the newer version. When both sides changed a record, the later edit wins if the secrets are the same; if the secrets differ, both are kept and the local one becomes a "(conflict copy)". Deleted on one device and edited on another: the edit wins;
     - refused and never applied: rows that don't open (tampered or forged), a ciphertext moved under another id, a body whose id doesn't match its row, and older revisions than one already seen (rollback);
     - records a newer version writes (a new item type, settings) are kept exactly as they came, never deleted or rewritten;
     - each pull re-reads the previous pull's window, so a write that committed late isn't missed;
     - a local change made while a merge is in flight makes the merge start over (tested by editing the very record being replaced).
   - **When it syncs:**
     - a quarter-second after any change, right after unlocking, every 2 minutes while unlocked, when you come back to FocuzPass, and on "Sync now";
     - **realtime:** after every push, the device sends an empty "changed" message on a Supabase Realtime broadcast channel named from the account key (so only the account's devices can name it). The others pull straight away. No migration: broadcast needs no table. The open connection keeps the service worker awake only while the vault is unlocked;
     - when other devices' changes arrive, open FocuzPass pages reload;
     - errors show under Cloud sync; local changes are never lost and go up next time.
   - **Joining another device:**
     - a device with no vault: the secure setup window has "I already use FocuzPass Cloud" (Security Key and master password; the vault comes down encrypted);
     - a device with its own vault: Cloud sync → "Add this device". The cloud vault comes down, this device's items that aren't in it are added (vaults and tags merged by name), and the device switches to the cloud master password. That needs this device's master password too, and the old vault is kept aside until the new one opens;
     - approving by QR stays in phase 5.
   - **Web vault: the real FocuzPass, with editing** (moved up from phase 4):
     - when the website's FocuzPass tab finds no extension, it opens the web vault right there, automatically;
     - it's the same `FocuzPassTab` UI (same vaults, tags, categories, editor), backed by `lib/focuzPass/webVaultBackend.ts`: the same vault core as the extension, in the page's memory, opened from the cloud copy each time;
     - the locked screen is FocuzPass's own card, with the Security Key and master password fields on it;
     - every edit syncs straight away, and realtime brings other devices' changes in;
     - it locks after 5 idle minutes, when the tab closes, or on Lock; nothing is stored in the browser;
     - extension-only features (passkeys, the secure window) are hidden or say so;
     - `website/vault.html` shows the same thing on its own, as its own small bundle with an enforced CSP (build-time meta tag and a Vercel header, plus `X-Frame-Options: DENY` and `no-store`), ready to move to `vault.focuznow.com`. `vault.html?demo` (dev only) runs it on an in-memory cloud;
     - trade-off: inside the dashboard, the vault runs next to the rest of the site's code. That's why the extension, when present, still gets the frame.
   - **Passkeys** (see [Passkeys](#passkeys)): on by default, with decisions 8 and 9 above. Checked in real Chrome 153 (31 checks):
     - save, then sign in, with the signature verified in the page for its origin and challenge;
     - PRF results the same at creation and sign-in;
     - sign-in suggestions: a passkey picked from FocuzPass's own dropdown on the username field;
     - a cross-origin iframe allowed to use passkeys: the prompt in the top page, crossOrigin and topOrigin signed;
     - an iframe without permission left to the browser;
     - "Use another device" reaches the browser's own passkeys;
     - a locked vault opens the unlock window, then carries on;
     - a request made while the page is still loading gets FocuzPass, not Windows Hello;
     - turning it off restores the browser's own API in pages and iframes.
   - **The Windows Hello bug** (the user saw saving go to Windows Hello), two causes:
     - the setting was off by default;
     - the page script gave up after 1.5 s when a request was sent before FocuzNow's content script was listening (content scripts load as modules, a moment after the page starts).
     - Fixed: passkeys are on by default; the listener has its own document_start script; the page script repeats a request until it's acknowledged; turning passkeys on also injects into tabs already open.
     - A third cause (2026-09-30, Discord in Vivaldi): a tab left open across an extension reload or update. Its content script is cut off from the extension and answered every request with "use the browser", so saving went to Windows (1Password, the Windows passkey provider there).
     - Fixed:
       - on install or update, FocuzNow injects the listener and the page script into open tabs;
       - a cut-off listener stays quiet, and live listeners mark their answers `live`;
       - the page script waits 0.6 s for a live answer before taking an unmarked "use the browser";
       - a newer page script takes over from one already in the page (versioned, going to the methods from before FocuzPass);
       - an out-of-date registration is updated.
     - The prompt was redesigned the same day: top centre, the site's tab icon, then title and subtitle, then Save or Sign in on the right. It shows "Checking…" within 0.3 s while a sleeping worker wakes, then "Saving…" and "Saved".
     - **Confirmed by the user on discord.com in Vivaldi (2026-09-30):** saved a passkey and signed in with it, "even faster than 1Password". The earlier "An error occurred" at sign-in went away after deleting the old passkeys and saving fresh (most likely a passkey Discord never registered).
   - **Emergency Kit copy:** the key used to copy as "A 1 7 Q …" because each character was drawn on its own. It's now one gapless monospace run with one box per group (dashes in the text but not painted). Checked: copies as `A1-7QX2KD-…` in PDFium (Chrome, Edge), MuPDF (SumatraPDF) and pdf.js (Firefox).
   - **Tests** (all passing):
     - the whole suite: 177 tests;
     - 11 sync tests, plus 7 deliberately broken versions of the sync code, all caught;
     - realtime (2), the web vault backend (4), WebAuthn (8, including PRF against the spec formula and iframe client data), and vault passkeys (4, including a transfer package);
     - the real-browser checks above;
     - the web vault in headless Chrome (12, both themes).
   - **Still to do:**
     - the web vault on its own origin (`vault.focuznow.com`, with Google sign-in added to Supabase's redirect list): deploying;
     - a new master password reaching the other devices' local unlock (phase 6).
4. **Web vault: FocuzPass without the extension** (`vault.focuznow.com`: phones, other browsers, computers without FocuzNow).
   - The web vault itself (the real UI, with editing) landed in phase 3 (above). Still here: its own origin and hosting, scanning the Emergency Kit's setup code on phones, and remembering the Security Key on a trusted browser if wanted.
   - Sign-in with Security Key plus master password, view/search/copy/edit, fast auto-lock, hardened hosting.
   - The website's FocuzPass tab sends visitors without the extension here. With the extension they keep the frame, which is the more secure path.
   - Tests: nothing sensitive in the page's storage while locked; CSP blocks injected script; a browser without the Security Key can't decrypt.
5. **Devices.**
   - Approve by QR plus match code (phones and the web vault included); list; revoke. (Joining by Security Key is in phase 3.)
   - Tests: a new device without the Security Key can't decrypt; a swapped public key shows mismatched codes; revoked sessions end.
6. **Rotation, recovery, lapse.**
   - Security Key rotation, full rotation, recovery key.
   - Lapse: read-only mode with no autofill, banner, CSV export, 90-day cleanup, reminder emails, delete cloud copy.
   - Tests: an old Security Key stops working; recovery key resets the master password; a database dump plus one secret opens nothing; a lapsed account can't write through the API directly; resubscribing on day 89 restores everything.
7. **Hardening.**
   - Required two-factor (row-level security checks `aal2`).
   - Fingerprint/face unlock (WebAuthn PRF).
   - Security activity view.
   - External review before general release.
8. **FocuzPass for Windows (OS-level passkey provider).** A separate app on its own release track (code signing, Store or MSIX). It can start once phase 3's passkey core exists and doesn't block anything else. See [Passkeys](#passkeys).

---

## Passkeys

Researched 2026-09-29. The core and the browser path were built in phase 3 (see phase 3 for what's checked); the Windows app is phase 8. Passkey items now hold the passkey itself (`passkey`, stored encrypted in the item's `privateKey` field); older passkey items still hold only metadata.

**What's built:**
- `lib/focuzPass/passkeys/webauthn.ts`: ES256 keys, CBOR, authenticator data, "none" attestation, DER signatures, rpId checks, PRF, and cross-origin client data;
- `vaultCore` passkey methods: preflight, create (a new passkey for the same account replaces the old one), and get;
- `public/focuzpass-passkeys.js`: the page script, registered in every frame while the setting is on:
  - iframes forward to the top page only when the page allowed them to use passkeys;
  - conditional mediation runs alongside the browser's own;
  - immediate mediation stays with the browser;
- `content/passkeyEntry.ts` + `passkeyRequests.ts`: the listener (at document_start) and the prompt, which only reacts to real clicks;
- `content/passkeyOffer.ts`: passkeys offered in FocuzPass's own sign-in suggestions;
- bridge messages checked against the frame origin the browser reports (an iframe's origin from the message the browser delivered);
- transfer packages carry passkeys;
- FocuzPass › profile menu › Passkeys, on by default and labelled experimental.

**Goal:** FocuzPass creates and keeps real passkeys (the private keys, encrypted like every other secret) and syncs them as ordinary item records, so a passkey saved on one computer works on the others and later on phones. It should show up in the operating system's own passkey dialog like 1Password and Bitwarden do, not as a page trick.

### What the platforms allow

- **Windows 11: a real OS-level provider (plugin authenticator API).**
  - Generally available since the November 2025 security update; 1Password and Bitwarden were first.
  - Needs Windows 11 24H2 (build 26100.6725+) or 25H2 (26200.6725+), and Windows SDK 10.0.26100.7175+.
  - It's a packaged desktop app (`Package.appxmanifest`, so MSIX package identity) that registers a COM server and implements `IPluginAuthenticator`. APIs: `WebAuthNPluginAddAuthenticator`, `WebAuthNPluginAuthenticatorAddCredentials`/`RemoveCredentials` (puts passkeys into the system autofill list), `WebAuthNPluginPerformUserVerification` (Windows Hello as user verification, the documented way; nothing hooks or replaces Windows Hello), `WebAuthNPluginUpdateAuthenticatorDetails`, `WebAuthNPluginRemoveAuthenticator`, and `CancelOperation`.
  - The user turns it on in Settings > Accounts > Passkeys > Advanced options. After that, FocuzPass is offered next to Windows Hello, phones and security keys in Chrome, Edge and native apps, because those all go through the Windows WebAuthn API.
  - It can't be done from the extension: it needs a signed, packaged native app.
- **Chrome and other browsers: no provider API for extensions.**
  - Extension password managers replace `navigator.credentials.create/get` from a script injected into the page, and keep the browser's own flow as a fallback. Bitwarden documents this as the only way, and it's fragile:
    - it races other managers doing the same (Bitwarden passkeys stop working with 1Password installed, bitwarden/clients#20973);
    - it can break the browser's own passkey autofill;
    - Bitwarden reports that Chrome 146+'s own passkey picker can skip page-script overrides. That report comes from their PR; I didn't find it in Chrome's docs, so verify it before building.
  - `chrome.webAuthenticationProxy` exists but is documented for remote-desktop software:
    - while attached it takes over every WebAuthn request in the browser ("regular processing … is suspended"), so the extension becomes responsible for security keys and phones too;
    - only one extension can attach at a time;
    - a Chrome engineer (quoted in bitwarden/clients#20849) said it isn't a good fit for password managers. Bitwarden's PR to use it is still open and behind an off-by-default flag.
    - **We don't use it** unless Chrome endorses it for this or ships a real provider API. Watch w3c/webauthn#1976.
- **Phones (with the phone app, later):** Android Credential Manager provider (Android 14+) and the iOS AutoFill credential provider with passkeys (iOS 17+). Same core, same records.
- **Web vault (phase 4):** it can list and delete passkeys but can't sign in with them; a web page can't be a passkey provider.

### Design

1. **One core, several ways in** (`lib/focuzPass/passkeys/`), written once and used by every transport:
   - Credentials: P-256 (ES256) keys made on the device with WebCrypto; a random credential ID; rpId, user handle, name, display name; created and last-used times.
   - `makeCredential` / `getAssertion` per WebAuthn Level 3:
     - authenticator data with the rpId hash, honest flags (user present; user verified only when it really was; backup eligible and backed up, because synced), sign count 0 (normal for synced passkeys), and a FocuzPass AAGUID;
     - "none" attestation;
     - `excludeCredentials`, `allowCredentials`, and discoverable credentials.
   - Later: the PRF extension (sites that use passkeys for their own encryption), the Signal API (Chrome 132+, sites telling providers a passkey is gone), and moving passkeys to and from other managers with the FIDO Credential Exchange format.
   - Storage: passkeys are `item` records (type `passkey`), so there's no database migration. The private key is encrypted like any secret and synced by phase 3.
2. **Windows provider: "FocuzPass for Windows".**
   - A small packaged app: a native COM shim for `IPluginAuthenticator` in front of the same TypeScript core, hosted in WebView2, so the crypto and sync code aren't written twice.
   - It's its own device: it joins like any other (Security Key and master password, or QR approval once phase 5 exists) and unlocks with the master password or a Windows Hello-protected key, so passkeys work even when no browser is open.
   - The origin and rpId come from Windows, not from a web page.
   - Distributed through the Microsoft Store or as a signed MSIX, which needs a code-signing certificate.
   - When it's installed and enabled, the extension stays out of passkeys entirely.
3. **Extension path, for everywhere else** (macOS, Linux, ChromeOS, and Windows until the app exists).
   - A setting, "Use FocuzPass for passkeys in this browser", on by default (changed 2026-09-30 after the user saw saves go to Windows Hello) and labelled experimental, using the page-script override.
   - "Use my browser's passkeys instead" is always one click away and is the fallback on any error.
   - The page script is untrusted:
     - it only forwards the request;
     - the service worker checks the rpId against the real sender (the frame's URL from `chrome.runtime` sender info), never a value the page claims;
     - cross-origin iframes follow the browser's rules (the `publickey-credentials-get`/`-create` permissions);
     - signing happens in the service worker, and private keys never reach the page, the website bridge or logs.

### Decisions

- **Passkeys during a lapse:** decided, see decision 8. Sign-in keeps working for the 90 days with a notification each time; saving new ones is refused.
- **Free users:** decided, see decision 9. Passkeys work, on that device only.
- **Whether to build the Windows app at all:** still open. It's a separate product to sign, ship and update. The extension path alone is cheaper but weaker.

### Tests

- A passkey only works for its rpId; a page can't use or even detect another site's passkey.
- Assertions verify against the stored public key with an independent verifier; the flags are true.
- Private keys are never in anything sent to the page or server unencrypted.
- A passkey made on device A signs in on device B after sync; deleting it propagates.
- UV "required" really prompts.
- Windows: register, enable, create at webauthn.io, sign in from Chrome and Edge, and it appears in autofill.

Sources:
- [Microsoft passkey manager sample](https://learn.microsoft.com/en-us/samples/microsoft/windows-classic-samples/passkeymanager/)
- [Windows Developer Blog](https://blogs.windows.com/windowsdeveloper/2024/10/08/passkeys-on-windows-authenticate-seamlessly-with-passkey-providers/)
- [chrome.webAuthenticationProxy](https://developer.chrome.com/docs/extensions/reference/api/webAuthenticationProxy)
- [Bitwarden: browser-extension provider](https://contributing.bitwarden.com/architecture/deep-dives/passkeys/implementations/provider/browser-extension/)
- [bitwarden/clients#20849](https://github.com/bitwarden/clients/pull/20849)
- [bitwarden/clients#20973](https://github.com/bitwarden/clients/issues/20973)
- [w3c/webauthn#1976](https://github.com/w3c/webauthn/issues/1976)
- [Chrome Signal API](https://developer.chrome.com/docs/identity/webauthn-signal-api)

---

## Limits to be honest about

- A device that's compromised while unlocked can read that vault; no design prevents that.
- Old database backups stay readable with old keys (and still need the master password).
- Metadata is visible to the server: number of records, sizes, timing, number of devices.
- Losing the master password, the Security Key and every trusted device (with no recovery key) loses the vault.
- A tombstone (a permanent delete) carries no ciphertext, so it isn't signed. A server could fake one, but it can delete rows anyway; an edit made on another device since then still wins.
- Until phase 6, a new master password set on one device doesn't change how the other devices unlock locally. They keep their own master password until they're re-added.
- The web vault's page code can see what it shows. That's the trade-off for working without the extension, and why the site offers the extension first.
