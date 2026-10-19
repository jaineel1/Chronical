import { expect, test } from '@playwright/test';

test.describe('smoke', () => {
  test('fresh install lands on onboarding; demo opens the Morning screen', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/onboarding/);
    await expect(page.getByText('What should the game call you?')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('onboarding.png'), fullPage: true });

    await page.getByRole('button', { name: /try the demo/i }).click();
    await expect(page).toHaveURL(/#\/$/);
    // The shell's top bar shows the day number from the seeded profile.
    await expect(page.locator('header')).toContainText(/Day 23/);
    await page.screenshot({ path: testInfo.outputPath('morning.png'), fullPage: true });

    // Every main route renders inside the shell without throwing.
    for (const route of ['map', 'campfire', 'you', 'people', 'vault']) {
      await page.goto(`/#/${route}`);
      await expect(page.locator('header')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${route}.png`), fullPage: true });
    }
  });
});
