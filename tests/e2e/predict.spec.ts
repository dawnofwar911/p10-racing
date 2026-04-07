import { test, expect } from '@playwright/test';

test.describe('Predict Flow (Guest User)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock F1 API to ensure stable test data
    await page.route('**/api.jolpi.ca/ergast/f1/**', async (route) => {
      const url = route.request().url();
      
      if (url.includes('driverStandings.json')) {
        // We use "00_ferrari" to ensure it sorts to the absolute top alphabetically
        const drivers = [
          { id: "hamilton", name: "Lewis Hamilton", code: "HAM", team: "Ferrari", teamId: "00_ferrari", color: "#E80020" },
          { id: "leclerc", name: "Charles Leclerc", code: "LEC", team: "Ferrari", teamId: "00_ferrari", color: "#E80020" },
        ];

        // Fill up to 22 drivers with generic data that sorts AFTER our targets
        for (let i = 2; i < 22; i++) {
          drivers.push({
            id: `driver_${i}`,
            name: `Driver ${i}`,
            code: `D${i}`,
            team: "Other Team",
            teamId: `zz_team_${i}`,
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
    // 1. Navigate to Predict directly
    await page.goto('/predict');
    await expect(page).toHaveURL(/\/predict/);

    // 2. Handle Login Wall (Wait for it if it's appearing)
    const guestInput = page.getByPlaceholder(/Enter name/i);
    try {
      // We wait up to 10s for either the login wall OR the driver list
      await Promise.race([
        guestInput.waitFor({ state: 'visible', timeout: 10000 }),
        page.getByTestId('driver-card-hamilton').waitFor({ state: 'visible', timeout: 10000 })
      ]);
    } catch (e) {
      // Ignore timeout, we'll check manually
    }

    if (await guestInput.isVisible()) {
      await guestInput.fill('E2EGuest');
      const playBtn = page.getByRole('button', { name: /PLAY AS GUEST/i });
      await playBtn.click();
      
      // Wait for login wall to disappear
      await expect(guestInput).not.toBeVisible({ timeout: 15000 });
      // The driver cards should appear after guest login
      // We filter by visible: true because SwipeablePageLayout renders both mobile and desktop views
      await page.getByTestId('driver-card-hamilton').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 10000 });
    }
    
    // Ensure we are definitely on /predict after any potential guest login redirect
    if (!page.url().includes('/predict')) {
      await page.goto('/predict');
    }

    // 3. Select P10 Driver
    // Use data-testid for absolute reliability
    const lewis = page.getByTestId('driver-card-hamilton').filter({ visible: true }).first();
    await expect(lewis).toBeVisible({ timeout: 15000 });
    await lewis.click();

    // 4. Switch to DNF tab
    const dnfTab = page.locator('.f1-tab-container').getByText(/Pick DNF/i).filter({ visible: true }).first();
    await dnfTab.click();
    
    // 5. Select DNF Driver
    const charles = page.getByTestId('driver-card-leclerc').filter({ visible: true }).first();
    await expect(charles).toBeVisible({ timeout: 15000 });
    await charles.click();
    
    // Give handleDnfSelect 300ms timeout time to trigger performSubmit
    await page.waitForTimeout(1000);

    // 6. Verify Summary View - Wait for the "Locked and Loaded!" state
    const summaryHeading = page.getByText(/Locked and Loaded!/i).or(page.getByText(/Current Picks/i));
    await expect(summaryHeading.first()).toBeVisible({ timeout: 25000 });
    
    // 7. Verify picks are recorded
    await expect(page.getByText(/Hamilton/i).first()).toBeVisible();
    await expect(page.getByText(/Leclerc/i).first()).toBeVisible();
  });
});
