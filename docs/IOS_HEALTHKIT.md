# Apple Health integration — native implementation plan

**Status: NOT CONNECTED.** A browser-installed Next.js PWA cannot directly read Apple Health data. This folder contains reference native Swift logic only.

## What is usable now

- Manual step entry, goals and estimated walking calorie credits.
- Local import of a CSV with `date,steps` (for example `2026-10-20,8250`). This CSV must be obtained outside ForgeFit; Apple Health's built-in export is not directly in this CSV format. Import replaces matching days only after confirmation.
- The Home calorie balance uses the imported or manually entered step count, not both (prevents adding the same steps twice).

## Future native iOS release

1. Create a native iOS target using Xcode on macOS (or a trusted Mac-based build service). Choose a maintained wrapper approach if combining the web UI with native code.
2. Add HealthKit entitlement, `NSHealthShareUsageDescription`, and privacy policy. Do not request writing rights unless explicitly adding a write feature.
3. Use `native/ios/HealthKitStepsReader.swift` as reference to request permission and read a daily aggregate. HealthKit may expose only limited/no data depending on consent.
4. Expose a small, authenticated native-to-web bridge `getDailySteps(date)` and `requestHealthAccess()` with date and count only. Never expose raw HealthKit samples to browser JavaScript unless the UI needs them.
5. **Replace**, never add, the daily stored step total during sync. Keep a `healthkit` source label and support revoking access, and reconcile manual entries with deliberate conflict resolution.
6. Test iPhone permissions, multiple step devices, timezone/day changes, revocations, offline behavior, duplicate prevention, and calorie credits without double-counting.
7. Only then label the feature **Automatic Apple Health Sync**.

Do not upload Apple Health information to a server unless users explicitly consent and a secure, private, documented data-handling design exists.
