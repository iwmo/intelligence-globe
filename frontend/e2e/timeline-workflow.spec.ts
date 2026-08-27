import { expect, test, type Page } from '@playwright/test';

test.setTimeout(240_000);

const AIRCRAFT = {
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
  is_stale: false,
  roll: null,
};

async function mockBackend(page: Page) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === '/api/replay/window' ? {
        oldest_ts: '2026-08-27T04:00:00Z',
        newest_ts: '2026-08-27T06:00:00Z',
      } :
      path === '/api/replay/snapshots' ? { snapshots: [] } :
      path === '/api/aircraft/test123/route' ? { origin: null, destination: null } :
      path === '/api/aircraft/test123' ? AIRCRAFT :
      path === '/api/aircraft/' ? [AIRCRAFT] :
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

test('selection and pins survive the responsive replay workflow', async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('ig-first-run-dismissed', '1');
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const search = page.getByRole('textbox', {
    name: 'Universal command and location search',
  });
  await search.fill('TST123');

  const selection = page.getByRole('complementary', { name: 'SELECTION · AIRCRAFT' });
  await expect(selection).toBeVisible();
  await selection.getByRole('button', { name: 'Pin' }).click();
  await expect(selection.getByRole('button', { name: 'Unpin' })).toBeVisible();

  await page.getByRole('button', { name: 'Open playback' }).click();
  const timeline = page.getByRole('region', { name: 'Replay timeline' });
  await expect(timeline).toBeVisible();
  await expect(timeline.getByText('AIRCRAFT test123')).toBeVisible();
  await expect(timeline.getByText('1 PINNED PRESERVED')).toBeVisible();
  await expect(timeline.getByRole('slider', { name: 'Replay position' })).toBeEnabled();
  await expect(selection).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const timelineBox = await timeline.boundingBox();
  const selectionBox = await selection.boundingBox();
  expect(timelineBox).not.toBeNull();
  expect(selectionBox).not.toBeNull();
  expect(timelineBox!.x).toBeGreaterThanOrEqual(0);
  expect(timelineBox!.x + timelineBox!.width).toBeLessThanOrEqual(391);
  expect(selectionBox!.y + selectionBox!.height).toBeLessThanOrEqual(timelineBox!.y + 1);

  await timeline.getByRole('button', { name: 'Collapse replay timeline' }).click();
  await expect(timeline.getByRole('slider', { name: 'Replay position' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Return to live' }).click();
  await expect(timeline).toHaveCount(0);
  await expect(selection).toBeVisible();
  await expect(selection.getByRole('button', { name: 'Unpin' })).toBeVisible();

  await page.getByRole('button', { name: 'Contacts' }).click();
  const contacts = page.getByRole('complementary', { name: 'CONTACTS' });
  await expect(contacts.getByText('PINNED · 1')).toBeVisible();
  await expect(contacts.getByRole('button', { name: /TEST123 AIRCRAFT/i })).toBeVisible();
});
