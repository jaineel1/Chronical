import { expect, test, type Page } from '@playwright/test';
import { ORIGIN_REPLY_FIXTURE } from '../src/lib/parse/origin.fixture';

async function begin(page: Page, name: string) {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/onboarding$/);
  await page.getByTestId('welcome-name').fill(name);
  await page.getByRole('button', { name: 'Begin the Origin Sheet' }).click();
  await expect(page).toHaveURL(/#\/onboarding\/part\/1$/);
}

async function skipParts(page: Page, from: number) {
  for (let n = from; n <= 10; n++) {
    await expect(page).toHaveURL(new RegExp(`#/onboarding/part/${n}$`));
    await page.getByRole('button', { name: 'Skip for now' }).click();
  }
  await expect(page).toHaveURL(/#\/onboarding\/compile$/);
}

test.describe('onboarding', () => {
  test('answers part of the sheet, skips Claude and lands in the game', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('welcome-name').fill('Riya');
    await page.screenshot({ path: testInfo.outputPath('01-welcome.png'), fullPage: true });
    await page.getByRole('button', { name: 'Begin the Origin Sheet' }).click();

    await expect(page).toHaveURL(/#\/onboarding\/part\/1$/);
    await expect(page.locator('header')).toContainText('Part 1 of 10 · Identity');
    await expect(page.getByLabel('What should the game call you?')).toHaveValue('Riya');
    await page.getByLabel('How old are you?').fill('20');
    await page.getByLabel('Where do you live? A city is enough.').fill('Ahmedabad');
    await page.getByRole('button', { name: /^Blunt/ }).click();
    await page.screenshot({ path: testInfo.outputPath('02-part-1.png'), fullPage: true });
    await page.getByTestId('continue').click();

    // Part 2 asks for its anchors before Continue moves on; Skip always does.
    await expect(page).toHaveURL(/#\/onboarding\/part\/2$/);
    await page.getByTestId('continue').click();
    await expect(page.getByText('The game needs this one.').first()).toBeVisible();
    await expect(page).toHaveURL(/#\/onboarding\/part\/2$/);
    await page.screenshot({ path: testInfo.outputPath('03-part-2-needed.png') });
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page).toHaveURL(/#\/onboarding\/part\/3$/);
    await page.getByRole('button', { name: /^Combination/ }).click();
    await page.screenshot({ path: testInfo.outputPath('04-part-3.png') });
    await skipParts(page, 3);

    await expect(page.getByTestId('sheet-view')).toContainText('Riya');
    await expect(page.getByTestId('sheet-view')).toContainText('20 years');
    await expect(page.getByTestId('sheet-view')).toContainText('Blunt');
    await page.screenshot({ path: testInfo.outputPath('05-compile.png'), fullPage: true });
    await page.getByTestId('continue').click();

    await expect(page).toHaveURL(/#\/onboarding\/prompt$/);
    await expect(page.getByTestId('copy-prompt')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('06-prompt.png'), fullPage: true });
    await page.getByRole('button', { name: 'Skip Claude for now' }).click();

    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('header')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('header')).toBeVisible();

    // The unanswered origin prompt waits in the Archive with its paste box.
    await page.goto('/#/vault/archive');
    await expect(page.getByTestId('archive-row')).toHaveCount(1);
    await expect(page.getByTestId('archive-row')).toContainText('Origin');
    await expect(page.getByTestId('archive-row')).toContainText('no reply');
    await page.getByTestId('archive-row').click();
    await expect(page.getByTestId('reply-text')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('07-archive-origin.png'), fullPage: true });

    // Running it later: the reply rewrites the State of Me and offers everything as new suggestions.
    await page.getByTestId('reply-text').fill(ORIGIN_REPLY_FIXTURE);
    await page.getByTestId('use-reply').click();
    await expect(page.getByText('State of Me updated.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Routine name' }).first()).toHaveValue('Deep work on Streaks');
    await page.getByTestId('add-suggestions').click();
    await expect(page.getByText('Added 6 skills, 8 routines, 6 goals.')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('07b-archive-added.png'), fullPage: true });
    await page.goto('/#/vault/archive');
    await expect(page.getByTestId('archive-row')).toContainText('parsed');
  });

  test('reopening the app resumes the sheet at the saved part', async ({ page }) => {
    await begin(page, 'Kabir');
    await page.getByTestId('continue').click();
    await expect(page).toHaveURL(/#\/onboarding\/part\/2$/);
    await page.getByLabel('Weight this morning, roughly').fill('61.5');
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page).toHaveURL(/#\/onboarding\/part\/3$/);
    await page.waitForTimeout(600); // answers save ~300 ms after the last change

    await page.goto('/');
    await expect(page).toHaveURL(/#\/onboarding\/part\/3$/);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByLabel('Weight this morning, roughly')).toHaveValue('61.5');
  });

  test('pastes a Claude reply, reviews it and creates the game', async ({ page }, testInfo) => {
    await begin(page, 'Riya');
    await skipParts(page, 1);
    await page.getByTestId('continue').click();
    await expect(page).toHaveURL(/#\/onboarding\/prompt$/);

    await page.getByTestId('reply-text').fill('Sure. Here is a summary of your week.');
    await page.getByTestId('use-reply').click();
    await expect(page.getByText(/This reply has no ## STATE_OF_ME and ## BRIEF section/)).toBeVisible();

    await page.getByTestId('reply-text').fill(ORIGIN_REPLY_FIXTURE);
    await page.getByTestId('use-reply').click();
    await expect(page).toHaveURL(/#\/onboarding\/review$/);
    const lists = page.getByTestId('suggestions');
    await expect(lists).toContainText('Skills');
    await expect(page.getByRole('textbox', { name: 'Routine name' }).first()).toHaveValue('Deep work on Streaks');
    await page.getByLabel('Keep Cooking').uncheck();
    await page.getByRole('textbox', { name: 'Skill name' }).first().fill('React Native');
    await page.screenshot({ path: testInfo.outputPath('08-review.png'), fullPage: true });
    await page.getByTestId('create-game').click();

    await expect(page).toHaveURL(/#\/$/);
    await page.reload();
    await expect(page).toHaveURL(/#\/$/);

    await page.goto('/#/onboarding/done');
    await expect(page.getByText('he game is running.')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('08b-done.png') });

    await page.goto('/#/vault/letters');
    await expect(page.getByTestId('letter').first()).toContainText('Day 1. You answered the whole sheet');
    await page.screenshot({ path: testInfo.outputPath('09-letters.png'), fullPage: true });

    await page.goto('/#/vault/archive');
    await expect(page.getByTestId('archive-row')).toHaveCount(1);
    await expect(page.getByTestId('archive-row')).toContainText('parsed');

    await page.goto('/#/vault/origin');
    await expect(page.getByTestId('state-of-me')).toHaveValue(/\*\*Riya\*\*, 20, Ahmedabad/);
    await page.screenshot({ path: testInfo.outputPath('10-origin.png'), fullPage: true });

    // Editing answers from the Vault keeps the game and comes back to the Vault.
    await page.getByTestId('edit-answers').click();
    await expect(page).toHaveURL(/#\/onboarding\/part\/1\?edit=1$/);
    await page.getByLabel('Where do you live? A city is enough.').fill('Pune');
    await page.getByRole('button', { name: 'Save and return' }).click();
    await expect(page).toHaveURL(/#\/vault\/origin$/);
    await page.getByRole('button', { name: 'Show the whole sheet' }).click();
    await expect(page.getByTestId('sheet-view')).toContainText('Pune');
  });
});
