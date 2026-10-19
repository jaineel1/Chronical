import { expect, test } from '@playwright/test';
import { DEMO_REPLY_MD } from '../src/data/seed';

/**
 * Night 1 on a fresh profile, across every feature: the Origin Sheet (skipped quickly), the empty
 * Morning, the empty Campfire, the first routine through the editor, the first night log, the first
 * pasted reply, and the first real Morning. No demo data anywhere.
 */
test.describe('night 1 on a fresh profile', () => {
  test('from the welcome screen to the first morning letter', async ({ page, context }, testInfo) => {
    const shot = (name: string) => page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);

    /* ---------- Origin Sheet, the short way ---------- */
    await page.goto('/');
    await expect(page).toHaveURL(/#\/onboarding$/);
    await page.getByTestId('welcome-name').fill('Jaineel');
    await page.getByRole('button', { name: 'Begin the Origin Sheet' }).click();
    for (let n = 1; n <= 10; n++) {
      await expect(page).toHaveURL(new RegExp(`#/onboarding/part/${n}$`));
      await page.getByRole('button', { name: 'Skip for now' }).click();
    }
    await expect(page).toHaveURL(/#\/onboarding\/compile$/);
    await page.getByTestId('continue').click();
    await expect(page).toHaveURL(/#\/onboarding\/prompt$/);
    await page.getByRole('button', { name: 'Skip Claude for now' }).click();

    /* ---------- Empty Morning, Day 1 ---------- */
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('header')).toContainText(/Day 1/);
    await expect(page.getByText("No letter yet. Tonight's Campfire writes the first one.")).toBeVisible();
    await shot('01-morning-empty');

    /* ---------- Empty Campfire → first routine ---------- */
    await page.getByRole('link', { name: "Open tonight's log" }).first().click();
    await expect(page).toHaveURL(/#\/campfire$/);
    await expect(page.getByText('Add your first routine. The night log starts there.')).toBeVisible();
    await shot('02-campfire-empty');
    await page.getByRole('link', { name: 'Add a routine' }).click();
    await expect(page).toHaveURL(/#\/edit\/routines\/new$/);
    await page.getByLabel('Name').fill('Gym');
    await page.getByRole('button', { name: 'Body', exact: true }).click();
    await page.getByRole('button', { name: 'Strength', exact: true }).click();
    await page.getByRole('button', { name: '3', exact: true }).click();
    await page.getByLabel('Upside').fill('Squat 80 kg arrives on schedule');
    await page.getByLabel('Cost of a miss').fill('Each miss adds about 4 days to the 80 kg date');
    await page.getByRole('button', { name: 'Save' }).click();

    // Save returns to where the player came from: the Campfire.
    await expect(page).toHaveURL(/#\/campfire$/);
    const gym = page.getByRole('checkbox', { name: 'Gym' });
    await expect(gym).toBeVisible();
    await gym.check();
    await expect(gym).toBeChecked();
    await page.getByLabel('How did today feel').fill('First night. Nervous and a little proud.');
    await shot('03-campfire-first-log');

    /* ---------- Send and paste ---------- */
    await page.getByTestId('copy-prompt').click();
    await expect(page.getByText(/Copied\. Now paste it into Claude|Copy was blocked/)).toBeVisible();
    await page.getByTestId('reply-text').fill(DEMO_REPLY_MD);
    await page.getByTestId('use-reply').click();
    await expect(page.getByText('Letter saved. See you in the morning.')).toBeVisible();
    await shot('04-campfire-sent');

    /* ---------- The first real Morning ---------- */
    await page.goto('/#/');
    await expect(page.getByTestId('letter')).toContainText('Yesterday you ran 8 km at 5:52');
    await expect(page.getByTestId('quests').getByRole('checkbox')).toHaveCount(3);
    // Gym (weight 3, done) plus Claude's Body +2 → the Body row moved by 5 points.
    await expect(page.getByTestId('pillar-BODY')).toContainText('+5');
    await expect(page.getByTestId('pillar-WORK')).toContainText('+3');
    await shot('05-morning-first-letter');

    /* ---------- Everything is in the Vault ---------- */
    await page.goto('/#/vault/archive');
    await expect(page.getByText(/Nightly/).first()).toBeVisible();
    await page.goto('/#/you');
    await expect(page.getByText('Strength', { exact: true })).toBeVisible();

    /* ---------- Survives a reload ---------- */
    await page.reload();
    await page.goto('/#/');
    await expect(page.getByTestId('letter')).toContainText('Day 23');
  });
});
