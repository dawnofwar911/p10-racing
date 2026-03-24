import { test, expect } from '@playwright/test';

test.describe('Predict Flow (Guest User)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock F1 API to ensure stable test data
    await page.route('**/api.jolpi.ca/ergast/f1/**', async (route) => {
      const url = route.request().url();
      
      if (url.includes('driverStandings.json')) {
        // We use "A-Ferrari" to ensure it sorts to the top alphabetically
        const drivers = [
          { id: "hamilton", name: "Lewis Hamilton", code: "HAM", team: "A-Ferrari", teamId: "a_ferrari", color: "#E80020" },
          { id: "leclerc", name: "Charles Leclerc", code: "LEC", team: "A-Ferrari", teamId: "a_ferrari", color: "#E80020" },
          { id: "verstappen", name: "Max Verstappen", code: "VER", team: "Red Bull", teamId: "red_bull", color: "#3671C6" },
        ];

        // Fill up to 22 drivers
        for (let i = 3; i < 22; i++) {
          drivers.push({
            id: `driver_${i}`,
            name: `Driver ${i}`,
            code: `D${i}`,
            team: "Z-Team",
            teamId: "z_team",
            color: "#ffffff"
          });
        }

        const standings = drivers.map((d, i) => ({
          points: (100 - i).toString(),
          Driver: { 
            driverId: d.id, 
            permanentNumber: (i + 1).toString(), 
            code: d.code, 
            givenName: d.name.split(' ')[0], 
            familyName: d.name.split(' ').slice(1).join(' ') || d.id 
          },
          Constructors: [{ constructorId: d.teamId, name: d.team }]
        }));

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ MRData: { StandingsTable: { StandingsLists: [{ DriverStandings: standings }] } } })
        });
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

    // 3. Select P10 Driver
    // Explicitly click P10 tab to ensure we are in the right state
    const p10Tab = page.locator('.f1-tab-container').getByText(/Pick P10/i);
    await p10Tab.click();
    
    const lewis = page.getByText('Lewis Hamilton').first();
    await expect(lewis).toBeVisible({ timeout: 10000 });
    await lewis.click();

    // 4. Select DNF Driver
    // Instead of waiting for auto-switch (which has a 300ms delay), we manually switch
    // to make the test faster and more robust.
    const dnfTab = page.locator('.f1-tab-container').getByText(/Pick DNF/i);
    await dnfTab.click();
    
    const charles = page.getByText('Charles Leclerc').first();
    await expect(charles).toBeVisible({ timeout: 10000 });
    await charles.click();

    // 5. Verify Summary View
    await expect(page.getByText(/Locked and Loaded!/i).or(page.getByText(/Current Picks/i))).toBeVisible({ timeout: 15000 });
    
    // 6. Verify picks are recorded
    await expect(page.getByText(/Hamilton/i)).toBeVisible();
    await expect(page.getByText(/Leclerc/i)).toBeVisible();
  });
});
