# Tasks — Passwordless Auth

Tasks with no dependencies run in **Wave 1**. Dependents follow in later waves.

## Wave 1
- [x] T1: NonceStore with Redis TTL + single-use mark — _outcome: spend is atomic_
- [x] T2 @backend-dev: LinkIssuer signs and emails the magic URL — _outcome: link delivered < 5s_
- [ ] T3: /auth/start endpoint + email rate-limit — _outcome: one link per request_

## Wave 2  (depends on: Wave 1)
- [ ] T4 @backend-dev: LinkRedeemer verifies, spends, mints session JWT — _outcome: token parity_
- [ ] T5: /auth/redeem endpoint + expired/spent handling — _outcome: 410 on reuse_

## Wave 3  (depends on: Wave 2)
- [ ] T6 @frontend-dev: sign-in screen + "check your email" + resend — _outcome: full flow_
- [ ] T7: integration tests mapping every acceptance criterion — _outcome: green_

## Verification
- [ ] Single-use, expiry, and token-parity criteria each covered by a test.
