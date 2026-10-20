# Chronicle on your iPhone

GitHub builds the app on a Mac in the cloud on every push to `main` (`.github/workflows/ios.yml`) and attaches
`Chronicle.ipa` to a release called **iPhone build N**. SideStore installs it with your free Apple ID and
re-signs it from the phone every week, so you never need a Mac.

## One-time setup (about 15 minutes, needs a Windows or Mac computer once)

1. On the iPhone: **Settings → Privacy & Security → Developer Mode → On** (the phone restarts).
2. Follow the official SideStore install guide at https://docs.sidestore.io (it uses a computer once to put
   SideStore on the phone and create its pairing file). Sign in with your Apple ID when it asks.
3. In SideStore, set up its refresh as the guide describes, so it can re-sign apps over Wi-Fi.

## Installing Chronicle

1. On the iPhone, open the repo's **Releases** page in Safari and download `Chronicle.ipa` from the newest
   **iPhone build**.
2. Open SideStore → **My Apps → +** → choose `Chronicle.ipa`.
3. **Settings → General → VPN & Device Management** → trust your Apple ID if iOS asks.
4. Open Chronicle. It asks once for notification permission: allow it for the morning-letter and Campfire
   reminders (times are in Vault → Settings).

## Keeping it alive

- Free Apple IDs sign apps for 7 days. Open SideStore about once a week and tap **Refresh All**.
- Updating: install a newer `Chronicle.ipa` the same way. Your data stays; it lives in the app's storage.
- Still export a backup now and then: **Vault → Data → Export backup**.

## Later

With a paid Apple Developer account ($99/year) the same project goes to TestFlight and the App Store, and
signatures last a year. Open `ios/App/App.xcodeproj` in Xcode on a Mac, set your team, Archive, Upload.
