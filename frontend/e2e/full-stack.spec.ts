import { expect, test } from '@playwright/test';

test.describe('live production-shaped stack', () => {
  test.describe.configure({ mode: 'parallel' });
  test.skip(process.env.E2E_LIVE !== '1', 'Set E2E_LIVE=1 to run against an unmocked stack');
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('ig-first-run-dismissed', '1');
      localStorage.removeItem('left-sidebar-tab');
    });
  });

  test('loads confirmed aircraft through browser, nginx, API, and PostGIS', async ({ page }) => {
    const health = await page.request.get('/api/health');
    expect(health.ok()).toBe(true);
    await expect.poll(async () => {
      const response = await page.request.get('/api/aircraft/?include_stale=true');
      if (!response.ok()) return 0;
      const body = await response.json() as unknown[];
      return body.length;
    }, { timeout: 60_000, intervals: [2_000, 5_000, 10_000] }).toBeGreaterThan(0);

    const aircraftResponse = await page.request.get('/api/aircraft/?include_stale=true');
    const aircraft = await aircraftResponse.json() as Array<{ latitude: number; longitude: number }>;
    const anchor = aircraft.find(record =>
      Number.isFinite(record.latitude) && Number.isFinite(record.longitude)
    );
    expect(anchor).toBeTruthy();
    const view = new URLSearchParams({
      lon: String(anchor!.longitude),
      lat: String(anchor!.latitude),
      alt: '3000000',
      h: '0',
      p: '-90',
      map: 'satellite',
      preset: 'normal',
      layers: 'aircraft',
    });
    const aircraftUiResponse = page.waitForResponse(
      response => new URL(response.url()).pathname === '/api/aircraft/' && response.ok(),
      { timeout: 60_000 },
    );
    await page.goto(`/#${view.toString()}`);
    await expect(page.locator('.cesium-widget canvas')).toBeVisible();
    const browserAircraft = await (await aircraftUiResponse).json() as unknown[];
    expect(browserAircraft.length).toBeGreaterThan(0);
    await expect(page.locator('.command-strip__health')).toHaveAttribute(
      'aria-label',
      /System status: (live|degraded)/,
      { timeout: 30_000 },
    );
  });

  test('renders confirmed satellites as Cesium primitives', async ({ page }) => {
    await expect.poll(async () => {
      const response = await page.request.get('/api/satellites/');
      if (!response.ok()) return 0;
      const body = await response.json() as unknown[];
      return body.length;
    }, { timeout: 60_000, intervals: [2_000, 5_000, 10_000] }).toBeGreaterThan(0);

    const view = new URLSearchParams({
      lon: '0',
      lat: '20',
      alt: '8000000',
      h: '0',
      p: '-90',
      map: 'satellite',
      preset: 'normal',
      layers: 'satellites',
    });
    await page.goto(`/#${view.toString()}`);
    await expect(page.locator('.cesium-widget canvas')).toBeVisible();
    await expect.poll(
      () => page.locator('.cesium-widget canvas').getAttribute('data-satellite-render-count')
        .then(value => Number(value ?? 0)),
      { timeout: 120_000, intervals: [1_000, 2_000, 5_000, 10_000] },
    ).toBeGreaterThan(0);
    await expect(page.locator('.command-strip__health')).toHaveAttribute(
      'aria-label',
      /System status: (live|degraded)/,
      { timeout: 30_000 },
    );
  });

  test('reports optional fire-feed availability honestly', async ({ page }) => {
    const response = await page.request.get('/api/fires/status');
    expect(response.ok()).toBe(true);
    const status = await response.json() as { available: boolean };
    expect(typeof status.available).toBe('boolean');

    const view = new URLSearchParams({
      lon: '0',
      lat: '0',
      alt: '5000000',
      h: '0',
      p: '-90',
      map: 'satellite',
      preset: 'normal',
      layers: 'fires',
    });
    await page.goto(`/#${view.toString()}`);
    await page.locator('.command-strip__health').evaluate(element => (element as HTMLElement).click());
    const firesHealth = page.locator('.system-health-popover__source').filter({ hasText: 'Fires' });
    await expect(firesHealth).toBeVisible({ timeout: 30_000 });
    await expect(firesHealth).toContainText(status.available ? /LIVE|EMPTY/ : 'UNAVAILABLE', {
      timeout: 30_000,
    });
  });
});
