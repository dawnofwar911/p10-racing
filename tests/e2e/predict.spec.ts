import { test, expect } from '@playwright/test';

test.describe('Predict Flow (Guest User)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock F1 API
    await page.route('**/api.jolpi.ca/ergast/f1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('driverStandings.json')) {
        const drivers = [
          { id: "hamilton", name: "Lewis Hamilton", code: "HAM", team: "Ferrari", teamId: "00_ferrari", color: "#E80020" },
          { id: "leclerc", name: "Charles Leclerc", code: "LEC", team: "Ferrari", teamId: "00_ferrari", color: "#E80020" },
        ];
        for (let i = 2; i < 22; i++) {
          drivers.push({ id: `d_${i}`, name: `Driver ${i}`, code: `D${i}`, team: "Other", teamId: "zz", color: "#fff" });
        }
        const standings = drivers.map((d, i) => ({
          points: "0",
          Driver: { driverId: d.id, permanentNumber: "1", code: d.code, givenName: d.name.split(' ')[0], familyName: d.name.split(' ')[1] || d.id },
          Constructors: [{ constructorId: d.teamId, name: d.team }]
        }));
        await route.fulfill({ status: 200, body: JSON.stringify({ MRData: { StandingsTable: { StandingsLists: [{ DriverStandings: standings }] } } }) });
      } else if (url.includes('.json')) {
        await route.fulfill({ status: 200, body: JSON.stringify({ MRData: { RaceTable: { Races: [{ season: "2026", round: "99", raceName: "E2E GP", Circuit: { circuitName: "E2E" }, date: "2026-12-31", time: "10:00:00Z" }] } } }) });
      } else { await route.continue(); }
    });

    // 2. Mock Supabase
    await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });

    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should complete a prediction flow as a guest', async ({ page }) => {
    // 1. Navigate to Predict
    await page.locator('.mobile-bottom-nav').getByRole('link', { name: /Predict/i }).click();
    await expect(page).toHaveURL(/\/predict/);

    // 2. Handle Login Wall
    const guestInput = page.getByPlaceholder(/Enter name/i);
    if (await guestInput.isVisible()) {
      await guestInput.fill('E2EGuest');
      await page.getByRole('button', { name: /PLAY AS GUEST/i }).click();
      await expect(guestInput).not.toBeVisible();
    }

    // 3. Select P10 Driver
    const mobileContainer = page.locator('.d-lg-none');
    // Find the row that CONTAINS Lewis Hamilton
    const lewisRow = mobileContainer.locator('.driver-list-scroll > div').filter({ hasText: 'Lewis Hamilton' }).first();
    await expect(lewisRow).toBeVisible({ timeout: 15000 });
    await lewisRow.click();

    // 4. Manually switch to DNF tab
    const dnfTab = page.locator('.f1-tab-container').getByText(/Pick DNF/i);
    await expect(dnfTab).toBeVisible();
    await dnfTab.click();
    
    // 5. Select DNF Driver
    const charlesRow = mobileContainer.locator('.driver-list-scroll > div').filter({ hasText: 'Charles Leclerc' }).first();
    await expect(charlesRow).toBeVisible({ timeout: 10000 });
    await charlesRow.click();

    // 6. Verify Summary View
    const summaryHeading = page.getByText(/Locked and Loaded!/i).or(page.getByText(/Current Picks/i));
    await expect(summaryHeading).toBeVisible({ timeout: 20000 });
    
    // 7. Verify picks are recorded
    await expect(page.getByText(/Hamilton/i)).toBeVisible();
    await expect(page.getByText(/Leclerc/i)).toBeVisible();
  });
});
