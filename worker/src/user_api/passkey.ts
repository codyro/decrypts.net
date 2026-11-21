import { Context } from 'hono';
import { Jwt } from 'hono/utils/jwt'
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} from '@simplewebauthn/server';

import { Passkey, GeoData, UserInfo, UserSettings } from '../models';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import i18n from '../i18n';
import { checkCfTurnstile, getJsonSetting, getStringValue, getUserRoles, isReservedPseudoEmail } from '../utils';
import { CONSTANTS } from '../constants';

/**
 * Password sentinel stored on passkey-only accounts. The frontend always
 * sends a SHA-256 hex digest (64 chars), so this value can never match a
 * password login; it only marks the account as having no password.
 */
export const PASSKEY_ONLY_PASSWORD = '!passkey-only';

/** Random `pk-<hex>@passkey.invalid` pseudo-email for a passkey-only account. */
const generatePasskeyOnlyEmail = (): string => {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    return `pk-${hex}@passkey.invalid`;
}

/**
 * Short neutral label ("<site title> account <suffix>") so users can tell
 * passkeys apart in their password manager; never an email.
 */
const passkeyOnlyLabel = (siteTitle: string, userEmail: string): string => {
    return `${siteTitle} account ${userEmail.slice(3, 9)}`;
}

export default {
    getPassKeys: async (c: Context<HonoCustomType>) => {
        const user = c.get("userPayload");
        const { results } = await c.env.DB.prepare(
            `SELECT passkey_name, passkey_id, created_at, updated_at FROM user_passkeys WHERE user_id = ?`
        ).bind(user.user_id).all<Record<string, string>>();
        return c.json(results);
    },
    renamePassKey: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        const user = c.get("userPayload");
        const { passkey_id, passkey_name } = await c.req.json();
        if (!passkey_name || passkey_name.length > 255) {
            return c.text(msgs.InvalidPasskeyNameMsg, 400);
        }
        const { success } = await c.env.DB.prepare(
            `UPDATE user_passkeys SET passkey_name = ? WHERE user_id = ? AND passkey_id = ?`
        ).bind(passkey_name, user.user_id, passkey_id).run();
        return c.json({ success });
    },
    deletePassKey: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        const user = c.get("userPayload");
        const { passkey_id } = c.req.param();
        // Deleting the last passkey of a passkey-only account would lock the
        // account out forever (its password is a sentinel no login can
        // match), so refuse. Password accounts keep the old behaviour.
        const { password } = await c.env.DB.prepare(
            `SELECT password FROM users WHERE id = ?`
        ).bind(user.user_id).first<{ password: string }>() || {};
        if (password === PASSKEY_ONLY_PASSWORD) {
            const { count } = await c.env.DB.prepare(
                `SELECT COUNT(*) as count FROM user_passkeys WHERE user_id = ?`
            ).bind(user.user_id).first<{ count: number }>() || {};
            if ((count || 0) <= 1) {
                return c.text(msgs.CannotDeleteLastPasskeyMsg, 400);
            }
        }
        const { success } = await c.env.DB.prepare(
            `DELETE FROM user_passkeys WHERE user_id = ? AND passkey_id = ?`
        ).bind(user.user_id, passkey_id).run();
        // wrapped key backups attached to this passkey are unusable without
        // the credential: remove them as well
        await c.env.DB.prepare(
            `DELETE FROM user_key_backups WHERE user_id = ? AND passkey_id = ?`
        ).bind(user.user_id, passkey_id).run();
        return c.json({ success });
    },
    registerRequest: async (c: Context<HonoCustomType>) => {
        const user = c.get("userPayload");
        const { domain } = await c.req.json();
        const { results } = await c.env.DB.prepare(
            `SELECT passkey FROM user_passkeys WHERE user_id = ?`
        ).bind(user.user_id).all<Record<string, string>>();
        const excludeCredentials = results
            .map((record: any) => JSON.parse(record.passkey) as Passkey)
            .map((passkey: Passkey) => ({
                id: passkey.id,
                transports: passkey.transports,
            }));
        // create challenge with 1 hour expiration
        const challenge = await Jwt.sign({
            user_email: user.user_email,
            user_id: user.user_id,
            iat: Math.floor(Date.now() / 1000),
        }, c.env.JWT_SECRET, "HS256")
        // Use SimpleWebAuthn's handy function to create registration options.
        const options = await generateRegistrationOptions({
            rpName: c.env.TITLE || "Temp Mail",
            rpID: domain,
            userID: new TextEncoder().encode(user.user_id.toString()),
            userName: user.user_email,
            userDisplayName: user.user_email,
            attestationType: 'none',
            excludeCredentials: excludeCredentials,
            challenge: challenge,
        });

        return c.json({
            ...options,
            // Ask the authenticator to enable the WebAuthn PRF extension so
            // the passkey can wrap/unwrap per-mailbox key backups. Passkeys
            // that do not support PRF are still registered; the browser
            // detects PRF support at use time. Authentication options are
            // unchanged, so passkey login is unaffected.
            extensions: {
                ...options.extensions,
                prf: {},
            },
        });
    },
    registerResponse: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        const user = c.get("userPayload");
        const { credential, origin, passkey_name } = await c.req.json();
        // Verify the registration response
        const verification = await verifyRegistrationResponse({
            response: credential,
            expectedChallenge: async (challenge: string) => {
                const payload = await Jwt.verify(atob(challenge), c.env.JWT_SECRET, "HS256");
                if (!payload || !payload.iat) return false;
                // check iad is not older than 5 minutes
                if (Math.floor(Date.now() / 1000) - payload.iat > 300) return false;
                if (payload.user_id !== user.user_id) return false;
                return true;
            },
            expectedOrigin: origin,
            requireUserVerification: false,
        });
        const { verified, registrationInfo } = verification;

        if (!verified || !registrationInfo) {
            return c.text(msgs.RegistrationFailedMsg, 400);
        }

        const {
            id: credentialID, publicKey,
            counter, deviceType, backedUp,
            transports,
        } = registrationInfo.credential;

        // Base64URL encode ArrayBuffers.
        const base64PublicKey = isoBase64URL.fromBuffer(publicKey);

        const newPasskey: Passkey = {
            id: credentialID,
            publicKey: base64PublicKey,
            counter,
            deviceType,
            backedUp,
            transports,
        };

        // Store the credential ID in the database
        const { success } = await c.env.DB.prepare(
            `INSERT INTO user_passkeys (user_id, passkey_name, passkey_id, passkey, counter) VALUES (?, ?, ?, ?, ?)`
        ).bind(user.user_id, passkey_name, credentialID, JSON.stringify(newPasskey), counter).run();

        return c.json({ success });
    },
    signupRequest: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        const { domain, cf_token } = await c.req.json();
        const value = await getJsonSetting(c, CONSTANTS.USER_SETTINGS_KEY);
        const settings = new UserSettings(value);
        // Opt-in: both user registration and the passkey sign-up toggle
        // must be enabled by the administrator.
        if (!settings.enable || !settings.enablePasskeySignup) {
            return c.text(msgs.PasskeySignupDisabledMsg, 403);
        }
        try {
            await checkCfTurnstile(c, cf_token);
        } catch (error) {
            return c.text(msgs.TurnstileCheckFailedMsg, 400)
        }
        // Fresh random identity for the new account. There is no username to
        // log in with, so the credential must be discoverable (resident key).
        const userEmail = generatePasskeyOnlyEmail();
        const siteTitle = c.env.TITLE || "Temp Mail";
        const userLabel = passkeyOnlyLabel(siteTitle, userEmail);
        // create challenge with 1 hour expiration
        const challenge = await Jwt.sign({
            pk_signup: true,
            user_email: userEmail,
            iat: Math.floor(Date.now() / 1000),
        }, c.env.JWT_SECRET, "HS256")
        const options = await generateRegistrationOptions({
            rpName: siteTitle,
            rpID: domain,
            userID: new TextEncoder().encode(userEmail),
            userName: userLabel,
            userDisplayName: userLabel,
            attestationType: 'none',
            challenge: challenge,
            authenticatorSelection: {
                residentKey: 'required',
                userVerification: 'preferred',
            },
        });
        return c.json({
            ...options,
            // Ask the authenticator to enable the WebAuthn PRF extension so
            // the passkey can wrap/unwrap per-mailbox key backups, same as
            // the logged-in registration flow.
            extensions: {
                ...options.extensions,
                prf: {},
            },
        });
    },
    signupResponse: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        const { credential, origin } = await c.req.json();
        let userEmail = "";
        // Verify the registration response
        const verification = await verifyRegistrationResponse({
            response: credential,
            expectedChallenge: async (challenge: string) => {
                const payload = await Jwt.verify(atob(challenge), c.env.JWT_SECRET, "HS256");
                if (!payload || !payload.iat) return false;
                // check iad is not older than 5 minutes
                if (Math.floor(Date.now() / 1000) - payload.iat > 300) return false;
                // must be a passkey sign-up challenge with the pseudo-email
                if (!payload.pk_signup || !payload.user_email) return false;
                if (!isReservedPseudoEmail(String(payload.user_email))) return false;
                userEmail = String(payload.user_email);
                return true;
            },
            expectedOrigin: origin,
            requireUserVerification: false,
        });
        const { verified, registrationInfo } = verification;

        if (!verified || !registrationInfo || !userEmail) {
            return c.text(msgs.RegistrationFailedMsg, 400);
        }

        const {
            id: credentialID, publicKey,
            counter, deviceType, backedUp,
            transports,
        } = registrationInfo.credential;

        // Base64URL encode ArrayBuffers.
        const base64PublicKey = isoBase64URL.fromBuffer(publicKey);

        const newPasskey: Passkey = {
            id: credentialID,
            publicKey: base64PublicKey,
            counter,
            deviceType,
            backedUp,
            transports,
        };

        // assign USER_DEFAULT_ROLE when set, same as other sign-up paths
        const defaultRole = getStringValue(c.env.USER_DEFAULT_ROLE);
        if (defaultRole && !getUserRoles(c).find((r) => r.role === defaultRole)) {
            return c.text(msgs.InvalidUserDefaultRoleMsg, 500);
        }

        // geo data
        const reqIp = c.req.raw.headers.get("cf-connecting-ip")
        const geoData = new GeoData(reqIp, c.req.raw.cf as any);
        const userInfo = new UserInfo(geoData, userEmail);

        // Create the user, the passkey and the default role in one batch.
        // user_email is UNIQUE, so the subqueries resolve the new user id.
        const statements = [
            c.env.DB.prepare(
                `INSERT INTO users (user_email, password, user_info)`
                + ` VALUES (?, ?, ?)`
            ).bind(userEmail, PASSKEY_ONLY_PASSWORD, JSON.stringify(userInfo)),
            c.env.DB.prepare(
                `INSERT INTO user_passkeys (user_id, passkey_name, passkey_id, passkey, counter)`
                + ` VALUES ((SELECT id FROM users WHERE user_email = ?), ?, ?, ?, ?)`
            ).bind(userEmail, passkeyOnlyLabel(c.env.TITLE || "Temp Mail", userEmail), credentialID, JSON.stringify(newPasskey), counter),
        ];
        if (defaultRole) {
            statements.push(c.env.DB.prepare(
                `INSERT INTO user_roles (user_id, role_text)`
                + ` VALUES ((SELECT id FROM users WHERE user_email = ?), ?)`
                + ` ON CONFLICT(user_id) DO NOTHING`
            ).bind(userEmail, defaultRole));
        }
        try {
            const results = await c.env.DB.batch(statements);
            if (results.some((result) => !result.success)) {
                return c.text(msgs.FailedToRegisterMsg, 500)
            }
        } catch (e) {
            const error = e as Error;
            if (error.message && error.message.includes("UNIQUE")) {
                return c.text(msgs.UserAlreadyExistsMsg, 400)
            }
            return c.text(`${msgs.FailedToRegisterMsg}: ${error.message}`, 500)
        }

        const { id: user_id } = await c.env.DB.prepare(
            `SELECT id FROM users where user_email = ?`
        ).bind(userEmail).first<{ id: number }>() || {};
        if (!user_id) {
            return c.text(msgs.UserNotFoundMsg, 500);
        }
        // create jwt, same as authenticate_response: the user is logged in
        // immediately after sign-up.
        const jwt = await Jwt.sign({
            user_email: userEmail,
            user_id: user_id,
            // 90 days expire in seconds
            exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            iat: Math.floor(Date.now() / 1000),
        }, c.env.JWT_SECRET, "HS256")
        return c.json({
            jwt: jwt
        })
    },
    authenticateRequest: async (c: Context<HonoCustomType>) => {
        const { domain } = await c.req.json();
        const challenge = await Jwt.sign({
            domain,
            iat: Math.floor(Date.now() / 1000),
        }, c.env.JWT_SECRET, "HS256")
        const options: PublicKeyCredentialRequestOptionsJSON = await generateAuthenticationOptions({
            rpID: domain,
            challenge: challenge,
            allowCredentials: [],
        });
        return c.json(options);
    },
    authenticateResponse: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        const { domain, credential, origin } = await c.req.json();
        const passkey_id = credential?.id;
        if (!passkey_id) {
            return c.text(msgs.InvalidInputMsg, 400);
        }
        const { user_id, counter, passkey } = await c.env.DB.prepare(
            `SELECT user_id, counter, passkey FROM user_passkeys WHERE passkey_id = ?`
        ).bind(passkey_id).first<{
            counter: number; passkey: string; user_id: number;
        }>() || {};
        if (!passkey) {
            return c.text(msgs.PasskeyNotFoundMsg, 404);
        }
        const passkeyData = JSON.parse(passkey) as Passkey;
        // Verify the registration response
        const verification = await verifyAuthenticationResponse({
            response: credential,
            expectedChallenge: async (challenge: string) => {
                const payload = await Jwt.verify(atob(challenge), c.env.JWT_SECRET, "HS256");
                if (!payload || !payload.iat) return false;
                // check iad is not older than 5 minutes
                if (Math.floor(Date.now() / 1000) - payload.iat > 300) return false;
                return true;
            },
            expectedOrigin: origin,
            expectedRPID: domain,
            requireUserVerification: false,
            credential: {
                id: passkeyData.id,
                publicKey: isoBase64URL.toBuffer(passkeyData.publicKey),
                counter: counter || passkeyData.counter,
                transports: passkeyData.transports,
            },
        });
        const { verified, authenticationInfo } = verification;
        if (!verified) {
            return c.text(msgs.AuthenticationFailedMsg, 400);
        }

        if (authenticationInfo) {
            const { newCounter } = authenticationInfo;
            // Update the counter in the database
            await c.env.DB.prepare(
                `UPDATE user_passkeys SET counter = ? WHERE passkey_id = ?`
            ).bind(newCounter, passkey_id).run();
        }
        // update passkey updated_at
        await c.env.DB.prepare(
            `UPDATE user_passkeys SET updated_at = datetime('now') WHERE passkey_id = ?`
        ).bind(passkey_id).run();

        // return jwt
        const { user_email } = await c.env.DB.prepare(
            `SELECT user_email FROM users WHERE id = ?`
        ).bind(user_id).first<{ user_email: string }>() || {};
        if (!user_email) {
            return c.text(msgs.UserNotFoundMsg, 404);
        }
        // create jwt
        const jwt = await Jwt.sign({
            user_email: user_email,
            user_id: user_id,
            // 90 days expire in seconds
            exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            iat: Math.floor(Date.now() / 1000),
        }, c.env.JWT_SECRET, "HS256")
        return c.json({
            jwt: jwt
        })
    },
}
