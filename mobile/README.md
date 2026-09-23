# Catalyst mobile (C67.2)

Expo app. The web app at the repo root is the frozen design reference. Do not edit it.

## Run on a phone with Expo Go

1. Install Expo Go from the App Store or Play Store.
2. From this folder:

   ```bash
   npx expo start
   ```

3. Scan the QR code with the phone camera (iOS) or Expo Go (Android). The phone and the computer have to be on the same network.

Cold start plays the launch once. It does not replay when you switch tabs.

## Replay the launch

Catalyst tab → gear (Settings) → About → **Replay launch animation**.

Reduced motion (system setting) shows the mark and wordmark, then fades. No spin, spirals, or particles.

## Web

```bash
npx expo start --web
```

Automated browsers skip the launch unless the URL has `?launch=1`. A frozen frame for checks is `?frame=300` (milliseconds).

## Versions

Expo SDK, Reanimated, and react-native-svg are whatever `npx expo install` resolved. See `package.json`.
