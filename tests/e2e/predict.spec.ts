import { test, expect } from '@playwright/test';

test.describe('Predict Flow (Guest User)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock F1 API to ensure stable test data
    await page.route('**/api.jolpi.ca/ergast/f1/**', async (route) => {
      const url = route.request().url();
      
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

    await page.goto('/');
  });

  test('should complete a prediction flow as a guest', async ({ page }) => {
    // 1. Navigate to Predict
    const predictLink = page.locator('.mobile-bottom-nav').getByRole('link', { name: /Predict/i });
    await predictLink.click();
    await expect(page).toHaveURL(/\/predict/);

    // 2. Handle Login Wall
    const guestInput = page.getByPlaceholder(/Enter name/i);
    if (await guestInput.isVisible()) {
      await guestInput.fill('E2EGuest');
      await page.getByRole('button', { name: /PLAY AS GUEST/i }).click();
      await expect(guestInput).not.toBeVisible();
    }

    // 3. Wait for the Predictor UI to initialize
    // We look for the driver list heading which confirms we are in the selection flow
    const p10Heading = page.getByRole('heading', { name: /P10 Finisher/i });
    await expect(p10Heading).toBeVisible({ timeout: 15000 });

    // 4. Select P10 Driver
    const verstappen = page.getByText('Max Verstappen').first();
    await expect(verstappen).toBeVisible();
    await verstappen.click();

    // 5. Wait for automatic tab switch to DNF
    const dnfHeading = page.getByRole('heading', { name: /First DNF/i });
    await expect(dnfHeading).toBeVisible({ timeout: 10000 });

    // 6. Select DNF Driver
    const hamilton = page.getByText('Lewis Hamilton').first();
    await expect(hamilton).toBeVisible();
    await hamilton.click();

    // 7. Verify Summary View
    // It should show either "Locked and Loaded!" (success) or "Current Picks"
    const summaryHeading = page.getByText(/Locked and Loaded!/i).or(page.getByText(/Current Picks/i));
    await expect(summaryHeading).toBeVisible({ timeout: 15000 });
    
    // 8. Verify the selections are present in the summary
    // We use partial matches for names to be robust against formatting
    await expect(page.getByText(/Verstappen/i)).toBeVisible();
    await expect(page.getByText(/Hamilton/i)).toBeVisible();
    
    // 9. Verify the header shows the guest status correctly
    await expect(page.getByText(/Guest: E2EGuest/i)).toBeVisible();
  });
});
