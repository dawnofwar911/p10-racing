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

    // 3. Mock Supabase Auth
    await page.route('**/*.supabase.co/auth/v1/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ session: null, user: null })
      });
    });

    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should complete a prediction flow as a guest', async ({ page }) => {
    // Give more time for the initial load and build if needed
    test.slow();

    // 1. Navigate to Predict directly
    await page.goto('/predict');
    await expect(page).toHaveURL(/\/predict/);

    // 2. Handle Login Wall
    console.log('Checking for login wall...');
    const guestInput = page.getByPlaceholder(/Enter name/i).filter({ visible: true }).first();
    
    // Check what we are seeing
    const isGuestWallVisible = await guestInput.isVisible();
    console.log(`Login wall visible: ${isGuestWallVisible}`);
    
    if (isGuestWallVisible) {
      console.log('Filling guest name...');
      await guestInput.fill('E2EGuest');
      
      console.log('Pressing Enter to submit guest login...');
      await guestInput.press('Enter');
      
      // Fallback: click the button if Enter didn't work
      const playBtn = page.getByRole('button', { name: /PLAY AS GUEST/i }).filter({ visible: true }).first();
      if (await playBtn.isVisible()) {
        console.log('Clicking PLAY AS GUEST button as fallback...');
        await playBtn.click({ force: true });
      }
      
      console.log('Waiting for guest login to be reflected in localStorage...');
      // Wait for app logic to run and set current user
      await page.waitForFunction(() => localStorage.getItem('p10_current_user') === 'E2EGuest', { timeout: 10000 });
      
      // Wait for login wall to disappear
      console.log('Waiting for login wall to disappear...');
      await expect(guestInput).not.toBeVisible({ timeout: 15000 });
    }
    
    const lewisCard = page.getByTestId('driver-card-hamilton').filter({ visible: true }).first();
    console.log('Waiting for driver cards to appear...');
    await lewisCard.waitFor({ state: 'visible', timeout: 15000 });
    
    console.log('Verifying we are on /predict and cards are visible...');
    // Ensure we are definitely on /predict
    if (!page.url().includes('/predict')) {
      await page.goto('/predict');
      await lewisCard.waitFor({ state: 'visible', timeout: 15000 });
    }

    // 3. Select P10 Driver
    console.log('Selecting P10 driver...');
    await expect(lewisCard).toBeVisible({ timeout: 15000 });
    await lewisCard.click({ force: true });

    // 4. Switch to DNF tab
    console.log('Switching to DNF tab...');
    const dnfTab = page.locator('.f1-tab-container').getByText(/Pick DNF/i).filter({ visible: true }).first();
    await dnfTab.click({ force: true });
    
    // 5. Select DNF Driver
    console.log('Selecting DNF driver...');
    const charles = page.getByTestId('driver-card-leclerc').filter({ visible: true }).first();
    await expect(charles).toBeVisible({ timeout: 15000 });
    await charles.click({ force: true });
    
    console.log('Waiting for submission transition...');
    // Give handleDnfSelect timeout time to trigger performSubmit
    await page.waitForTimeout(2000);

    // 6. Verify Summary View - Wait for the "Locked and Loaded!" state
    console.log('Checking summary view...');
    const summaryHeading = page.getByText(/Locked and Loaded!/i).or(page.getByText(/Current Picks/i)).filter({ visible: true }).first();
    await expect(summaryHeading).toBeVisible({ timeout: 40000 });
    
    // 7. Verify picks are recorded
    await expect(page.getByText(/Hamilton/i).first()).toBeVisible();
    await expect(page.getByText(/Leclerc/i).first()).toBeVisible();
  });
});
