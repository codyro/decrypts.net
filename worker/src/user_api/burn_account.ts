import { Context } from 'hono';
import { Jwt } from 'hono/utils/jwt'
import {
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

import { Passkey } from '../models';
import i18n from '../i18n';
import { getBooleanValue } from '../utils';
import { deleteUserWithData } from '../common';
import { PASSKEY_ONLY_PASSWORD } from './passkey';

/**
 * "Burn account": permanently delete the signed-in user account and every
 * mailbox bound to it, with all of their data. Gated behind the
 * ENABLE_USER_BURN_ACCOUNT worker var (both endpoints return 403 when off)
 * and protected by the generic sensitive-endpoint rate limiting / IP
 * blacklist handling in worker.ts.
 *
 * Burning requires fresh re-authentication: the account password (SHA-256
 * hex, same as login) or a passkey assertion verified against a
 * burn_account challenge that is limited to this user's own credentials,
 * plus typing an exact confirmation phrase.
 */

/** Exact phrases accepted for the `confirm` field. */
const BURN_CONFIRM_PHRASES = ['burn my account', '销毁我的账户'];

const checkEnabled = (c: Context<HonoCustomType>): Response | null => {
    if (getBooleanValue(c.env.ENABLE_USER_BURN_ACCOUNT)) return null;
    const msgs = i18n.getMessagesbyContext(c);
    return c.text(msgs.BurnAccountDisabledMsg, 403);
}

export default {
    challenge: async (c: Context<HonoCustomType>) => {
        const disabled = checkEnabled(c);
        if (disabled) return disabled;
        const msgs = i18n.getMessagesbyContext(c);
        const user = c.get("userPayload");
        const { domain } = await c.req.json();
        if (!domain) {
            return c.text(msgs.InvalidInputMsg, 400);
        }
        const { results } = await c.env.DB.prepare(
            `SELECT passkey_id FROM user_passkeys WHERE user_id = ?`
        ).bind(user.user_id).all<{ passkey_id: string }>();
        // signed challenge JWT: bound to this user and this purpose, 5 min
        const now = Math.floor(Date.now() / 1000);
        const challenge = await Jwt.sign({
            purpose: 'burn_account',
            user_id: user.user_id,
            iat: now,
            exp: now + 300,
        }, c.env.JWT_SECRET, "HS256");
        const options = await generateAuthenticationOptions({
            rpID: domain,
            challenge: challenge,
            // only this user's passkeys may be used to confirm the burn
            allowCredentials: results.map((row) => ({ id: row.passkey_id })),
        });
        return c.json(options);
    },
    burn: async (c: Context<HonoCustomType>) => {
        const disabled = checkEnabled(c);
        if (disabled) return disabled;
        const msgs = i18n.getMessagesbyContext(c);
        const user = c.get("userPayload");
        const { confirm, password, credential, origin, domain } = await c.req.json<{
            confirm?: string;
            password?: string;
            credential?: Record<string, unknown>;
            origin?: string;
            domain?: string;
        }>();
        if (!confirm || !BURN_CONFIRM_PHRASES.includes(confirm)) {
            return c.text(msgs.InvalidBurnConfirmMsg, 400);
        }
        const row = await c.env.DB.prepare(
            `SELECT id, password FROM users WHERE id = ?`
        ).bind(user.user_id).first<{ id: number, password: string }>();
        if (!row) {
            return c.text(msgs.UserNotFoundMsg, 404);
        }
        let reauthenticated = false;
        const isPasskeyOnly = row.password === PASSKEY_ONLY_PASSWORD;
        if (!isPasskeyOnly && typeof password === "string" && password.length > 0) {
            if (password !== row.password) {
                return c.text(msgs.InvalidEmailOrPasswordMsg, 401);
            }
            reauthenticated = true;
        }
        if (!reauthenticated && credential) {
            if (!origin || !domain) {
                return c.text(msgs.InvalidInputMsg, 400);
            }
            const passkey_id = (credential as { id?: string })?.id;
            if (!passkey_id) {
                return c.text(msgs.InvalidInputMsg, 400);
            }
            const passkeyRow = await c.env.DB.prepare(
                `SELECT user_id, counter, passkey FROM user_passkeys WHERE passkey_id = ?`
            ).bind(passkey_id).first<{
                user_id: number; counter: number; passkey: string;
            }>();
            // the assertion must come from a passkey of THIS user
            if (!passkeyRow || passkeyRow.user_id !== user.user_id) {
                return c.text(msgs.AuthenticationFailedMsg, 401);
            }
            const passkeyData = JSON.parse(passkeyRow.passkey) as Passkey;
            const verification = await verifyAuthenticationResponse({
                response: credential as never,
                expectedChallenge: async (challenge: string) => {
                    const payload = await Jwt.verify(atob(challenge), c.env.JWT_SECRET, "HS256");
                    if (!payload || !payload.iat) return false;
                    // challenge must be fresh (5 minutes, like the other
                    // passkey ceremonies) and issued for this burn
                    if (Math.floor(Date.now() / 1000) - payload.iat > 300) return false;
                    if (payload.purpose !== 'burn_account') return false;
                    if (payload.user_id !== user.user_id) return false;
                    return true;
                },
                expectedOrigin: origin,
                expectedRPID: domain,
                requireUserVerification: false,
                credential: {
                    id: passkeyData.id,
                    publicKey: isoBase64URL.toBuffer(passkeyData.publicKey),
                    counter: passkeyRow.counter || passkeyData.counter,
                    transports: passkeyData.transports,
                },
            });
            if (!verification.verified) {
                return c.text(msgs.AuthenticationFailedMsg, 401);
            }
            reauthenticated = true;
        }
        if (!reauthenticated) {
            return c.text(msgs.AuthenticationFailedMsg, 401);
        }
        const deletedAddresses = await deleteUserWithData(c, user.user_id, {
            burnAddresses: true,
        });
        return c.json({
            success: true,
            deleted_addresses: deletedAddresses,
        });
    },
}
