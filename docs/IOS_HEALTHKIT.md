# ForgeFit native Apple Health connection (iOS-first)

## Status

- **Web/PWA on Vercel:** Apple Health cannot connect directly. The Activity screen correctly explains that limitation; manual steps and CSV imports keep working.
- **Native iOS reference implementation:** `native/ios/ForgeFitNativeApp.swift` supplies a SwiftUI/WKWebView wrapper and a restricted JavaScript/HealthKit bridge. `HealthKitStepsReader.swift` reads read-only daily step aggregates. The TypeScript bridge is `lib/healthBridge.ts`.
- **Not yet compiled or installed:** This repository does not contain a signed Xcode project. No automatic background sync. A native iOS build on macOS is needed to activate the Connect button.

## To build the iPhone app

1. Use Xcode on a Mac (or an appropriate Mac build service) to create an iOS App project named ForgeFit, SwiftUI interface, Swift language. Choose a unique bundle identifier and configure signing.
2. Copy `native/ios/ForgeFitNativeApp.swift` and `native/ios/HealthKitStepsReader.swift` into the app target, replacing the Xcode-generated `@main` app entry so there is only one.
3. Add **HealthKit** under Signing & Capabilities. Add the `NSHealthShareUsageDescription` Info property, e.g. “ForgeFit reads your daily steps to track activity and estimate walking calories.” Request *read* permission for step count only; no write permission.
4. Set `WKAppBoundDomains` in Info as an array containing `forgefit-8tc9.vercel.app`. Keep the Swift `allowedHost` the same as the hosted ForgeFit address. Do not point the privileged bridge at an arbitrary website.
5. Build and run on a physical iPhone. HealthKit is not guaranteed available in iOS simulator. Open Activity → Phone health connections → Connect Apple Health, authorize read access, and sync up to seven days.
6. Verify duplicate sources, denial, device time zone, multiple devices, 0 steps, privacy, and recalculation of net calories. Test the app in the background and after returning; background syncing is not implemented.

## Privacy & accounting

- Apple may hide read authorization state: completing the permission prompt is **not proof** of access. Zero results may mean no data, denial, or actually zero steps. ForgeFit does not replace existing counts with zero responses.
- The app imports **daily totals only** and saves them to local browser storage in the native WKWebView. It does not upload raw samples or steps to ForgeFit servers. The app does not yet have cloud accounts or cross-device sync.
- Health steps **replace** the existing step total for the same day (source `healthkit`), avoiding double counting. Manual and CSV options remain available.
- “Stop syncing” stops requests within ForgeFit; system access must be revoked in iPhone Settings → Privacy & Security → Health.
- WKWebView loads only `https://forgefit-8tc9.vercel.app` inside the privileged container. External links open outside it. Maintain dependency audits, Content Security Policy, and code reviews; malicious JavaScript on the allowed origin could access the native bridge while it is granted HealthKit access.
- Walking calorie estimates are approximations, not measured calories. Don’t credit both estimated walking and measured exercise calories for the same activity.

## Android

Android devices use **Health Connect**, not HealthKit, and require a separate native Android integration requesting `android.permission.health.READ_STEPS`. ForgeFit's current Next.js PWA cannot read it. No Android bridge is included yet.

References: https://developer.apple.com/documentation/HealthKit/authorizing-access-to-health-data and https://developer.apple.com/documentation/webkit/wkscriptmessagehandler
