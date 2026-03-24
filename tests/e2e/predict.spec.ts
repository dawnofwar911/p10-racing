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

        // Fill up to 22 drivers
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
    // 1. Navigate to Predict
    const predictLink = page.locator('.mobile-bottom-nav').getByRole('link', { name: /Predict/i });
    await predictLink.click();
    await expect(page).toHaveURL(/\/predict/);

    // 2. Handle Login Wall
    const guestInput = page.getByPlaceholder(/Enter name/i);
    if (await guestInput.isVisible()) {
      await guestInput.fill('E2EGuest');
      await page.getByRole('button', { name: /PLAY AS GUEST/i }).click();
      await expect(guestInput).not.toBeVisible({ timeout: 10000 });
    }

    // 3. Select P10 Driver
    // We target the mobile container (.d-lg-none)
    const mobileContainer = page.locator('.d-lg-none');
    const lewis = mobileContainer.getByText('Lewis Hamilton').first();
    await expect(lewis).toBeVisible({ timeout: 15000 });
    
    // Find the row for Hamilton to check for the mark later
    const lewisRow = mobileContainer.locator('div').filter({ hasText: /^Lewis Hamilton$/ }).locator('xpath=..');
    
    await lewis.click();

    // Verify P10 selection visually (checkmark appears in the same row)
    await expect(lewisRow.getByText('✓')).toBeVisible({ timeout: 10000 });

    // 4. Switch to DNF tab
    const dnfTab = page.locator('.f1-tab-container').getByText(/Pick DNF/i);
    await dnfTab.click();
    
    // Confirm we are on the DNF view
    await expect(mobileContainer.getByRole('heading', { name: /First DNF/i })).toBeVisible({ timeout: 5000 });
    
    // 5. Select DNF Driver
    const charles = mobileContainer.getByText('Charles Leclerc').first();
    await expect(charles).toBeVisible({ timeout: 10000 });
    await charles.click();

    // 6. Verify Summary View
    // We expect the app to auto-submit and show the summary card
    const summaryHeading = page.getByText(/Locked and Loaded!/i).or(page.getByText(/Current Picks/i));
    await expect(summaryHeading).toBeVisible({ timeout: 20000 });
    
    // 7. Verify picks are recorded
    await expect(page.getByText(/Hamilton/i)).toBeVisible();
    await expect(page.getByText(/Leclerc/i)).toBeVisible();
  });
});
