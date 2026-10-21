# ForgeFit v0.4 — Feature Expansion (local prototype)

An offline-first, mobile-friendly **Next.js** food/fitness tracking prototype with local browser storage. No GitHub, Vercel, Supabase, Apple developer account, or API subscription required for the local version.

## Windows quick start

1. Back up the **entire** previous ForgeFit directory. For an upgrade, extract **this** ZIP to a new folder and keep its URL at `http://localhost:3000` in the same browser profile so your saved local data can be read.
2. Install Node.js 20.9+ if needed.
3. Double-click `START_FORGEFIT.bat`, or run `npm install` then `npm run dev`.
4. Open `http://localhost:3000`.
5. Test first on sample data; verify anything important before using it as your sole record.

**Storage:** v0.4 keeps using `forgefit:v1` in `localStorage` and adds optional fields to support older saved entries. It does not migrate user data to the cloud. Browser storage may be cleared by the browser or user. Back up before replacing project files. Changing origin/port/profile hides the old records. Data from different devices cannot currently sync.

## What's new in v0.4

| Feature | What works |
|---|---|
| Favorites / recent / yesterday | One-tap reuse of previously logged portions; favorites remain available after the diary entry is deleted; copying a selected meal from the prior day |
| Recipe builder | Choose exact food portions from USDA/Open Food Facts/starter search, add them to a draft, specify recipe yield, save and log a single serving; nutrients are summed from ingredient portions |
| Coach | Pantry-only fixed recipe options and added foods-to-exclude input; fallback to general recipes when no pantry is given. An optional paid generative backend is still disabled without a server key. This is not an allergy verifier or unlimited AI chef. |
| Micronutrients | Fiber, total sugars, sodium, calcium, iron, potassium, vitamins C and D when provided by the source; indicates how many logged items have a value; custom food optionally accepts fiber/sugar/sodium. Unknown values remain unknown. |
| Analytics | 7-, 30-, and 90-day logged-day averages, step averages, weight changes when there are two weigh-ins, charted calorie trends |
| Steps import | `date,steps` CSV import with confirmation, manual entry and calorie credits. **Not automatic Apple Health sync.** |

## How to create a recipe

1. Open **Food** and select **Create recipe** below the diary.
2. Enter a name and the number of finished servings.
3. While the recipe builder is open, search for an ingredient in the food search at the top. Tap **+**, choose grams/ounces/label portion, and select **Add measured ingredient to recipe**.
4. Repeat, then scroll to the recipe builder and click **Save measured recipe**.
5. Select **Log serving** to add one of its servings to the currently selected meal and diary date.

## Daily health data and native iPhone app

A PWA can be installed from Safari, but **cannot access native HealthKit**. The `native/ios` directory contains an illustrative Swift reader, not an integrated, installable iOS app. See `docs/IOS_HEALTHKIT.md`. The CSV importer works entirely in the browser and does not read Apple Health's native export format.

## Database safety and nutrition

- Data from public food databases can be incomplete or inaccurate; verify product labels and serving conversions.
- Micronutrient quantities aren't assumed to be zero when absent; summary values are partial unless coverage includes every logged entry.
- Home's walking-credit estimate is not clinical-grade. Disable calorie credits if your selected calorie goal already counts walking.
- There are no user accounts, cloud sync, encrypted backups, or cross-device transfer yet.
- Open Food Facts terms/rate limits apply, and USDA's DEMO_KEY has low rate limits. Provide `USDA_API_KEY` in `.env.local` for higher availability. Camera scanning needs HTTPS on a phone or localhost on a desktop.
- Never expose an `OPENAI_API_KEY` to client code or public deployment without accounts, cost limits and rate limiting.

## Verification

Run `npm install`, `npm run typecheck`, `npm run build` locally. Syntax and core nutrition/recipe data checks have been run in this packaging environment. A complete Next.js build was **not** verified because dependency installation was unavailable here.
