# P10 Racing - Production Roadmap & App Store Vision

## 🎯 Project Goal
To evolve P10 Racing from a locally-stored web prototype into a fully polished, multiplayer mobile application published on the Google Play Store, complete with online leagues, automated testing, and CI/CD pipelines.

---

## 🏗️ Phase 1: App Polish & Native Feel
Before launching to the public, the app must feel like a native mobile application rather than a responsive website.

*   [ ] **Native Navigation:** Implement smooth page transitions and swipe-to-go-back gestures.
*   [ ] **App Icon & Splash Screen:** Design and integrate high-resolution assets using `@capacitor/splash-screen`.
*   [ ] **Status Bar Management:** Ensure the Android status bar matches the app's dark theme using `@capacitor/status-bar`.
*   [ ] **Haptic Feedback:** Add subtle vibrations when submitting predictions or navigating using `@capacitor/haptics`.
*   [ ] **Offline Support & Error Handling:** Graceful "No Connection" states and cached data display when offline.
*   [ ] **UI Refinement:** Transition generic Bootstrap components to bespoke, F1-styled native-feeling UI components.

---

## ⚙️ Phase 2: CI/CD & Automated Pipeline (GitHub Actions)
Automate the development workflow to ensure stability before every release.

*   [ ] **Code Quality Gates:** Ensure `eslint` and `tsc` (TypeScript compiler) pass on every Pull Request.
*   [ ] **Automated Test Suite:** Run the Node.js test suite (`tests/run_all.ts`) automatically in GitHub Actions.
*   [ ] **Capacitor Sync:** Automate the Next.js build (`next build`) and Capacitor sync (`npx cap sync android`).
*   [ ] **Android APK/AAB Generation:** Configure GitHub Actions to compile the Android project using Gradle and output a signed `.aab` file ready for Play Store upload.

---

## 🌍 Phase 3: The Multiplayer Backend Migration
To allow users to play with their friends, the app must move away from `localStorage` to a centralized database.

*   [ ] **Backend Selection:** Choose a BaaS (Backend-as-a-Service) like **Supabase** (PostgreSQL) or **Firebase** for rapid authentication and real-time database capabilities.
*   [ ] **User Authentication:** 
    *   Implement secure Login/Signup.
    *   Support Google/Apple OAuth for one-click onboarding.
*   [ ] **Database Schema Design:**
    *   `Users`: id, username, avatar.
    *   `Leagues`: id, name, invite_code.
    *   `LeagueMembers`: link between Users and Leagues.
    *   `Predictions`: user_id, race_id, p10_driver_id, dnf_driver_id.
*   [ ] **Private Leagues:** Allow users to create groups, generate invite links/codes, and compete on private leaderboards.
*   [ ] **Centralized Scoring Engine:** Move `calculateTotalPoints` to a secure serverless function (e.g., Supabase Edge Functions or Next.js API Routes) to prevent client-side cheating.

---

## 🚀 Phase 4: App Store Release
The final steps to get the app into the hands of users.

*   [ ] **Google Play Developer Account:** Register and set up the organization profile.
*   [ ] **Keystore Management:** Securely store the Android Keystore in GitHub Secrets for automated production signing.
*   [ ] **Store Listing:** 
    *   Create compelling screenshots and feature graphics.
    *   Write SEO-optimized app descriptions.
*   [ ] **Compliance:** Draft a Privacy Policy and Terms of Service (required for app stores).
*   [ ] **Push Notifications (Optional but recommended):** Send reminders (e.g., "Qualifying is over! 2 hours left to lock in your P10 picks!") using FCM (Firebase Cloud Messaging).

---

## 🛠️ Current Tech Stack
*   **Frontend:** Next.js (React), Bootstrap 5, TypeScript.
*   **Mobile Wrapper:** Capacitor JS (Android).
*   **Data Source:** Jolpica F1 API / OpenF1 API.
*   **Current State:** LocalStorage single-device mode, robust F1 rules engine, full test coverage for scoring edge cases.