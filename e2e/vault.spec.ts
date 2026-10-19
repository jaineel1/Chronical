import { expect, test } from '@playwright/test';

test.describe('vault', () => {
  test('demo world: archive, letters, settings persist, backup downloads', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the demo first' }).click();
    await expect(page).toHaveURL(/#\/$/);

    await page.goto('/#/vault');
    await expect(page.locator('header')).toContainText('1 prompt');
    await expect(page.getByTestId('vault-archive')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('01-vault.png'), fullPage: true });

    await page.goto('/#/vault/archive');
    await expect(page.getByTestId('archive-row')).toHaveCount(1);
    await expect(page.getByTestId('archive-row')).toContainText('Nightly');
    await expect(page.getByTestId('archive-row')).toContainText('parsed');
    await page.screenshot({ path: testInfo.outputPath('02-archive.png'), fullPage: true });
    await page.getByRole('searchbox', { name: 'Search prompts and replies' }).fill('no such words anywhere');
    await expect(page.getByTestId('archive-row')).toHaveCount(0);
    await page.getByRole('searchbox', { name: 'Search prompts and replies' }).fill('invoicing module');
    await expect(page.getByTestId('archive-row')).toHaveCount(1);
    await page.getByTestId('archive-row').click();
    await expect(page.getByTestId('archive-prompt')).toBeVisible();
    await expect(page.getByTestId('archive-reply')).toHaveValue(/## BRIEF/);
    await page.screenshot({ path: testInfo.outputPath('03-archive-detail.png'), fullPage: true });

    await page.goto('/#/vault/letters');
    await expect(page.getByTestId('letter')).toHaveCount(1);
    await expect(page.getByTestId('letter')).toContainText('Day 23. Yesterday you ran 8 km');
    await page.screenshot({ path: testInfo.outputPath('04-letters.png'), fullPage: true });

    await page.goto('/#/vault/origin');
    await expect(page.getByTestId('state-of-me')).toHaveValue(/# State of Me/);
    await page.screenshot({ path: testInfo.outputPath('05-origin.png'), fullPage: true });

    await page.goto('/#/vault/settings');
    const deep = page.getByTestId('deep-mode');
    await expect(deep).not.toBeChecked();
    await deep.click();
    await expect(deep).toBeChecked();
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.getByTestId('deep-mode')).toBeChecked();
    await page.screenshot({ path: testInfo.outputPath('06-settings.png'), fullPage: true });

    await page.goto('/#/vault/data');
    const download = page.waitForEvent('download');
    await page.getByTestId('export-backup').click();
    expect((await download).suggestedFilename()).toMatch(/^chronicle-backup-\d{4}-\d{2}-\d{2}\.json$/);
    await expect(page.getByText(/Saved chronicle-backup-/)).toBeVisible();
    await expect(page.getByTestId('start-own-game')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('07-data.png'), fullPage: true });

    await page.goto('/#/vault/guide');
    await expect(page.getByText('How the loop works')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('08-guide.png'), fullPage: true });
  });
});
