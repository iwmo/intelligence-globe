import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

test.setTimeout(90_000);

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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function expectNoVisibleButtonOverlap(page: Page) {
  const boxes = await page.locator('.command-strip button:visible').evaluateAll(buttons =>
    buttons.map(button => {
      const rect = button.getBoundingClientRect();
      return {
        label: button.getAttribute('aria-label') || button.textContent?.trim() || 'button',
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    }),
  );

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const overlaps =
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top;
      expect(overlaps, `${a.label} overlaps ${b.label}`).toBe(false);
    }
  }
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('ig-first-run-dismissed', '1');
    localStorage.removeItem('left-sidebar-tab');
  });
});

for (const viewport of VIEWPORTS) {
  test(`command strip has no overlap at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('banner', { name: 'Global controls' })).toBeVisible();
    await expectNoVisibleButtonOverlap(page);

    await expect(page.getByRole('button', { name: 'Open playback' })).toBeVisible();
    await page.getByRole('button', { name: 'Open playback' }).click();
    await expect(page.getByRole('button', { name: 'Return to live' })).toBeVisible();
    await expect(page.locator('.playback-bar')).toBeVisible();
    const commandStrip = await page.locator('.command-strip').boundingBox();
    const playbackBar = await page.locator('.playback-bar').boundingBox();
    expect(commandStrip).not.toBeNull();
    expect(playbackBar).not.toBeNull();
    expect(playbackBar!.y).toBeGreaterThanOrEqual(commandStrip!.y + commandStrip!.height - 1);

    await page.getByRole('button', { name: 'Enter focus mode' }).click();
    await expect(page.locator('.playback-bar')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Exit focus mode' })).toBeVisible();
    await page.getByRole('button', { name: 'Exit focus mode' }).click();
    await page.getByRole('button', { name: 'Return to live' }).click();

    await expect(page.getByRole('button', { name: /focus mode/i })).toHaveCount(1);
    if (viewport.width <= 760) {
      await page.getByRole('button', { name: 'More global controls' }).click();
      await expect(page.getByRole('button', { name: /View mode:/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Data attribution' })).toBeVisible();
    }
    await page.screenshot({
      path: testInfo.outputPath(`operational-earth-${viewport.width}x${viewport.height}.png`),
      fullPage: false,
    });
  });
}
