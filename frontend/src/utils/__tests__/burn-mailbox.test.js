import { describe, expect, it, vi } from 'vitest';
import { burnMailbox, filterAddressTokens } from '../burn-mailbox';

const makeJwt = (payload) => {
    const b64u = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_');
    return `${b64u({ alg: 'none' })}.${b64u(payload)}.sig`;
};

describe('burnMailbox', () => {
    it('removes keys and saved addresses only after the server delete succeeds', async () => {
        const removeKeys = vi.fn().mockResolvedValue(undefined);
        const removeFromSavedAddresses = vi.fn();
        const deleteAddressApi = vi.fn().mockResolvedValue({ success: true });

        await burnMailbox({
            address: 'burn@example.com',
            deleteAddressApi,
            removeKeys,
            removeFromSavedAddresses,
        });

        expect(deleteAddressApi).toHaveBeenCalledTimes(1);
        expect(removeKeys).toHaveBeenCalledWith('burn@example.com');
        expect(removeFromSavedAddresses).toHaveBeenCalledWith('burn@example.com');
    });

    it('keeps the keys when the server deletion fails', async () => {
        const removeKeys = vi.fn().mockResolvedValue(undefined);
        const removeFromSavedAddresses = vi.fn();
        const deleteAddressApi = vi.fn().mockRejectedValue(new Error('server error'));

        await expect(burnMailbox({
            address: 'burn@example.com',
            deleteAddressApi,
            removeKeys,
            removeFromSavedAddresses,
        })).rejects.toThrow('server error');

        expect(deleteAddressApi).toHaveBeenCalledTimes(1);
        expect(removeKeys).not.toHaveBeenCalled();
        expect(removeFromSavedAddresses).not.toHaveBeenCalled();
    });

    it('does not touch saved addresses when key removal fails after a successful delete', async () => {
        const removeKeys = vi.fn().mockRejectedValue(new Error('idb error'));
        const removeFromSavedAddresses = vi.fn();

        await expect(burnMailbox({
            address: 'burn@example.com',
            deleteAddressApi: vi.fn().mockResolvedValue({ success: true }),
            removeKeys,
            removeFromSavedAddresses,
        })).rejects.toThrow('idb error');

        expect(removeFromSavedAddresses).not.toHaveBeenCalled();
    });

    it('requires an address and the API', async () => {
        await expect(burnMailbox({})).rejects.toThrow();
        await expect(burnMailbox({ address: 'burn@example.com' })).rejects.toThrow();
    });
});

describe('filterAddressTokens', () => {
    it('drops tokens belonging to the burned address and keeps the rest', () => {
        const keep = makeJwt({ address: 'keep@example.com' });
        const burn = makeJwt({ address: 'burn@example.com' });
        expect(filterAddressTokens([keep, burn, 'garbage'], 'burn@example.com')).toEqual([keep, 'garbage']);
    });

    it('handles non-array caches', () => {
        expect(filterAddressTokens(undefined, 'burn@example.com')).toEqual([]);
        expect(filterAddressTokens(null, 'burn@example.com')).toEqual([]);
    });
});
