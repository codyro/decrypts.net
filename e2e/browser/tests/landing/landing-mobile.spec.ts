import { expect, test, type Locator } from '@playwright/test';

import { FRONTEND_URL } from '../../../fixtures/test-helpers';

const boxesOverlap = async (a: Locator, b: Locator) => {
  const boxA = await a.boundingBox();
  const boxB = await b.boundingBox();
  if (!boxA || !boxB) return false;
  const overlapX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);
  const overlapY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);
  return overlapX > 0 && overlapY > 0;
};

test.describe('landing page at phone width', () => {
  test('no horizontal overflow and the stacked sections never overlap', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${FRONTEND_URL}/en/`);

    const header = page.locator('.app-header');
    const headline = page.locator('.hero__title');
    const card = page.locator('.landing__panel');
    const tabBar = page.locator('.landing__panel .n-tabs-nav');
    const firstStep = page.locator('.hiw-card').first();

    await expect(header).toBeVisible();
    await expect(headline).toBeVisible();
    await expect(card).toBeVisible();
    await expect(tabBar).toBeVisible();
    await expect(firstStep).toBeVisible();

    // The page must not scroll horizontally (same pattern as the inbox
    // mobile checks).
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // All three tabs fit inside the card, and the create tab comes first.
    const tabs = page.locator('.landing__panel .n-tabs-tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.first()).toHaveText('Create Email Address');
    for (let i = 0; i < await tabs.count(); i++) {
      const box = await tabs.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    }

    // The header, hero headline, mailbox card (with its tab bar) and the
    // first step card are stacked vertically at 390px, so no pair may
    // intersect.
    const pairs: Array<[Locator, Locator]> = [
      [header, headline],
      [header, card],
      [header, tabBar],
      [header, firstStep],
      [headline, card],
      [headline, tabBar],
      [headline, firstStep],
      [card, firstStep],
      [tabBar, firstStep],
    ];
    for (const [a, b] of pairs) {
      expect(await boxesOverlap(a, b)).toBe(false);
    }
  });
});
