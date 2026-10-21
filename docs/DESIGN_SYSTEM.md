# ForgeFit UI/UX v1.0 — Phase 1 foundation

Branch: feature/ui-system-phase1. **Review this in a Vercel preview before any production merge.**

## Locked design direction
- Midnight background #0B151B, teal #29D3B2, orange #FF742B; Inter type family.
- Mobile navigation (Phase 2): Home, Food, central orange +, Train, More. Teal active-icon tiles and an accessible quick-action bottom sheet.
- Home (Phase 2): balanced Daily Command Center with a ring-forward calorie hero, stacked macro progress bars, comfortable spacing and subtle layered cards.
- Screens (Phase 3): diary-first Food, today-first Train, independent Activity trackers, recipe-card Coach, charts-first Progress, categorized Settings.

## Phase 1 delivered
- \`app/design-tokens.css\` centralizes brand palette, typography scale, spacing, radii, interaction sizes and motion constants. Existing CSS variable names are aliased for backwards compatibility.
- \`app/components/ui.tsx\` shares existing Brand, Pill, Ring, MetricBar, Empty and SectionHeader components used across the active app. Also introduces typed ActionButton, SurfaceCard, TextField and accessible ProgressTrack primitives.
- \`app/components/BottomSheet.tsx\` is a reusable (not yet wired to navigation) overlay with focus trapping, focus return, Escape and backdrop dismissal, scroll lock, and a downward swipe gesture.
- \`app/globals.css\` retains all current page layouts and screen behaviors. Component classes and focus/motion handling are standardized without changing data calculations.
- A small selection of existing action buttons uses the new ActionButton component to exercise the shared API.

## Compatibility constraints
- Do not rename the \`forgefit:v1\` localStorage key or change stored data shapes in a visual refactor.
- Do not change food/water/step calculations, CSV import behavior, workouts, or HealthKit availability claims.
- Do not introduce UI controls that suggest unimplemented features are operational.
- Avoid production deployments until preview review and explicit approval.

## Pre-merge checks
1. Verify Vercel preview reports READY and Next.js TypeScript checks pass.
2. In the **same browser profile and same origin**, check existing diary, favorite foods, recipe builder, water/steps, workouts, and settings still display.
3. Keyboard test: tab through buttons and form fields, inspect focus ring. Once wired in Phase 2, test BottomSheet Escape/focus trap/backdrop/swipe.
4. Check widths 375px, 430px, 768px, and desktop; reduced-motion preference and no horizontal overflow.
5. Confirm current production deployment SHA is unchanged.

Next phase: implement the approved five-tab mobile navigation and redesigned Home, using these primitives.
