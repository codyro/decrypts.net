import { test, expect, type APIRequestContext } from '@playwright/test';
import { WORKER_URL } from '../../fixtures/test-helpers';

// The public settings endpoint derives a `retention` object from the
// operator's auto-cleanup settings so the website can state exactly how
// long mails and addresses are kept. Only enabled rules with a positive
// number of days are exposed; custom SQL cleanup tasks stay hidden.

const getRetention = async (request: APIRequestContext) => {
  const response = await request.get(`${WORKER_URL}/open_api/settings`);
  expect(response.ok()).toBe(true);
  return (await response.json()).retention;
};

const saveCleanupSettings = async (
  request: APIRequestContext,
  settings: Record<string, unknown>,
) => {
  const response = await request.post(`${WORKER_URL}/admin/auto_cleanup`, { data: settings });
  expect(response.ok()).toBe(true);
};

test.describe('Open settings retention', () => {
  test('exposes only enabled auto-cleanup rules with positive days', async ({ request }) => {
    const original = await request.get(`${WORKER_URL}/admin/auto_cleanup`);
    const originalSettings = original.ok() ? await original.json() : null;

    try {
      // With nothing saved, no retention info is published.
      if (originalSettings === null) {
        expect(await getRetention(request)).toBeNull();
      }

      await saveCleanupSettings(request, {
        enableMailsAutoCleanup: true,
        cleanMailsDays: 7,
        enableUnknowMailsAutoCleanup: true,
        cleanUnknowMailsDays: 3,
        enableSendBoxAutoCleanup: true,
        cleanSendBoxDays: 0,
        enableAddressAutoCleanup: true,
        cleanAddressDays: 90,
        enableInactiveAddressAutoCleanup: true,
        cleanInactiveAddressDays: 30,
        enableUnboundAddressAutoCleanup: true,
        cleanUnboundAddressDays: -1,
        enableEmptyAddressAutoCleanup: true,
        cleanEmptyAddressDays: 1,
        customSqlCleanupList: [
          { id: '1', name: 'hidden', sql: 'DELETE FROM raw_mails', enabled: true },
        ],
      });

      // Disabled-for-users rules (unknown mails, empty addresses), rules
      // with non-positive days (sendbox, unbound) and custom SQL tasks are
      // all absent.
      expect(await getRetention(request)).toEqual({
        mailsDays: 7,
        unknownMailsDays: 3,
        addressDays: 90,
        inactiveAddressDays: 30,
      });

      // When no rule is enabled, retention is null again.
      await saveCleanupSettings(request, {
        enableMailsAutoCleanup: false,
        cleanMailsDays: 7,
        customSqlCleanupList: [],
      });
      expect(await getRetention(request)).toBeNull();
    } finally {
      if (originalSettings !== null) {
        await saveCleanupSettings(request, originalSettings);
      }
    }
  });
});
