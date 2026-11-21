/**
 * "Burn mailbox" flow: permanently delete the address (and all its mail) on
 * the server, then remove this browser's copy of it.
 *
 * Order matters: the server delete runs FIRST and the local keys are only
 * removed after it succeeds — when the API call fails the keys stay, so the
 * (still-existing) mailbox's encrypted mail remains readable on this device.
 *
 * Kept out of the Vue component so the success/failure ordering is
 * unit-testable.
 */
import { decodeAddressToken } from './local-address-cache'

/**
 * @param {object} args
 * @param {string} args.address address being burned
 * @param {() => Promise<unknown>} args.deleteAddressApi performs the
 *   server-side `DELETE /api/delete_address`; must reject on failure
 * @param {(address: string) => Promise<unknown>} [args.removeKeys] removes
 *   this browser's private keys for the address
 * @param {(address: string) => void} [args.removeFromSavedAddresses] drops
 *   the address from local saved-address lists
 */
export const burnMailbox = async ({
    address,
    deleteAddressApi,
    removeKeys,
    removeFromSavedAddresses,
} = {}) => {
    if (!address) throw new Error('A mail address is required to burn a mailbox')
    if (typeof deleteAddressApi !== 'function') throw new Error('deleteAddressApi is required')
    // Server first: on failure this throws and the keys are kept.
    await deleteAddressApi()
    if (typeof removeKeys === 'function') await removeKeys(address)
    if (typeof removeFromSavedAddresses === 'function') removeFromSavedAddresses(address)
}

/**
 * Filter the LocalAddressCache token list (stored JWTs) down to the entries
 * that do NOT belong to `address`. Pure and unit-testable.
 */
export const filterAddressTokens = (tokens, address) => {
    if (!Array.isArray(tokens)) return []
    return tokens.filter((token) => decodeAddressToken(token)?.address !== address)
}
