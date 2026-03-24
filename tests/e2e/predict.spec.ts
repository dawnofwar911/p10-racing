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

    // Clear everything before starting
    await page.goto('/privacy'); // Go to a lightweight page first to clear storage
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
  });

  test('should complete a prediction flow as a guest', async ({ page }) => {
    // 1. Navigate to Predict via bottom nav
    const bottomNav = page.locator('.mobile-bottom-nav');
    await bottomNav.getByRole('link', { name: /Predict/i }).click();
    await expect(page).toHaveURL(/\/predict/);

    // 2. Handle Login Wall
    // Wait for either the guest input OR the predictor to be visible
    const guestInput = page.getByPlaceholder(/Enter name/i);
    const p10Heading = page.getByText(/P10 Finisher/i);
    await expect(guestInput.or(p10Heading)).toBeVisible({ timeout: 20000 });
    
    if (await guestInput.isVisible()) {
      await guestInput.fill('E2EGuest');
      await page.getByRole('button', { name: /PLAY AS GUEST/i }).click();
      // Wait for login form to disappear
      await expect(guestInput).not.toBeVisible({ timeout: 10000 });
    }

    // 3. Wait for the Predictor UI to initialize properly
    // Check for the race name in the header subtitle
    await expect(page.getByText(/E2E Test Grand Prix/i)).toBeVisible({ timeout: 15000 });

    // 4. Navigate to P10 selection (might already be there, but let's be sure)
    // We use a broader text search for the tab link
    const p10Tab = page.locator('.nav-link').getByText(/Pick P10/i).or(page.locator('.f1-tab-container').getByText(/Pick P10/i));
    if (await p10Tab.isVisible()) {
      await p10Tab.click();
    }

    // 5. Select P10 Driver
    await expect(p10Heading.first()).toBeVisible({ timeout: 10000 });
    
    const verstappen = page.getByText('Max Verstappen').first();
    await expect(verstappen).toBeVisible();
    await verstappen.click();

    // 6. Wait for automatic tab switch to DNF selection
    const dnfHeading = page.getByText(/First DNF/i);
    await expect(dnfHeading.first()).toBeVisible({ timeout: 10000 });

    // 7. Select DNF Driver
    const hamilton = page.getByText('Lewis Hamilton').first();
    await expect(hamilton).toBeVisible();
    await hamilton.click();

    // 8. Verify Summary View
    // Success state might be "Locked and Loaded!" or "Current Picks"
    await expect(page.getByText(/Locked and Loaded!/i).or(page.getByText(/Current Picks/i))).toBeVisible({ timeout: 15000 });
    
    // 9. Verify final state
    await expect(page.getByText(/Verstappen/i)).toBeVisible();
    await expect(page.getByText(/Hamilton/i)).toBeVisible();
    await expect(page.getByText(/Guest: E2EGuest/i)).toBeVisible();
  });
});
