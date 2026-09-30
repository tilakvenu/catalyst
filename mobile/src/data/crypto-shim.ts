// Parse 8's React Native build calls Node's `require('crypto').randomUUID` (src/uuid.ts, since 7.1.1),
// which React Native does not have. Open upstream: parse-community/Parse-SDK-JS#2856 and #3095
// ("[Parse 8.6.0][Expo SDK 57]"). metro.config.js resolves `crypto` to this file for requests coming
// from inside the parse package only. expo-crypto's randomUUID is synchronous, RFC 4122 v4, and supports
// Android, iOS and web (docs.expo.dev/versions/v57.0.0/sdk/crypto).
import { randomUUID as expoRandomUUID } from "expo-crypto";

export function randomUUID(): string {
  return expoRandomUUID();
}
