import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation and Core Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page before each test
    await page.goto('/');
  });

  test('should load the home page correctly', async ({ page }) => {
    // Check for the main hero text
    await expect(page.getByText(/Predict the 10th place finisher/i)).toBeVisible();
    
    // Check for the "Next Race" section on Home
    await expect(page.getByText(/Next Race/i)).toBeVisible();

    // Check for the bottom navigation bar
    const bottomNav = page.locator('.mobile-bottom-nav');
    await expect(bottomNav).toBeVisible();
  });

  test('should navigate to all core pages via bottom nav', async ({ page }) => {
    // 1. Navigate to Predict (Guest/Login Wall)
    await page.getByRole('link', { name: /Predict/i }).click();
    await expect(page).toHaveURL(/\/predict/);
    
    // Use specific role to avoid strict mode ambiguity
    await expect(page.getByRole('heading', { name: /Who's Predicting/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /PLAY AS GUEST/i })).toBeVisible();

    // 2. Navigate to Leagues
    await page.getByRole('link', { name: /Leagues/i }).click();
    await expect(page).toHaveURL(/\/leagues/);
    // Unauthenticated view
    await expect(page.getByText(/Multiplayer Leagues/i).or(page.getByText(/Active Competitions/i))).toBeVisible();

    // 3. Navigate to Leaderboard
    await page.getByRole('link', { name: /Leaderboard/i }).click();
    await expect(page).toHaveURL(/\/leaderboard/);
    // Check for Global/Guests buttons which are unique to leaderboard
    await expect(page.getByRole('button', { name: /GLOBAL/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /GUESTS/i })).toBeVisible();

    // 4. Navigate to Standings
    await page.getByRole('link', { name: /Standings/i }).click();
    await expect(page).toHaveURL(/\/standings/);
    await expect(page.getByText(/Driver Standings/i)).toBeVisible();
    
    // Standings page HAS PullToRefresh
    const ptrContainer = page.locator('.ptr-container');
    await expect(ptrContainer).toBeVisible();
  });

  test('should allow playing as a guest', async ({ page }) => {
    await page.goto('/predict');
    
    // Fill in guest name
    const input = page.getByPlaceholder(/Enter name/i);
    await input.fill('TestBot');
    
    // Click Play as Guest button
    // Ensure we are clicking the actual button and not the span/text
    await page.getByRole('button', { name: 'PLAY AS GUEST', exact: true }).click();

    // Now we should see the actual prediction UI
    // Wait for the UI to flip. The "Next Race" or "P10 Prediction" should appear.
    // We check for any text that appears ONLY after login.
    await expect(page.getByText(/TestBot/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Current Grid/i).or(page.getByText(/Submit Picks/i))).toBeVisible({ timeout: 15000 });
  });
});
