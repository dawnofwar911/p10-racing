# P10 Racing - Production Roadmap & App Store Vision

## 🎯 Project Goal
To evolve P10 Racing from a locally-stored web prototype into a fully polished, multiplayer mobile application published on the Google Play Store, complete with online leagues, automated testing, and CI/CD pipelines.

---

## 🏗️ Phase 1: App Polish & Native Feel ✅ COMPLETE
*   [x] **Native Navigation:** Implemented smooth sliding fade transitions using `framer-motion`.
*   [x] **Infrastructure:** Integrated `@capacitor/splash-screen`, `@capacitor/haptics`, and `@capacitor/status-bar`.
*   [x] **Status Bar Management:** Configured native wrapper and CSS safe-area-insets to prevent UI overlap.
*   [x] **Haptic Feedback:** Added tactile response for driver selection, navigation, and submission.
*   [x] **Offline Support:** Created `OfflineStatus` component for real-time connection monitoring.
*   [x] **UI Refinement:** Developed bespoke F1-styled components with a global forced dark theme and high-contrast accessibility.

---

## ⚙️ Phase 2: CI/CD & Automated Pipeline ✅ COMPLETE
*   [x] **Code Quality Gates:** GitHub Actions now runs `eslint` and `tsc` on every push.
*   [x] **Automated Test Suite:** Full Node.js test suite (`tests/run_all.ts`) runs automatically in CI.
*   [x] **Capacitor Sync:** Pipeline automates `next build` and `npx cap sync android`.
*   [x] **Android Build:** GitHub Actions compiles the Android project and outputs a debug APK as a build artifact.

---

## 🌍 Phase 3: The Multiplayer Backend Migration ✅ COMPLETE
*   [x] **Backend Selection:** **Supabase** (PostgreSQL) integrated for relational data and authentication.
*   [x] **User Authentication:** Implemented secure Email/Password login and signup with automated profile repair.
*   [x] **Database Schema:** Tables for `profiles`, `leagues`, `league_members`, `predictions`, and `verified_results` live in production.
*   [x] **Private Leagues:** Users can create/join leagues with 8-digit invite codes and view private leaderboards.
*   [x] **Centralized Scoring:** Scoring engine now supports verified global results synced from Supabase.
*   [x] **Data Migration:** Built an import tool to move "Guest" data from LocalStorage to the cloud.

---

## 🚀 Phase 4: App Store Release 🏗️ IN PROGRESS
*   [ ] **Google Play Developer Account:** Register and set up the organization profile.
*   [ ] **Keystore Management:** Generate production signing key and store in GitHub Secrets.
*   [ ] **Store Listing:** Create screenshots, feature graphics, and SEO descriptions.
*   [ ] **AAB Generation:** Update CI/CD to output a signed Android App Bundle (.aab).
*   [ ] **Push Notifications:** (Optional) Implement FCM for race reminders.

---

## 🛠️ Current Tech Stack
*   **Frontend:** Next.js 15 (React 19), Bootstrap 5, TypeScript, Framer Motion.
*   **Backend:** Supabase (Auth, PostgreSQL, RLS).
*   **Mobile:** Capacitor JS 8.
*   **CI/CD:** GitHub Actions.
*   **Data Source:** Jolpica F1 API.
