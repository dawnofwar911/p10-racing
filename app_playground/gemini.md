# P10 Racing - Design Document

## 1. Project Overview
**P10 Racing** is a web-based prediction game where players compete to guess specific outcomes of upcoming Formula 1 races. The core unique mechanic is focusing on the midfield battle (10th place) rather than the winner.

## 2. Core Gameplay
*   **The P10 Prediction:** Users select the driver they believe will finish in **10th position**.
*   **The First DNF Prediction:** Users select the driver they believe will be the **first to retire** from the race.
*   **Leagues/Players:** Supports any number of players. Global or local leaderboards.

## 3. Scoring System
*   **P10 Accuracy:** Points are awarded based on the driver's finishing position's distance from 10th place, following the standard F1 points scale (25, 18, 15, 12, 10, 8, 6, 4, 2, 1).
    *   **Points Table (Distance from P10):**
        *   0 away (P10): 25 pts
        *   1 away (P9, P11): 18 pts
        *   2 away (P8, P12): 15 pts
        *   3 away (P7, P13): 12 pts
        *   4 away (P6, P14): 10 pts
        *   5 away (P5, P15): 8 pts
        *   6 away (P4, P16): 6 pts
        *   7 away (P3, P17): 4 pts
        *   8 away (P2, P18): 2 pts
        *   9 away (P1, P19): 1 pt
        *   10+ away (P20+): 0 pts
*   **First Retirement Bonus:**
    *   **Correct Guess:** +25 Points.
    *   **Incorrect:** 0 Points.

## 4. Technical Architecture
### Stack (Prototype)
*   **Framework:** Next.js (React + Node.js API routes) - Allows for easy full-stack development in one repo.
*   **Styling:** Bootstrap 5 (via `react-bootstrap`) - Responsive, mobile-first design suitable for an "app" feel.
*   **Data Persistence:** Local JSON file or In-Memory (for initial prototype) -> SQLite/PostgreSQL (future).
*   **External Data:**
    *   *Initial:* Manual entry of race results (Admin view).
    *   *Future:* Integration with OpenF1 or Ergast API for live results.

## 5. User Interface (UI) Structure
1.  **Home / Dashboard:**
    *   Countdown to next race.
    *   Button to "Make Prediction".
    *   Top 3 Leaderboard preview.
2.  **Prediction Screen:**
    *   Dropdown/Card selection for "P10 Driver".
    *   Dropdown/Card selection for "First DNF".
    *   "Submit Prediction" button.
3.  **Leaderboard:**
    *   Full table of players and total scores.
    *   Breakdown of last race points.
4.  **Admin / Results (Hidden/Separate):**
    *   Form to input the actual finishing order and first retirement after a race.
    *   Button to "Calculate Scores".

## 6. Implementation Plan
1.  **Scaffold Project:** Initialize Next.js app.
2.  **Mock Data:** Create lists of current F1 Drivers and Teams.
3.  **Components:** Build reusable UI components (DriverCard, PredictionForm, LeaderboardTable).
4.  **State Management:** Handle user current predictions and submitted results.
5.  **Scoring Logic:** Implement the calculation algorithm.
6.  **Refinement:** Polish UI with F1-themed colors (Red, Black, White).
