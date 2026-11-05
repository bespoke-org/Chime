# Deployment customization

Chime is the shared application. Organization-specific identity providers, access rules, assets, domains and credentials belong in the deployment's environment and infrastructure. Use a fork for changes to behavior or interface that cannot be expressed with the settings below; generally useful settings can be contributed to Chime.

## Authentication and access

Any OpenID Connect provider can supply an organization's sign-in:

```env
OIDC_ISSUER="https://auth.example.org/realms/community"
OIDC_CLIENT_ID="chime"
OIDC_CLIENT_SECRET="replace-with-the-provider-secret"
OIDC_PROVIDER_NAME="Community account"
OIDC_PROVIDER_ICON_URL="https://assets.example.org/sign-in.svg"
OIDC_SCOPE="openid profile email"
ALLOWED_SIGNIN_IDENTIFIERS="example.org, ada@example.net"
DIGEST_TIMEZONE="Europe/Saratov"
```

The provider name and icon are optional. Without them, the OIDC button reads “Continue with SSO” and uses a generic sign-in icon. The icon URL should serve a monochrome SVG; Chime displays it in the button's text color. Serve deployment-owned assets from your own static host or reverse proxy. Organization emblems are not bundled with Chime.

`ALLOWED_SIGNIN_IDENTIFIERS` accepts comma-separated email addresses, DIDs and domains (email domain or ATProto handle). Empty means open registration. `DIGEST_TIMEZONE` accepts an IANA time zone and defaults to `UTC`.

Configure these values in `.env` on the deployed host. `compose.prod.yaml` passes them to the app at runtime. For `scripts/deploy.sh`, `SYNC_PROVIDER_ENV=1` copies only local `OIDC_*`, `GOOGLE_*` and `GITHUB_*` entries to the remote `.env`; set access rules and the digest zone directly in that remote file. Restart the app after changing settings.

## Mail, storage and domains

- `NEXTAUTH_URL` and `ATPROTO_*` describe the installation's public origin and OAuth client. Set `ATPROTO_CLIENT_NAME` to the name you want the identity provider to show; it defaults to `Chime`.
- `MAIL_FROM` and `SMTP_*` configure the sender and mail transport.
- `S3_*` configure the installation's bucket, credentials and public upload endpoint.
- `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` and `COMPOSE_PROJECT_NAME` configure the bundled database and Compose volume namespace. The application itself connects through `DATABASE_URL`.
- `POSTGRES_CONTAINER` (local Compose), `GARAGE_CONTAINER` and `GARAGE_KEY_NAME` configure container and storage initialization names.
- `DEPLOY_DIR`, `SERVICE_NAME`, `PUBLIC_URL`, `STORAGE_PUBLIC_URL` and `PORT` configure the SSH deployment script.

See [.env.example](../.env.example) and [deployment.md](deployment.md) for the complete configuration. Keep secrets and local agent notes out of Git and container images.
