/**
 * New-mail alert helpers: pure logic for counting mails the user has not seen
 * yet and for the "(n) title" tab prefix. Notification permission checks and
 * the actual Notification construction live in MailBox.vue.
 */

export const countNewMailIds = (seenIds, mailIds) => mailIds.filter((id) => !seenIds.has(id));

export const formatUnreadTitle = (count, baseTitle) =>
    count > 0 ? `(${count}) ${baseTitle}` : baseTitle;

export const stripUnreadTitlePrefix = (title) => String(title || '').replace(/^\(\d+\)\s+/, '');

const MAX_TRACKED_IDS = 1000;

/**
 * Stateful tracker of which mail ids the user has already seen. The first
 * observed batch is treated as "already seen" (page load, no alert); every
 * later batch reports the ids that appeared since.
 */
export const createSeenTracker = () => {
    const seen = new Set();
    let initialized = false;
    return {
        get initialized() {
            return initialized;
        },
        observe(mailIds) {
            if (seen.size + mailIds.length > MAX_TRACKED_IDS) {
                seen.clear();
                initialized = false;
            }
            if (!initialized) {
                mailIds.forEach((id) => seen.add(id));
                initialized = true;
                return [];
            }
            const fresh = countNewMailIds(seen, mailIds);
            fresh.forEach((id) => seen.add(id));
            return fresh;
        },
        markAllSeen(mailIds) {
            mailIds.forEach((id) => seen.add(id));
        },
    };
};
