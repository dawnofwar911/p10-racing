import { test, expect } from '@playwright/test';

test.describe('Predict Flow (Guest User)', () => {
  test.beforeEach(async ({ page }) => {
    // Start at home
    await page.goto('/');
  });

  test('should complete a prediction flow as a guest', async ({ page }) => {
    // 1. Navigate to Predict
    await page.locator('.mobile-bottom-nav').getByRole('link', { name: /Predict/i }).click();
    await expect(page).toHaveURL(/\/predict/);

    // 2. Join as Guest (if not already logged in/saved)
    const guestInput = page.getByPlaceholder(/Enter name/i);
    if (await guestInput.isVisible()) {
      await guestInput.fill('E2EGuest');
      await page.getByRole('button', { name: /PLAY AS GUEST/i }).click();
    }

    // 3. Wait for the predictor to load (Grid or Pick P10 tab)
    // We expect to see "Pick P10" or "Pick DNF" tabs
    const p10Tab = page.getByRole('button', { name: /Pick P10/i });
    await expect(p10Tab).toBeVisible({ timeout: 15000 });
    await p10Tab.click();

    // 4. Select a P10 Driver
    // Find a driver in the list. They have "driver-number" class or we can find by name.
    // Let's pick Verstappen if he's there
    const verstappen = page.getByText(/Max Verstappen/i).first();
    await expect(verstappen).toBeVisible();
    await verstappen.click();

    // 5. Should automatically switch to DNF tab
    const dnfTab = page.getByRole('button', { name: /Pick DNF/i });
    // Tab might have active class or we can just check if we are on DNF selection
    await expect(page.getByText(/First DNF/i).first()).toBeVisible();

    // 6. Select a DNF Driver
    // Let's pick Hamilton as DNF
    const hamilton = page.getByText(/Lewis Hamilton/i).first();
    await expect(hamilton).toBeVisible();
    await hamilton.click();

    // 7. Verify the summary card appears (Locked and Loaded!)
    await expect(page.getByText(/Locked and Loaded!/i).or(page.getByText(/Current Picks/i))).toBeVisible({ timeout: 10000 });
    
    // 8. Verify the picks are displayed
    await expect(page.getByText(/VERSTAPPEN/i)).toBeVisible();
    await expect(page.getByText(/HAMILTON/i)).toBeVisible();
  });
});
