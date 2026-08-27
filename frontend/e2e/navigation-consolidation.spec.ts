import { expect, test, type Page } from '@playwright/test';

test.setTimeout(240_000);

async function mockBackend(page: Page) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path.includes('/replay/window') ? { oldest_ts: null, newest_ts: null } :
      path === '/api/aircraft/test123/route' ? { origin: null, destination: null } :
      path === '/api/aircraft/test123' ? {
        icao24: 'test123',
        callsign: 'TST123',
        origin_country: 'Portugal',
        latitude: 38.7223,
        longitude: -9.1393,
        baro_altitude: 10_000,
        velocity: 220,
        true_track: 180,
        trail: [{ lon: -9.1393, lat: 38.7223, alt: 10_000, ts: 1_787_802_300 }],
        emergency: null,
        nav_modes: [],
        ias: null,
        tas: null,
        mach: null,
        registration: 'CS-TST',
        type_code: 'A320',
        roll: null,
      } :
      path === '/api/aircraft/' ? [{
        icao24: 'test123',
        callsign: 'TST123',
        origin_country: 'Portugal',
        latitude: 38.7223,
        longitude: -9.1393,
        baro_altitude: 10_000,
        velocity: 220,
        true_track: 180,
        trail: [],
        is_stale: false,
        roll: null,
      }] :
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

    await search.fill('TST123');
    const selection = page.getByRole('complementary', { name: 'SELECTION · AIRCRAFT' });
    await expect(selection).toBeVisible();
    await expect(selection.getByRole('heading', { name: 'Actions' })).toBeVisible();
    await expect(selection.getByRole('heading', { name: 'Context' })).toBeVisible();
    await expect(selection.getByRole('heading', { name: 'History' })).toBeVisible();

    await page.getByRole('button', { name: 'Settings (,)' }).click();
    await expect(page.getByRole('complementary', { name: 'SETTINGS' })).toBeVisible();
    await page.getByRole('button', { name: 'Return to aircraft selection' }).click();
    await expect(selection).toBeVisible();
  });
}
