import { describe, it, expect, vi } from 'vitest';
import { burnAccount, filterAddressTokensByAddresses } from '../burn-account';

// Minimal JWT-ish payload the decoder accepts: <header>.<payload>.<sig>
const makeJwt = (payload) => {
    const b64 = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
};

describe('burnAccount', () => {
    it('removes keys, saved logins, current mailbox and user token on success', async () => {
        const removeKeys = vi.fn().mockResolvedValue(undefined);
        const setLocalAddressTokens = vi.fn();
        const clearCurrentMailbox = vi.fn();
        const clearUserToken = vi.fn();
        const keep = makeJwt({ address: 'keep@example.com' });
        const burn = makeJwt({ address: 'burn1@example.com' });
        const deleted = await burnAccount({
            deleteAccountApi: vi.fn().mockResolvedValue({ deleted_addresses: ['burn1@example.com'] }),
            removeKeys,
            localAddressTokens: [keep, burn, 'garbage'],
            setLocalAddressTokens,
            currentAddress: 'burn1@example.com',
            clearCurrentMailbox,
            clearUserToken,
        });
        expect(deleted).toEqual(['burn1@example.com']);
        expect(removeKeys).toHaveBeenCalledWith('burn1@example.com');
        expect(setLocalAddressTokens).toHaveBeenCalledWith([keep, 'garbage']);
        expect(clearCurrentMailbox).toHaveBeenCalledOnce();
        expect(clearUserToken).toHaveBeenCalledOnce();
    });

    it('keeps the current mailbox when it was not one of the deleted addresses', async () => {
        const clearCurrentMailbox = vi.fn();
        await burnAccount({
            deleteAccountApi: vi.fn().mockResolvedValue({ deleted_addresses: ['other@example.com'] }),
            currentAddress: 'mine@example.com',
            clearCurrentMailbox,
        });
        expect(clearCurrentMailbox).not.toHaveBeenCalled();
    });

    it('removes keys only after the server call succeeds', async () => {
        const removeKeys = vi.fn().mockResolvedValue(undefined);
        const clearUserToken = vi.fn();
        await expect(burnAccount({
            deleteAccountApi: vi.fn().mockRejectedValue(new Error('server error')),
            removeKeys,
            clearUserToken,
        })).rejects.toThrow('server error');
        expect(removeKeys).not.toHaveBeenCalled();
        expect(clearUserToken).not.toHaveBeenCalled();
    });

    it('requires deleteAccountApi', async () => {
        await expect(burnAccount({})).rejects.toThrow();
    });
});

describe('filterAddressTokensByAddresses', () => {
    it('drops tokens belonging to any of the burned addresses and keeps the rest', () => {
        const keep = makeJwt({ address: 'keep@example.com' });
        const burn1 = makeJwt({ address: 'burn1@example.com' });
        const burn2 = makeJwt({ address: 'burn2@example.com' });
        expect(filterAddressTokensByAddresses([keep, burn1, 'garbage', burn2], ['burn1@example.com', 'burn2@example.com']))
            .toEqual([keep, 'garbage']);
    });

    it('handles non-array input', () => {
        expect(filterAddressTokensByAddresses(undefined, ['burn@example.com'])).toEqual([]);
        expect(filterAddressTokensByAddresses(null, ['burn@example.com'])).toEqual([]);
    });
});
