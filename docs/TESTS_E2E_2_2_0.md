# Automated business and security acceptance (2.2.0, lot 1)

## Run

Prerequisites: Docker Desktop (Linux containers), Node/npm, and the local Keycloak image `quay.io/keycloak/keycloak:26.7.4` (pull it explicitly if absent).

```sh
npm ci
npx playwright install chromium
npm run test:e2e:safety
npm run test:e2e
```

`test:e2e` builds new, uniquely named backend/frontend images from this checkout and starts a disposable stack. It never builds over a release tag. For an existing candidate:

```sh
npm run test:e2e:images -- --backend-image=suivi-cb-preprod-backend:2.2.0-rc.8 --frontend-image=suivi-cb-preprod-frontend:2.2.0-rc.8
```

Only installed image references or `--build` are accepted. No external target URL, database directory, production credentials or NAS connection is accepted. Playwright independently rejects origins other than HTTP 127.0.0.1 with an explicit port.

## Stack and cleanup

Each execution owns uniquely named/labeled containers, networks and a new SQLite volume. The backend uses the internal network only. Keycloak and Nginx have a second network solely for loopback published ports. No application host directory is mounted. Fixture realm/users are imported into ephemeral Keycloak storage, with random passwords and an administrator restricted to that realm by the test code. The temporary bootstrap administrator exists only in the disposable Keycloak instance.

Synthetic users: allowed, denied, revoked, session. Direct password grants are enabled ONLY in this synthetic client for API fixtures; real browser login verifies Authorization Code with PKCE S256. Production client settings are unchanged.

Backend HTTP issuer requires NODE_ENV=test; JWT checks remain active and JWKS is fetched over the private Docker network. This tests real application images with an explicit test configuration, not full production HTTPS configuration. Proxy/TLS and OTP acceptance remain manual on NAS, with the existing disposable OTP test available as a complementary command.

Cleanup in finally removes only resources of this execution after verifying their ownership labels, and checks deletion results. SIGINT/SIGTERM stop the test child and proceed through cleanup. Hard process kill, host shutdown or an unavailable Docker daemon cannot guarantee immediate deletion; an incomplete cleanup makes the report FAIL. Never remove resources by a broad production prefix.

Images built by --build are retained for inspection, not treated as disposable production images. Browser contexts are isolated per test; screenshots, video and traces are disabled. Browser diagnostic directories are removed after the run. No tokens/passwords are written to the retained reports. Temporary import files are removed within their verified temporary directory.

## Coverage

- Real Keycloak tokens: anonymous/invalid 401, roleless 403, expired 401, refresh 200 and usable renewed token.
- API business lifecycle: create/update/delete, paired transfer with conserved combined amount, recurring occurrence exception and linkage to a posted transaction, recurrence edit/deactivation/reactivation, invalid amount rejected, persistence after backend restart.
- Chromium: PKCE login, navigation and account balances; create/edit/reload/delete using the transaction form, logout.
- Missing role: explicit denied screen, no business request on initialization, logout available.
- Rights removed: administrative role removal in synthetic realm; newly issued token is refused; reload shows denied. Already issued JWTs may retain authorization until expiration, as expected for local JWT validation.
- Session revoked: refresh failure redirects to login.
- Interceptor UI handling: one banking response is deliberately substituted with 403 to verify redirect and suppression of further loads. This injected UI check complements the separate REAL backend 403 test.

"Rapprochement" here means linking a recurring occurrence to its actual posted transaction, which the application exposes. It is not a bank statement import/reconciliation feature. Transfers are checked through paired transaction API calls; this does not establish atomicity across two separate requests.

## Reports and pass criteria

`.cache/e2e/<run>/qualification.json` contains source commit, dirty flag/diff hash, test-file hashes, exact image IDs/repository digests, start/end times, limitations and cleanup result. `tests.json` contains only scenario name/status/duration.

PASS requires every required scenario to pass without skip/retry, the post-restart persistence probe to pass, and all owned containers/volumes/networks to be removed. A dirty checkout is explicitly reported and is not a qualified release source. No automatic release approval is produced. Lot 2 will execute these commands in CI; lot 3 will consume the reports and invalidate candidate-specific evidence when applicable.

Human acceptance on the final NAS candidate remains: real HTTPS/proxy, real realm/audience, OTP enrollment/login, denied access/logout, one critical business path and visual/keyboard usability. No production deployment is performed by these commands.
