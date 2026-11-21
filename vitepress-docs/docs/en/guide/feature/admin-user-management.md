# Admin User Management

## User Management Page

![admin-user-management](/feature/admin-user-management.png)

## User Settings

Configure user registration and email verification here. Disabling registration does not disable login for existing users.

![admin-user-page](/feature/admin-user-page.png)

### Passkey Sign-up

The **Allow Passkey Sign-up** toggle (requires **Allow User Register**) lets new users create an account with only a passkey — no email and no password. The login/register page then shows **Create account with a passkey** as the prominent sign-up option.

- The account gets a server-generated `pk-<random>@passkey.invalid` pseudo-email (the reserved `.invalid` TLD can never receive mail or match a real login), and its password is a sentinel no password login can match, so the passkey is the only sign-in method.
- If the account loses every passkey it cannot be recovered; deleting the last passkey of such an account is refused.
- Password registration, verification codes, password login and OAuth2 login all reject emails ending in `.invalid`.
- `USER_DEFAULT_ROLE` is assigned on passkey sign-up when set, like other sign-up paths.

## Disable the User System

Set `DISABLE_USER_SYSTEM = true` in the Worker to disable the entire user system: all `/user_api/*` endpoints return 403 through a shared middleware, existing user admin tokens no longer authorize admin requests, and the frontend hides user interfaces including the user center, user management, and user settings. Leaving it unset preserves existing behavior.

Anonymous mailboxes and admin password login remain available. Do not also enable `DISABLE_ANONYMOUS_USER_CREATE_EMAIL`, or self-service mailbox creation will be unavailable. Disabling the user system does not delete existing users or mailboxes.
