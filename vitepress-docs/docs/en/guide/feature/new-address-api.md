# Create New Email Address API

::: warning Note: Address JWT vs User JWT
This page describes **Address JWT**, which is different from **User JWT**:

- **Address JWT**: Returned when creating a mailbox via `/api/new_address` or `/admin/new_address`
  - Use `Authorization: Bearer <jwt>` header
  - Access `/api/*` endpoints (view mails, delete mails, etc.)

- **User JWT**: Obtained via `/user_api/login` or `/user_api/register`
  - Use `x-user-token: <jwt>` header
  - Access `/user_api/*` endpoints (user account management)

**Do not confuse these two JWT types!**
:::

## Create Email Address via Admin API

This is a `python` example using the `requests` library to send emails.

```python
res = requests.post(
    # Replace xxxx.xxxx with your worker domain
    "https://xxxx.xxxx/admin/new_address",
    json={
        # Enable prefix (True/False)
        "enablePrefix": True,
        "name": "<email_name>",
        "domain": "<email_domain>",
    },
    headers={
        'x-admin-auth': "<your_website_admin_password>",
        # "x-custom-auth": "<your_website_password>", # If private site password is enabled
        "Content-Type": "application/json"
    }
)

# Returns {"jwt": "<Jwt>", "address": "<email_address>", "address_id": 123}
print(res.json())
```

### Create an Encrypted Mailbox Address

With `ENABLE_MAIL_ENCRYPTION` enabled and the database migrated, `POST /api/new_address`, `POST /admin/new_address` and `POST /telegram/new_address` (Telegram mini-app) accept an optional `encryption_public_key` field (base64url-encoded 65-byte uncompressed P-256 point). Mail received by such an address is stored encrypted; the private key lives only in the browser (see [Mailbox Encryption](./mail-encryption.md)). An invalid key, or the feature being disabled, returns 400. Admin batch creation issues one `/admin/new_address` call per address, so every address in a batch can carry its own key. The bot `/new` command does not support this field.

```python
res = requests.post(
    "https://xxxx.xxxx/api/new_address",
    json={
        "name": "<email_name>",
        "domain": "<email_domain>",
        # Optional: mailbox encryption public key (base64url, 65-byte P-256 uncompressed point)
        "encryption_public_key": "<public key>",
    },
)
```

### Create a Subdomain Mailbox Address

If your base domain is already configured in `DOMAINS` / `DEFAULT_DOMAINS` / `USER_ROLES`, and
`ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH` is enabled (it can also be toggled in the admin panel),
the create-address APIs can accept subdomains directly:

```python
res = requests.post(
    "https://xxxx.xxxx/admin/new_address",
    json={
        "enablePrefix": True,
        "name": "project001",
        "domain": "team.example.com",
    },
    headers={
        'x-admin-auth': "<your_website_admin_password>",
        "Content-Type": "application/json"
    }
)
```

- If `example.com` is an allowed base domain, `team.example.com` and `dev.team.example.com` can match successfully
- Lookalike domains such as `badexample.com` will **not** be treated as `example.com`
- This is different from `RANDOM_SUBDOMAIN_DOMAINS`: here the caller **explicitly specifies** the subdomain, instead of the system generating a random one
- In the admin panel, this can be set to **Follow Environment Variable / Force Enable / Force Disable**. Choosing **Follow Environment Variable** clears the admin override and returns to env fallback behavior.

## Batch Create Random Username Email Addresses API Example

### Batch Create Email Addresses via Admin API

This is a `python` example using the `requests` library to send emails.

```python
import requests
import random
import string
from concurrent.futures import ThreadPoolExecutor, as_completed


def generate_random_name():
    # Generate 5 lowercase letters
    letters1 = ''.join(random.choices(string.ascii_lowercase, k=5))
    # Generate 1-3 digits
    numbers = ''.join(random.choices(string.digits, k=random.randint(1, 3)))
    # Generate 1-3 lowercase letters
    letters2 = ''.join(random.choices(string.ascii_lowercase, k=random.randint(1, 3)))
    # Combine into final name
    return letters1 + numbers + letters2


def fetch_email_data(name):
    try:
        res = requests.post(
            "https://<worker_domain>/admin/new_address",
            json={
                "enablePrefix": True,
                "name": name,
                "domain": "<email_domain>",
            },
            headers={
                'x-admin-auth': "<your_website_admin_password>",
                # "x-custom-auth": "<your_website_password>", # If private site password is enabled
                "Content-Type": "application/json"
            }
        )

        if res.status_code == 200:
            response_data = res.json()
            email = response_data.get("address", "no address")
            jwt = response_data.get("jwt", "no jwt")
            return f"{email}----{jwt}\n"
        else:
            print(f"Request failed, status code: {res.status_code}")
            return None
    except requests.RequestException as e:
        print(f"Request error: {e}")
        return None


def generate_and_save_emails(num_emails):
    with ThreadPoolExecutor(max_workers=30) as executor, open('email.txt', 'a') as file:
        futures = [executor.submit(fetch_email_data, generate_random_name()) for _ in range(num_emails)]

        for future in as_completed(futures):
            result = future.result()
            if result:
                file.write(result)


# Generate 10 emails and append to existing file
generate_and_save_emails(10)

```
