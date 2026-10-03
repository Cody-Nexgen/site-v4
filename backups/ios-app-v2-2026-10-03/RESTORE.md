# iOS UI v2 "Into focus" backup (2026-10-03)

Taken before the v3 "Lighthouse" rebuild (FocuzNow website brand: black, bone, Satoshi, white buttons, rendered lighthouse).
Git commit with this exact state: `2111abb`.

## Restore
From the repo root:
```sh
rm -rf ios/App
cp -r backups/ios-app-v2-2026-10-03/App ios/App
cd ios && xcodegen
```
Or with git: `git checkout 2111abb -- ios/App` (then delete any new v3 files git doesn't remove, and run `xcodegen`).
