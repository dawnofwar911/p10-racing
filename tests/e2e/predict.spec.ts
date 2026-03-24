import { test, expect } from '@playwright/test';

test.describe('Predict Flow (Guest User)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock F1 API to ensure stable test data
    await page.route('**/api.jolpi.ca/ergast/f1/**', async (route) => {
      const url = route.request().url();
      
      if (url.includes('driverStandings.json')) {
        const drivers = Array.from({ length: 22 }, (_, i) => ({
          points: (100 - i).toString(),
          Driver: { 
            driverId: i === 0 ? "max_verstappen" : (i === 1 ? "hamilton" : (i === 3 ? "leclerc" : `driver_${i}`)), 
            permanentNumber: (i + 1).toString(), 
            code: i === 0 ? "VER" : (i === 1 ? "HAM" : (i === 3 ? "LEC" : `D${i}`)), 
            givenName: i === 0 ? "Max" : (i === 1 ? "Lewis" : (i === 3 ? "Charles" : "Driver")), 
            familyName: i === 0 ? "Verstappen" : (i === 1 ? "Hamilton" : (i === 3 ? "Leclerc" : `${i}`)) 
          },
          Constructors: [{ constructorId: i % 2 === 0 ? "red_bull" : "ferrari", name: i % 2 === 0 ? "Red Bull" : "Ferrari" }]
        }));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ MRData: { StandingsTable: { StandingsLists: [{ DriverStandings: drivers }] } } }) });
      } 
      else if (url.includes('.json')) { // Calendar or results
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
      }
      else {
        await route.continue();
      }
    });

    // 2. Mock Supabase
    await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('verified_results') || url.includes('predictions') || url.includes('profiles')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should complete a prediction flow as a guest', async ({ page }) => {
    // 1. Navigate to Predict
    const bottomNav = page.locator('.mobile-bottom-nav');
    await bottomNav.getByRole('link', { name: /Predict/i }).click();
    await expect(page).toHaveURL(/\/predict/);

    // 2. Handle Login Wall
    const guestInput = page.getByPlaceholder(/Enter name/i);
    await expect(guestInput.or(page.getByText(/P10 Finisher/i))).toBeVisible({ timeout: 20000 });
    
    if (await guestInput.isVisible()) {
      await guestInput.fill('E2EGuest');
      await page.getByRole('button', { name: /PLAY AS GUEST/i }).click();
      await expect(guestInput).not.toBeVisible({ timeout: 10000 });
    }

    // 3. Verify Predictor State
    await expect(page.getByText(/Season Finished/i)).not.toBeVisible();
    await expect(page.getByText(/Predictions Closed/i)).not.toBeVisible();

    // 4. Select P10 Driver (Lewis Hamilton - Ferrari block at top)
    const lewis = page.getByText('Lewis Hamilton').first();
    await expect(lewis).toBeVisible({ timeout: 15000 });
    await lewis.click();

    // 5. Select DNF Driver (Charles Leclerc - Ferrari block at top)
    const charles = page.getByText('Charles Leclerc').first();
    await expect(charles).toBeVisible({ timeout: 10000 });
    await charles.click();

    // 6. Verify Summary View
    await expect(page.getByText(/Locked and Loaded!/i).or(page.getByText(/Current Picks/i))).toBeVisible({ timeout: 15000 });
    
    // 7. Verify picks are recorded
    await expect(page.getByText(/Hamilton/i)).toBeVisible();
    await expect(page.getByText(/Leclerc/i)).toBeVisible();
  });
});
