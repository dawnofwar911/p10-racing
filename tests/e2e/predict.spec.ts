import { test, expect } from '@playwright/test';

test.describe('Predict Flow (Guest User)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock F1 API to ensure stable test data
    await page.route('**/api.jolpi.ca/ergast/f1/**', async (route) => {
      const url = route.request().url();
      
      // Mock Drivers (Standings) - Providing 22 drivers to satisfy app checks
      if (url.includes('driverStandings.json')) {
        const drivers = Array.from({ length: 22 }, (_, i) => ({
          points: (100 - i).toString(),
          Driver: { 
            driverId: i === 0 ? "max_verstappen" : (i === 1 ? "hamilton" : `driver_${i}`), 
            permanentNumber: (i + 1).toString(), 
            code: i === 0 ? "VER" : (i === 1 ? "HAM" : `D${i}`), 
            givenName: i === 0 ? "Max" : (i === 1 ? "Lewis" : "Driver"), 
            familyName: i === 0 ? "Verstappen" : (i === 1 ? "Hamilton" : `${i}`) 
          },
          Constructors: [{ constructorId: i % 2 === 0 ? "red_bull" : "ferrari", name: i % 2 === 0 ? "Red Bull" : "Ferrari" }]
        }));

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ MRData: { StandingsTable: { StandingsLists: [{ DriverStandings: drivers }] } } })
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
                  { season: "2026", round: "1", raceName: "E2E Test Grand Prix", Circuit: { circuitName: "E2E Track" }, date: "2026-12-31", time: "10:00:00Z" }
                ]
              }
            }
          })
        });
      }
      // Mock Results/Qualifying (Grid)
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

    // Start at home and clear storage to ensure fresh state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should complete a prediction flow as a guest', async ({ page }) => {
    // 1. Navigate to Predict
    const predictLink = page.locator('.mobile-bottom-nav').getByRole('link', { name: /Predict/i });
    await predictLink.click();
    await expect(page).toHaveURL(/\/predict/);

    // 2. Handle Login Wall
    const guestInput = page.getByPlaceholder(/Enter name/i);
    await expect(guestInput.or(page.getByRole('heading', { name: /P10 Finisher/i }))).toBeVisible({ timeout: 15000 });
    
    if (await guestInput.isVisible()) {
      await guestInput.fill('E2EGuest');
      await page.getByRole('button', { name: /PLAY AS GUEST/i }).click();
      await expect(guestInput).not.toBeVisible();
    }

    // 3. Wait for the Predictor UI to initialize
    // We confirm we are on the page by looking for the race name in the header subtitle
    await expect(page.getByText(/E2E Test Grand Prix/i)).toBeVisible({ timeout: 15000 });

    // 4. Ensure we are on the Pick P10 tab
    const p10Tab = page.locator('.f1-tab-container').getByText(/Pick P10/i);
    await expect(p10Tab).toBeVisible();
    await p10Tab.click();

    // 5. Select P10 Driver
    const p10Heading = page.getByRole('heading', { name: /P10 Finisher/i }).first();
    await expect(p10Heading).toBeVisible();
    
    const verstappen = page.getByText('Max Verstappen').first();
    await expect(verstappen).toBeVisible();
    await verstappen.click();

    // 6. Wait for automatic tab switch to DNF
    const dnfHeading = page.getByRole('heading', { name: /First DNF/i }).first();
    await expect(dnfHeading).toBeVisible({ timeout: 10000 });

    // 7. Select DNF Driver
    const hamilton = page.getByText('Lewis Hamilton').first();
    await expect(hamilton).toBeVisible();
    await hamilton.click();

    // 8. Verify Summary View
    const summaryHeading = page.getByText(/Locked and Loaded!/i).or(page.getByText(/Current Picks/i));
    await expect(summaryHeading).toBeVisible({ timeout: 15000 });
    
    // 9. Verify the selections and guest status
    await expect(page.getByText(/Verstappen/i)).toBeVisible();
    await expect(page.getByText(/Hamilton/i)).toBeVisible();
    await expect(page.getByText(/Guest: E2EGuest/i)).toBeVisible();
  });
});
