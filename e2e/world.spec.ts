import { expect, test, type Page } from '@playwright/test';

/**
 * "Try the demo" can land on Morning before seedDemo() has finished, and navigates home again when
 * it does. Wait for the last rows the seed writes (the Campfire foods) before driving the app.
 */
async function waitForDemoSeed(page: Page) {
  const foods = () =>
    page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const req = indexedDB.open('chronicle');
          // Never create the database from here: if it does not exist yet, back out.
          req.onupgradeneeded = () => req.transaction?.abort();
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
    );
  await expect.poll(foods, { timeout: 15_000, intervals: [100] }).toBeGreaterThanOrEqual(7);
  await expect(page).toHaveURL(/#\/$/);
}

test.describe('world', () => {
  test('you, map, people and a new routine', async ({ page }, testInfo) => {
    const shot = (name: string) => page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });

    await page.goto('/');
    await page.getByRole('button', { name: /try the demo/i }).click();
    await waitForDemoSeed(page);

    /* ---------- You ---------- */
    await page.goto('/#/you');
    await expect(page.locator('header')).toContainText(/Level \d+, day 23/);
    const skills = page.getByRole('region', { name: 'Skills' });
    await expect(skills.getByText('Running', { exact: true })).toBeVisible();
    await expect(skills.getByText('62', { exact: true })).toBeVisible();
    await expect(skills.getByText('Running 62 to 70: a half marathon under 1:55')).toBeVisible();
    // Body starts expanded, so its sub-stats show.
    await expect(page.getByText('Endurance', { exact: true })).toBeVisible();
    await shot('you');

    await skills.getByRole('button', { name: 'Rank again' }).click();
    await expect(page.getByTestId('rank-panel')).toBeVisible();
    await expect(page.getByTestId('copy-prompt')).toBeVisible();
    await shot('you-rank');

    /* ---------- Map ---------- */
    await page.goto('/#/map');
    for (const name of ['Body', 'Skin', 'Mind', 'Work', 'Dopamine']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText('Still in fog. The lowest region clears as it levels.')).toBeVisible();
    await expect(page.getByText('Dermatologist follow-up in 20 days.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open the people tree' })).toBeVisible();
    await shot('map');

    /* ---------- People ---------- */
    await page.goto('/#/people');
    await expect(page.locator('header')).toContainText('8 branches, 2 fading');
    await expect(page.getByRole('link', { name: /^Mentor, 21 days, fading$/ })).toBeVisible();
    const reach = page.getByTestId('reach-out');
    await expect(reach.getByTestId('reach-name')).toHaveText('Mentor');
    await expect(reach).toContainText('21 days quiet');
    await shot('people');

    await reach.getByRole('button', { name: 'Log contact' }).click();
    await reach.getByRole('button', { name: 'call', exact: true }).click();
    await reach.getByRole('button', { name: 'Save' }).click();
    await expect(reach.getByTestId('reach-name')).not.toHaveText('Mentor');
    await expect(reach.getByTestId('reach-name')).toHaveText('Retail client');
    await expect(reach).toContainText('Logged a call with Mentor.');
    await expect(page.locator('header')).toContainText('8 branches, 1 fading');
    await shot('people-after');

    /* ---------- New routine ---------- */
    await page.goto('/#/edit/routines/new');
    await expect(page.locator('header')).toContainText('New routine');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Still missing: name, pillar, upside, cost.')).toBeVisible();
    await page.getByLabel('Name').fill('Stretch, ten minutes');
    await page.getByRole('button', { name: 'Body', exact: true }).click();
    await page.getByRole('button', { name: 'Recovery', exact: true }).click();
    await page.getByRole('button', { name: '3', exact: true }).click();
    await page.getByRole('button', { name: 'Mon', exact: true }).click();
    await page.getByRole('button', { name: 'Thu', exact: true }).click();
    await page.getByLabel('Time window').fill('21:30-21:40');
    await page.getByLabel('Upside').fill('Legs stay loose for the Sunday long run');
    await page.getByLabel('Cost of a miss').fill('Tight hamstrings cost about a minute on Sunday');
    await shot('routine-form');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(/#\/edit\/routines$/);
    const created = page.getByRole('listitem').filter({ hasText: 'Stretch, ten minutes' });
    await expect(created).toBeVisible();
    await expect(created).toContainText('Body, Recovery · weight 3');
    await expect(created).toContainText('Mon, Thu · streak 0 · 1 shield');
    await shot('routines');
  });
});
