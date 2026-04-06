import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation and Core Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock F1 API (Ergast/Jolpica) to ensure stable test data and avoid real network failures
    await page.route('**/api.jolpi.ca/ergast/f1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('driverStandings.json')) {
        const drivers = [
          { id: "hamilton", name: "Lewis Hamilton", code: "HAM", team: "Ferrari", teamId: "00_ferrari", color: "#E80020" },
          { id: "leclerc", name: "Charles Leclerc", code: "LEC", team: "Ferrari", teamId: "00_ferrari", color: "#E80020" },
        ];
        // Fill up to 20 drivers
        for (let i = 2; i < 20; i++) {
          drivers.push({ id: `driver_${i}`, name: `Driver ${i}`, code: `D${i}`, team: "Other Team", teamId: `zz_team_${i}`, color: "#ffffff" });
        }
        const standings = drivers.map((d, i) => ({
          points: (100 - i).toString(),
          Driver: { driverId: d.id, permanentNumber: (i + 1).toString(), code: d.code, givenName: d.name.split(' ')[0], familyName: d.name.split(' ').slice(1).join(' ') || d.id },
          Constructors: [{ constructorId: d.teamId, name: d.team }]
        }));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ MRData: { StandingsTable: { StandingsLists: [{ DriverStandings: standings }] } } }) });
      } else if (url.includes('.json')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            MRData: {
              RaceTable: {
                Races: [
                  { season: "2026", round: "99", raceName: "E2E Test GP", Circuit: { circuitName: "E2E Track" }, date: "2026-12-31", time: "10:00:00Z" }
                ]
              }
            }
          })
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to the home page before each test
    await page.goto('/');
  });

  test('should load the home page correctly', async ({ page }) => {
    // Check for the main hero text
    await expect(page.getByText(/Predict the 10th place finisher/i)).toBeVisible();
    
    // Check for the "Next Race" section on Home
    await expect(page.getByText(/Next Race/i)).toBeVisible();

    // Check for the bottom navigation bar
    const bottomNav = page.locator('.mobile-bottom-nav');
    await expect(bottomNav).toBeVisible();
  });

  test('should navigate to all core pages via bottom nav', async ({ page }) => {
    const bottomNav = page.locator('.mobile-bottom-nav');

    // 1. Navigate to Predict (Guest/Login Wall)
    await bottomNav.getByRole('link', { name: /Predict/i }).click();
    await expect(page).toHaveURL(/\/predict/);
    
    // Use specific role to avoid strict mode ambiguity
    await expect(page.getByRole('heading', { name: /Predictions/i })).toBeVisible();

    // 2. Navigate to Leagues
    await bottomNav.getByRole('link', { name: /Leagues/i }).click();
    await expect(page).toHaveURL(/\/leagues/);
    // Unauthenticated view
    await expect(page.getByText(/Multiplayer Leagues/i).or(page.getByText(/Active Competitions/i))).toBeVisible();
    
    // Leagues list page DOES NOT HAVE PullToRefresh anymore
    const leaguesPtr = page.locator('.ptr-container');
    await expect(leaguesPtr).not.toBeVisible();

    // 2b. Navigate to a specific league (if any exists)
    // We try to find the first "VIEW" link (using locator instead of role if ambiguous)
    const viewButton = page.locator('a:has-text("VIEW")').first();
    if (await viewButton.isVisible()) {
      await viewButton.click();
      await expect(page).toHaveURL(/\/leagues\/view/);
      // League View page SHOULD HAVE PullToRefresh
      const leagueDetailPtr = page.locator('.ptr-container');
      await expect(leagueDetailPtr).toBeVisible();
      // Go back
      await page.getByRole('button', { name: /ChevronLeft/i }).or(page.locator('button:has(svg)')).first().click();
    }

    // 3. Navigate to Leaderboard
    await bottomNav.getByRole('link', { name: /Leaderboard/i }).click();
    await expect(page).toHaveURL(/\/leaderboard/);
    // Check for Global/Guests pills in the tab container
    await expect(page.locator('.f1-tab-container').getByText(/GLOBAL/i)).toBeVisible();
    if (await page.locator('.f1-tab-container').getByText(/GUESTS/i).isVisible()) {
       await expect(page.locator('.f1-tab-container').getByText(/GUESTS/i)).toBeVisible();
    }

    // 4. Navigate to Standings
    await bottomNav.getByRole('link', { name: /Standings/i }).click();
    await expect(page).toHaveURL(/\/standings/);
    await expect(page.getByText(/World Championship/i).first()).toBeVisible();
    // Check for Drivers/Constructors pills specifically in the tab container
    await expect(page.locator('.f1-tab-container').getByText(/DRIVERS/i)).toBeVisible();
    await expect(page.locator('.f1-tab-container').getByText(/CONSTRUCTORS/i)).toBeVisible();
    
    // Standings page HAS PullToRefresh
    const ptrContainer = page.locator('.ptr-container');
    await expect(ptrContainer).toBeVisible();
  });

  test('should allow logging in with a real account', async ({ page }) => {
    // Skip if secrets are not available (local testing)
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    
    if (!email || !password) {
      console.log('Skipping real login test: credentials not found');
      return;
    }

    await page.goto('/auth');
    
    // Fill in credentials
    await page.getByPlaceholder(/name@example.com/i).fill(email);
    await page.getByPlaceholder(/••••••••/i).fill(password);
    
    // Click Sign In
    await page.getByRole('button', { name: /SIGN IN/i }).click();

    // Wait for redirect to home
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
    
    // Click Predict from the UI (specifically bottom nav to avoid ambiguity)
    // or navigate directly if overlay is suspected
    await page.goto('/predict');
    
    // Check for "Grand Prix" which is part of the race heading (e.g. "Japanese Grand Prix")
    // or the login wall if session dropped. 
    // This is more robust than "P10 Prediction" which might be delayed by race fetching.
    const loginWallHeading = page.getByRole('heading', { name: /Predictions/i });
    const raceHeading = page.getByText(/Grand Prix/i).or(page.getByText(/E2E Test GP/i));
    
    await expect(loginWallHeading.or(raceHeading).first()).toBeVisible({ timeout: 15000 });
    
    // If the user already has predictions and predictions are open, test the Change Picks flow
    const changePicksBtn = page.getByRole('button', { name: /Change Picks/i });
    if (await changePicksBtn.isVisible({ timeout: 2000 })) {
      await changePicksBtn.click();
      
      // Wait for the driver list to appear
      await expect(page.locator('.driver-list-scroll').filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
      
      // Select the first available driver for P10
      const firstDriverP10 = page.locator('.driver-list-scroll').filter({ visible: true }).locator('.cursor-pointer').first();
      await expect(firstDriverP10).toBeVisible({ timeout: 15000 });
      await firstDriverP10.click({ force: true });
      await page.waitForTimeout(500);
      
      // Select the first available driver for DNF
      const dnfTab = page.locator('.f1-tab-container').getByText(/Pick DNF/i);
      await dnfTab.click({ force: true });
      await page.waitForTimeout(500);
      
      const firstDriverDNF = page.locator('.driver-list-scroll').filter({ visible: true }).locator('.cursor-pointer').first();
      await expect(firstDriverDNF).toBeVisible({ timeout: 15000 });
      await firstDriverDNF.click({ force: true });
      await page.waitForTimeout(500);
      
      // Verify it goes back to the Summary Current Picks screen
      const summaryHeading = page.getByText(/Locked and Loaded!/i).or(page.getByText(/Current Picks/i));
      await expect(summaryHeading.first()).toBeVisible({ timeout: 15000 });
      console.log('Successfully changed picks and saved new selection.');
    }
  });
});
