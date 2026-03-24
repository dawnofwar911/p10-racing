import { test, expect } from '@playwright/test';

test.describe('Predict Flow (Guest User)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock F1 API to ensure stable test data regardless of real season/API status
    await page.route('**/api.jolpi.ca/ergast/f1/**', async (route) => {
      const url = route.request().url();
      
      // Mock Drivers (Standings)
      if (url.includes('driverStandings.json')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            MRData: {
              StandingsTable: {
                StandingsLists: [{
                  DriverStandings: [
                    { points: "100", Driver: { driverId: "max_verstappen", permanentNumber: "33", code: "VER", givenName: "Max", familyName: "Verstappen" }, Constructors: [{ constructorId: "red_bull", name: "Red Bull Racing" }] },
                    { points: "80", Driver: { driverId: "hamilton", permanentNumber: "44", code: "HAM", givenName: "Lewis", familyName: "Hamilton" }, Constructors: [{ constructorId: "ferrari", name: "Ferrari" }] }
                  ]
                }]
              }
            }
          })
        });
      } 
      // Mock Calendar (Next Race)
      else if (url.endsWith('2026.json')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            MRData: {
              RaceTable: {
                Races: [
                  { season: "2026", round: "1", raceName: "Australian Grand Prix", Circuit: { circuitName: "Albert Park" }, date: "2026-12-31", time: "10:00:00Z" }
                ]
              }
            }
          })
        });
      }
      // Mock Results/Qualifying (Grid) - return empty to avoid complex grid logic
      else if (url.includes('results.json') || url.includes('qualifying.json')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ MRData: { RaceTable: { Races: [] } } })
        });
      }
      else {
        await route.continue();
      }
    });

    // Start at home
    await page.goto('/');
  });

  test('should complete a prediction flow as a guest', async ({ page }) => {
    // 1. Navigate to Predict
    const predictLink = page.locator('.mobile-bottom-nav').getByRole('link', { name: /Predict/i });
    await expect(predictLink).toBeVisible();
    await predictLink.click();
    
    // Wait for URL change
    await expect(page).toHaveURL(/\/predict/);

    // 2. Wait for the page content to load (either login or predictor)
    const predictionsHeading = page.getByRole('heading', { name: /Predictions/i });
    await expect(predictionsHeading).toBeVisible({ timeout: 15000 });

    // 3. Join as Guest if the login form is shown
    const guestInput = page.getByPlaceholder(/Enter name/i);
    if (await guestInput.isVisible()) {
      await guestInput.fill('E2EGuest');
      await page.getByRole('button', { name: /PLAY AS GUEST/i }).click();
    }

    // 4. Wait for the driver selection tabs to appear
    const p10Tab = page.getByRole('button', { name: /Pick P10/i });
    await expect(p10Tab).toBeVisible({ timeout: 15000 });
    
    // Ensure we are on the P10 tab
    await p10Tab.click();

    // 5. Select a P10 Driver
    const p10Header = page.getByRole('heading', { name: /P10 Finisher/i });
    await expect(p10Header).toBeVisible();
    
    const verstappen = page.getByText('Max Verstappen').first();
    await expect(verstappen).toBeVisible();
    await verstappen.click();

    // 6. Should automatically switch to DNF tab
    const dnfHeader = page.getByRole('heading', { name: /First DNF/i });
    await expect(dnfHeader).toBeVisible({ timeout: 5000 });

    // 7. Select a DNF Driver
    const hamilton = page.getByText('Lewis Hamilton').first();
    await expect(hamilton).toBeVisible();
    await hamilton.click();

    // 8. Verify the summary card appears
    // The text can be "Locked and Loaded!" (if sync works) or "Current Picks"
    const summaryHeading = page.getByText(/Locked and Loaded!/i).or(page.getByText(/Current Picks/i));
    await expect(summaryHeading).toBeVisible({ timeout: 10000 });
    
    // 9. Verify the picks are displayed (using partial match for last names)
    await expect(page.getByText(/Verstappen/i)).toBeVisible();
    await expect(page.getByText(/Hamilton/i)).toBeVisible();
  });
});
