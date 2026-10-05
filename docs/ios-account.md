# The You tab (iOS, 2026-10-04)

The fifth tab on iPhone (it replaced Coach, which now opens from the sparkles on Today and from You;
on iPad Coach keeps its own tab). On iPhone the TabView has exactly these five tabs: tabs marked
hidden still counted towards the five and put You inside a "More" tab, so the phone's TabView doesn't
have the others (`MainTabs.phoneTabs`; iPad uses `sidebarTabs`). A night scene like Today: black, the
orb's mint light behind your photo, dark glass cards. Every confirmation is an `FZPopup` (a glass sheet
at the bottom with its colour glowing through it, an outlined icon, a button); destructive ones are
press-and-hold. The copy is written to sound like a person, with a bit of humour; keep it that way.

Code: `ios/App/Screens/AccountView.swift` (the tab), `AccountParts.swift` (rows, the ticket, the nudge
preview, the profile editor), `ios/App/Model/PinLock.swift`, `ios/Shared/Blocking/Protections.swift`
(autofocus, the emergency pass, uninstall protection, the filter; also compiled into the Screen Time
monitor, which runs them with the app closed). The previous Settings screen and "You" sheet are backed
up in `backups/ios-account-2026-10-04/`.

## From top to bottom
- **You:** your photo (tap it to pick one; saved square, 600 pt, in the app's Documents), name,
  "@username · what you do · age", and **Edit** (all of it plus the screen time you started with).
  Saved on the iPhone as one small JSON (`UserProfile`, defaults key `profile`) until accounts sync.
- **Where you started:** the onboarding's "How long are you on your phone a day?" next to today so far,
  with a line about it. (Today's screen time is still sample data.)
- **Shortcuts:** Coach, Stats, Friends, Forest, Shop, Customize (what used to be behind the avatar).
- **Autofocus:** when the block list has been used for 30 min / 1 h / 2 h / 3 h in a day, a nudge
  ("You've used distracting apps for an hour already!!!") and, if you pick **Lock them**, 15 minutes
  locked. A live preview of the notification (tap for another line) and **Send me one** (a real one in
  4 s). The lines are in `Autofocus.lines`. Needs Screen Time, notifications and a block list.
- **Advanced:**
  - **Uninstall protection:** whenever anything is locked (a session, the daily block, autofocus),
    apps can't be deleted (`denyAppRemoval`): holding an icon only offers Remove from Home Screen, and
    Settings → General → iPhone Storage can't delete either. It can't be switched off while a block is
    on ("That's kind of the point"), and needs the PIN otherwise.
  - **Adult site filter:** Apple's own filter (`webContent.blockedByFilter = .auto()`), in Safari and
    apps, all the time. Off needs the PIN and a confirmation.
  - **PIN code:** 4 digits, a salted SHA-256 in the Keychain. Asked for before ending a session early,
    switching autofocus, uninstall protection or the filter off, changing or removing the PIN, signing
    out and deleting the account. Five misses rests the pad for 30 s. **Forgot?** switches the PIN off
    24 hours later (on purpose: long enough for the urge to pass).
- **Support:** Get help (mail to support@focuznow.com), **Reload FocuzNow** (re-applies the session
  lock, the daily block, autofocus, the filter and uninstall protection, for when something looks
  stuck), **Developer mode** (switching it on opens Developer tools, Replay the intro and a test nudge
  right there), and the **emergency pass**: a ticket with three punch holes. Three a week; each unlocks
  everything for 5 minutes, then the monitor locks again only what was locked (a session on a break
  stays unlocked), and the app does the same as a backup if it's open. A pass comes back 7 days after
  it's used. It costs 2 points of focus score. No PIN: it's for emergencies.
- **Other:** FocuzNow Pro (the Pro screen), Restore purchases (`AppStore.sync()`, then the current
  entitlements), About, Preferences (notifications, haptics, light or dark), Send a guest pass.
- **Account:** link Apple (Apple's own button, in a popup), link Google (a popup saying it comes with
  accounts syncing: it needs Google's sign-in SDK and Supabase auth), Sign out, Delete account.

## What sign out and delete do (until Supabase auth reaches the app)
- **Sign out:** not during a session; PIN first. Stops every block, schedule, autofocus and the filter
  on this iPhone, unlinks Apple/Google, and goes back to the onboarding. The profile, photo and PIN stay.
- **Delete account:** not during a session; PIN first. Stops everything, then wipes the profile, photo,
  PIN, passes, block list, protections, and all of the app's and the App Group's saved settings, and
  goes back to the onboarding. There's no cloud account yet; when there is, this must delete it too.

## The Screen Time pieces (`Protections.swift`)
| name | what |
|---|---|
| store `focus` / `daily` / `autofocus` | the three locks; `Protections.lock` shields and sets `denyAppRemoval` |
| store `filter` | the adult site filter |
| activity `autofocus` | all day, repeating, with the `distracted` threshold event |
| activity `autofocusEnd` | the 15-minute autofocus lock ending |
| activity `emergencyEnd` | an emergency pass ending (started 16 min in the past: Screen Time needs 15) |

The monitor (`Extensions/FocusMonitor`) handles `eventDidReachThreshold` (autofocus steps in) and the
ends above. Apple limits a person to 20 monitored activities; FocuzNow uses at most 5.

## Not airtight (Apple's limits)
- Anyone can switch FocuzNow off in Settings → Screen Time → Apps with Screen Time access, which removes
  every lock. No app can stop that.
- Autofocus only notices time in the apps on the block list.
- The shield can't be styled beyond colours, an icon and text (no fonts, no layout).

## Test on the iPhone
1. Pull, `cd ios && xcodegen`, build. The tab bar: Today, Focus, Plan, Pass, **You**.
2. **You:** tap your photo, pick one; it shows in You and on Today's header. **Edit**: change the name,
   username (letters, numbers, `.` and `_` only), pick "Student", age 16. The line under your name
   reads "@you · Student · 16".
3. **Autofocus:** pick a few apps in Focus first. Switch Autofocus on (allow Screen Time and
   notifications). Pick **30m** and **Lock them**. Tap the preview a few times (new lines). **Send me
   one**, lock the phone: the nudge arrives in 4 s. For the real thing, use a blocked app for 30 min:
   the nudge, and the apps lock for 15 minutes.
4. **PIN:** Advanced → PIN code → type 4 digits twice. Start a session, **End early**: the PIN pad
   comes first. Get it wrong: the dots shake, the phone buzzes.
5. **Uninstall protection:** switch it on, start a session, hold any app icon: only Remove from Home
   Screen. Try switching it off during the session: "Not while you're blocked".
6. **Emergency pass:** during a session, Support → **Use one** → **Unlock for 5 minutes**. Blocked apps
   open; after 5 minutes they lock again (with the app closed too). The ticket shows one hole punched.
7. **Adult site filter:** on, then open an adult site in Safari: Apple's block page.
8. **Reload FocuzNow:** a spinner, then "All fresh".
9. **Developer mode:** switch it on: three rows open under it.
10. **Sign out:** the PIN, then a popup; the onboarding starts again. (Delete account does the same and
    wipes everything; it's **Hold to delete**: the button fills red as you hold. Try it last.)
11. Tell us if any popup looks off, or a switch flips back by itself when it shouldn't (it should only
    flip back when it's waiting for the PIN or a permission).
