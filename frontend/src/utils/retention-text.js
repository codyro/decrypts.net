// Builds the user-facing data-retention sentences from the `retention`
// object returned by `GET /open_api/settings` (derived from the operator's
// auto-cleanup settings). Pure function: the caller injects the translator
// (bound to the 'utils.retentionText' namespace) so this can be unit-tested
// without vue-i18n. The translator must support vue-i18n interpolation and
// pluralization: t(key, count, { values }).
//
// Rules users never notice (mails to non-existent addresses) are skipped.
export const buildRetentionSentences = (retention, t) => {
    if (!retention || typeof retention !== 'object') return [];
    const sentences = [];
    const append = (key, days) => {
        if (typeof days === 'number' && Number.isFinite(days) && days > 0) {
            sentences.push(t(key, days, { days }));
        }
    };
    append('mails', retention.mailsDays);
    append('sendbox', retention.sendboxDays);
    append('inactiveAddresses', retention.inactiveAddressDays);
    append('addresses', retention.addressDays);
    append('unboundAddresses', retention.unboundAddressDays);
    return sentences;
};
