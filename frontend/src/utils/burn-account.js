/**
 * "Burn account" flow: permanently delete the signed-in user account and
 * every mailbox bound to it on the server, then remove this browser's
 * copies of those mailboxes (private keys and saved logins), the current
 * mailbox session when it was one of them, and the user token.
 *
 * Order matters: the server call runs FIRST and the local cleanup only
 * happens after it succeeds — when the API call fails the keys stay, so
 * mail that still exists on the server remains readable on this device.
 *
 * Kept out of the Vue component so the success/failure ordering is
 * unit-testable.
 */
import { decodeAddressToken } from './local-address-cache'

/**
 * Filter a LocalAddressCache token list down to the entries whose address
 * is NOT in `addresses`. Pure and unit-testable.
 */
export const filterAddressTokensByAddresses = (tokens, addresses) => {
    if (!Array.isArray(tokens)) return []
    const burned = new Set(Array.isArray(addresses) ? addresses : [])
    return tokens.filter((token) => !burned.has(decodeAddressToken(token)?.address))
}

/**
 * @param {object} args
 * @param {() => Promise<{deleted_addresses?: string[]} | undefined>} args.deleteAccountApi
 *   performs the server-side `POST /user_api/burn_account`; must reject on
 *   failure
 * @param {(address: string) => Promise<unknown>} [args.removeKeys] removes
 *   this browser's private keys for an address
 * @param {string[]} [args.localAddressTokens] current LocalAddressCache JWTs
 * @param {(tokens: string[]) => void} [args.setLocalAddressTokens] replaces
 *   the LocalAddressCache JWT list
 * @param {string} [args.currentAddress] the currently open mailbox address
 * @param {() => void} [args.clearCurrentMailbox] drops the current mailbox
 *   session (only called when it was one of the deleted addresses)
 * @param {() => void} [args.clearUserToken] logs out of the user center
 * @returns {Promise<string[]>} the addresses deleted on the server
 */
export const burnAccount = async ({
    deleteAccountApi,
    removeKeys,
    localAddressTokens,
    setLocalAddressTokens,
    currentAddress,
    clearCurrentMailbox,
    clearUserToken,
} = {}) => {
    if (typeof deleteAccountApi !== 'function') throw new Error('deleteAccountApi is required')
    // Server first: on failure this throws and nothing local is touched.
    const result = await deleteAccountApi()
    const addresses = Array.isArray(result?.deleted_addresses) ? result.deleted_addresses : []
    for (const address of addresses) {
        if (typeof removeKeys === 'function') await removeKeys(address)
    }
    if (typeof setLocalAddressTokens === 'function') {
        setLocalAddressTokens(filterAddressTokensByAddresses(localAddressTokens, addresses))
    }
    if (typeof clearCurrentMailbox === 'function' && addresses.includes(currentAddress)) {
        clearCurrentMailbox()
    }
    if (typeof clearUserToken === 'function') clearUserToken()
    return addresses
}
