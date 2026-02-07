# P10 Racing - Project Status & Roadmap

## ✅ Completed Features
*   **2026 Season Integration:** Official 11-team / 22-driver lineup (including Cadillac and Audi) fetched dynamically from the API.
*   **Dynamic API Architecture:** Automated fetching of race calendars, results, and driver pairings using the Jolpica (Ergast) API.
*   **Multi-User Support:** Local session management allowing multiple users (e.g., "lando4lyf") to store isolated predictions on one device.
*   **Advanced Scoring Engine:** Calculates points based on distance from P10 and a +25pt bonus for the first DNF.
*   **Admin Tools:** Results fetching with participation filtering and a global game reset function.
*   **Visual Identity:** F1-themed dark mode with high-contrast driver numbers and team-colored constructor badges.

## 🛠️ Current Roadmap (In Progress)
1.  **Home Page Interactivity:**
    *   [ ] **Live Countdown:** Real-time timer to the start of the next Grand Prix.
    *   [ ] **User Dashboard:** Quick-view card showing the logged-in user's current prediction.
2.  **Leaderboard Enhancements:**
    *   [ ] **Point Breakdown:** Detailed view showing exactly how scores were calculated per user.
3.  **Security & Fairness:**
    *   [ ] **Prediction Locking:** Automatic disabling of the prediction form once a race session begins.
4.  **Data Depth:**
    *   [ ] **Race History:** Archive of past race outcomes and P10/DNF results.

## 📈 Technical Specs
*   **Framework:** Next.js (App Router)
*   **API:** Jolpica (Ergast compatible)
*   **State:** React Hooks + LocalStorage
*   **Styling:** Bootstrap 5 + Custom CSS