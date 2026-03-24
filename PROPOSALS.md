# P10 Racing - Feature Proposals & Implementation Plans

This document outlines the strategic roadmap for upcoming features designed to increase user engagement, gamification, and platform reach.

---

## 1. 📊 Driver Insights ("The Analyst")
**Goal:** Provide historical context to help users make data-driven predictions.

### Implementation Plan:
*   **Data Strategy:** Use the existing Jolpica F1 API to fetch the last 3 race results for each driver.
*   **UI/UX:** 
    *   Add a "Form" sparkline or mini-table inside the driver selection list in `app/predict/page.tsx`.
    *   Show finishing positions (e.g., `P8`, `P12`, `DNF`) for the most recent rounds.
*   **Caching:** Store these results in `localStorage` (`p10_cache_driver_form`) to avoid redundant API calls during the selection process.

---

## 2. 🏆 Achievement & Badge System
**Goal:** Increase long-term retention through gamification.

### Implementation Plan:
*   **Backend:** 
    *   Create a `user_achievements` table in Supabase.
    *   Add a Supabase Edge Function trigger that evaluates achievements whenever `verified_results` are updated.
*   **Achievements:**
    *   **Perfect Weekend:** Guess both P10 and DNF correctly.
    *   **Midfield Master:** Guess P10 exactly in 3 consecutive races.
    *   **Survivor:** Guess a DNF correctly for a race with >5 retirements.
*   **UI:** Add a "Trophies" section to the `UserDrawer` or a new tab in `Settings`.

---

## 3. 🏁 Enhanced "Live" Race Center
**Goal:** Make the app the primary "second screen" during a Grand Prix.

### Implementation Plan:
*   **Trigger:** Activate when `isRaceInProgress` is true in `app/page.tsx`.
*   **Features:**
    *   **P10 Tracker:** A dedicated leaderboard focusing on the gap between P9, P10, and P11.
    *   **Live Prediction Status:** Real-time indicator showing if the user's current picks are "On Track" or "At Risk."
*   **Tech:** Use frequent polling (every 60s) of the Jolpica results API during the race window.

---

## 4. 🍎 Phase 5: iOS Integration
**Goal:** Expand the P10 Racing community to Apple users.

### Implementation Plan:
*   **Environment:** 
    *   Install `@capacitor/ios` and run `npx cap add ios`.
    *   Initialize the Xcode project and configure Bundle IDs.
*   **Native Polish:**
    *   Implement `androidx.activity.EdgeToEdge` equivalents for iOS (Safe Area Insets).
    *   Optimize `globals.css` for the **Dynamic Island** and Notch.
*   **Deployment:** Set up a GitHub Action to build `.ipa` files and upload to **TestFlight**.

---

## 🎨 Personalized User Profiles
**Goal:** Deepen the connection between the user and the F1 sport.

### Implementation Plan:
*   **Backend:** Add `favorite_team` (ID) and `favorite_driver` (ID) columns to the `profiles` table.
*   **UI:** 
    *   Create a "Profile Customization" section in `app/settings/page.tsx`.
    *   Use the `favorite_team` color to dynamically theme the user's UI (accent colors, buttons).
*   **Social:** Display the user's favorite driver/team icon next to their name on the global and league leaderboards.
