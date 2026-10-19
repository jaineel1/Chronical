import { expect, test, type Page } from '@playwright/test';
import { DEMO_REPLY_MD } from '../src/data/seed';

/**
 * Start the demo and wait until the seed has finished. The onboarding screen navigates home as
 * soon as the profile is marked onboarded (early in the seed) and again when seeding resolves, so
 * leaving the Morning in between gets pulled back. Foods are the last table the seed writes; once
 * they are in, a reload starts a clean document.
 */
async function startDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /try the demo/i }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<number>((resolve) => {
              const req = indexedDB.open('chronicle');
              req.onerror = () => resolve(0);
              req.onsuccess = () => {
                const db = req.result;
                try {
                  const count = db.transaction('foods', 'readonly').objectStore('foods').count();
                  count.onsuccess = () => {
                    resolve(count.result);
                    db.close();
                  };
                  count.onerror = () => {
                    resolve(0);
                    db.close();
                  };
                } catch {
                  resolve(0);
                  db.close();
                }
              };
            }),
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(7);
  // A fresh document drops the onboarding screen's pending navigate('/') from the finished seed.
  await page.reload();
  await expect(page.locator('header')).toContainText(/Day 23/);
}

test.describe('the night loop', () => {
  test('log tonight, send it, paste the reply, read it in the morning', async ({ page, context }, testInfo) => {
    // Headless Chromium may still refuse the clipboard; the assertions below accept either outcome.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);

    await startDemo(page);

    await page.goto('/#/campfire');
    await expect(page.locator('header')).toContainText(/Night 23, \d{2}:\d{2}/);
    await expect(page.getByTestId('fire-scene')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('campfire-start.png'), fullPage: true });

    // Tick a routine that is scheduled every day.
    const skincare = page.getByRole('checkbox', { name: 'Evening skincare' });
    await expect(skincare).not.toBeChecked();
    await skincare.check();
    await expect(skincare).toBeChecked();

    // Change the weight through the tile editor: type a value, then step it.
    await page.getByRole('button', { name: /^Weight:/ }).click();
    const weight = page.getByRole('textbox', { name: 'Weight in kg' });
    await weight.fill('72.1');
    await page.getByRole('button', { name: 'More weight' }).click();
    await expect(weight).toHaveValue('72.2');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Weight: 72\.2 kg/ })).toBeVisible();

    // Two meals: one picked from the foods already eaten, one typed new.
    await page.getByRole('button', { name: 'Add a meal' }).click();
    await page.getByTestId('meal-adder').getByRole('button', { name: 'Oats, banana' }).click();
    await page.getByRole('textbox', { name: 'Meal', exact: true }).fill('Poha with peanuts');
    await page.getByRole('textbox', { name: 'Meal', exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Done adding' }).click();
    await expect(page.getByTestId('meals').getByRole('button', { name: /^Remove / })).toHaveCount(2);
    await expect(page.getByText('2 today')).toBeVisible();
    await page.getByLabel('How did today feel').fill('Long day, steady run.');
    await page.screenshot({ path: testInfo.outputPath('campfire.png'), fullPage: true });

    // Send tonight's log.
    await page.getByTestId('copy-prompt').click();
    await expect(page.getByText(/Copied\. Now paste it into Claude|Copy was blocked/)).toBeVisible();

    // Paste Claude's reply.
    await page.getByTestId('reply-text').fill(DEMO_REPLY_MD);
    await page.getByTestId('use-reply').click();
    await expect(page.getByText('Letter saved. See you in the morning.')).toBeVisible();
    await expect(page.getByTestId('letter-in')).toContainText("Tonight's letter is in.");
    await page.screenshot({ path: testInfo.outputPath('campfire-sent.png'), fullPage: true });

    // The Morning shows tonight's letter.
    await page.goto('/#/');
    await expect(page.getByTestId('letter')).toContainText('Yesterday you ran 8 km at 5:52');
    await expect(page.getByTestId('quests').getByRole('checkbox')).toHaveCount(3);
    await expect(page.getByTestId('pillar-WORK')).toContainText('+3');
    await page.screenshot({ path: testInfo.outputPath('morning.png'), fullPage: true });

    // A quest ticked in the morning stays ticked.
    const firstQuest = page.getByTestId('quests').getByRole('checkbox').first();
    await firstQuest.check();
    await expect(page.getByText('2 of 3 open')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('quests').getByRole('checkbox').first()).toBeChecked();

    // Keep both affirmations, one after the other.
    await page.getByRole('button', { name: 'Keep this affirmation' }).click();
    await expect(page.getByTestId('affirmation')).toContainText('2.1 levels');
    await page.getByRole('button', { name: 'Keep this affirmation' }).click();
    await expect(page.getByRole('button', { name: 'Kept' })).toBeDisabled();

    // The phone shows two sentences until asked for the rest.
    const more = page.getByRole('button', { name: 'Read the whole letter' });
    if (await more.isVisible()) {
      await more.click();
      await expect(page.getByTestId('letter')).toContainText('keeps a door open');
    }

    // Back at the fire, the night shows its letter is in, with the log folded away.
    await page.goto('/#/campfire');
    await expect(page.getByTestId('letter-in')).toContainText("Tonight's letter is in.");
    await expect(page.getByRole('button', { name: 'Edit the log' })).toBeVisible();
    await expect(page.getByTestId('routines')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('campfire-closed.png'), fullPage: true });
    await page.getByRole('button', { name: 'Edit the log' }).click();
    await expect(page.getByTestId('routines')).toBeVisible();
  });

  test('the demo Morning, and the weekly review panel', async ({ page }, testInfo) => {
    await startDemo(page);
    await expect(page.locator('header')).toContainText(/Day 23, level \d+/);
    await expect(page.getByTestId('xp-line')).toContainText(/of \d+ to level \d+/);
    await expect(page.getByTestId('pillar-WORK')).toContainText('+3');
    await expect(page.getByTestId('pillar-MIND')).toContainText('-1');
    await expect(page.getByTestId('quests').getByRole('checkbox')).toHaveCount(3);
    await page.screenshot({ path: testInfo.outputPath('morning-demo.png'), fullPage: true });

    await page.goto('/#/campfire?view=weekly');
    await expect(page.getByTestId('copy-prompt')).toHaveText('Copy the weekly review');
    await expect(page.getByText(/For Sonnet\. About/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('weekly.png'), fullPage: true });
  });
});
