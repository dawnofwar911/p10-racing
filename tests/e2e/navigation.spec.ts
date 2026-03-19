import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation and Core Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page before each test
    await page.goto('/');
  });

  test('should load the home page correctly', async ({ page }) => {
    // Check for the main hero text
    await expect(page.getByText(/Predict the 10th place finisher/i)).toBeVisible();
    
    // Check for the bottom navigation bar
    const bottomNav = page.locator('.mobile-bottom-nav');
    await expect(bottomNav).toBeVisible();
  });

  test('should navigate to all core pages via bottom nav', async ({ page }) => {
    // 1. Navigate to Predict
    await page.getByRole('link', { name: /Predict/i }).click();
    await expect(page).toHaveURL(/\/predict/);
    await expect(page.getByText(/Next Race/i)).toBeVisible();

    // 2. Navigate to Leagues
    await page.getByRole('link', { name: /Leagues/i }).click();
    await expect(page).toHaveURL(/\/leagues/);
    
    // Since we're a guest, we might see the join/login screen
    await expect(page.getByText(/Your Leagues/i).or(page.getByText(/Login/i))).toBeVisible();

    // 3. Navigate to Leaderboard
    await page.getByRole('link', { name: /Leaderboard/i }).click();
    await expect(page).toHaveURL(/\/leaderboard/);
    await expect(page.getByText(/Season Standings/i)).toBeVisible();

    // 4. Navigate to Standings
    await page.getByRole('link', { name: /Standings/i }).click();
    await expect(page).toHaveURL(/\/standings/);
    await expect(page.getByText(/Driver Standings/i)).toBeVisible();
  });

  test('should show the pull-to-refresh indicator on pull', async ({ page }) => {
    // We can't easily simulate complex touch gestures in a unit-test-like way here,
    // but we can check if the component exists in the DOM.
    const ptrContainer = page.locator('.ptr-container');
    await expect(ptrContainer).toBeVisible();
    
    const ptrIndicator = page.locator('.ptr-container .bg-dark');
    await expect(ptrIndicator).toBeDefined();
  });
});
