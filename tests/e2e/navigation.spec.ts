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
    // Should see the "Who's Predicting?" wall
    await expect(page.getByText(/Who's Predicting/i).or(page.getByText(/PLAY AS GUEST/i))).toBeVisible();

    // 2. Navigate to Leagues
    await page.getByRole('link', { name: /Leagues/i }).click();
    await expect(page).toHaveURL(/\/leagues/);
    await expect(page.getByText(/Your Leagues/i).or(page.getByText(/Join a League/i))).toBeVisible();

    // 3. Navigate to Leaderboard
    await page.getByRole('link', { name: /Leaderboard/i }).click();
    await expect(page).toHaveURL(/\/leaderboard/);
    await expect(page.getByText(/Season Standings/i)).toBeVisible();

    // 4. Navigate to Standings
    await page.getByRole('link', { name: /Standings/i }).click();
    await expect(page).toHaveURL(/\/standings/);
    await expect(page.getByText(/Driver Standings/i)).toBeVisible();
    
    // Standings page HAS PullToRefresh
    const ptrContainer = page.locator('.ptr-container');
    await expect(ptrContainer).toBeVisible();
  });

  test('should allow playing as a guest', async ({ page }) => {
    await page.getByRole('link', { name: /Predict/i }).click();
    
    // Fill in guest name
    await page.getByPlaceholder(/Enter name/i).fill('TestBot');
    await page.getByRole('button', { name: /PLAY AS GUEST/i }).click();

    // Now we should see the actual prediction UI
    await expect(page.getByText(/P10 Prediction/i).or(page.getByText(/Submit Picks/i))).toBeVisible();
    await expect(page.getByText(/TestBot/i)).toBeVisible();
  });
});
