import { expect, test, type Page } from '@playwright/test';

test.setTimeout(120_000);

async function mockBackend(page: Page) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path.includes('/replay/window') ? { oldest_ts: null, newest_ts: null } :
      path.includes('/gps-jamming') ? { cells: [] } :
      path.includes('/fires') ? { available: false, cells: [] } :
      path.includes('/earthquakes') ? { events: [] } :
      path.includes('/launches') ? { launches: [] } :
      path.includes('/voice/status') ? { available: false } :
      path.includes('/weather') ? {} :
      [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('ig-first-run-dismissed', '1');
  });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`consolidated navigation works at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const search = page.getByRole('textbox', {
      name: 'Universal command and location search',
    });
    await expect(search).toBeVisible();
    await search.fill('layers');
    await expect(page.getByRole('complementary', { name: 'LAYER DRAWER' })).toBeVisible();

    const panel = page.getByRole('complementary', { name: 'LAYER DRAWER' });
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);

    await expect(panel.getByRole('heading', { name: 'AIR' })).toBeVisible();
    await panel.getByPlaceholder('Filter layers or sources').fill('fire');
    await expect(panel.getByText('Active fires')).toBeVisible();
    await expect(panel.getByText('Civil aircraft')).toHaveCount(0);

    await panel.getByRole('button', { name: 'Close LAYER DRAWER' }).click();
    await page.getByRole('button', { name: 'Contacts' }).click();
    await expect(page.getByRole('complementary', { name: 'CONTACTS' })).toBeVisible();

    await page.getByRole('button', { name: 'Settings (,)' }).click();
    await expect(page.getByRole('complementary', { name: 'SETTINGS' })).toBeVisible();
  });
}
