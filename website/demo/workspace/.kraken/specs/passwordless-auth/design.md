# Design — Passwordless Auth

## Overview
A stateless magic-link flow: the link carries a signed, short-lived token; redemption
verifies the signature, marks the token spent, and mints the standard session JWT.

## Components
- **LinkIssuer** — signs `{ email, nonce, exp }` with the rotating key, emails the URL.
- **LinkRedeemer** — verifies signature + expiry, atomically marks the nonce spent, issues the session.
- **NonceStore** — single-use ledger (Redis) with TTL = link expiry.

## Data & State
- `nonce` → `{ email, used: bool }` in Redis, TTL 10m.
- No link contents persisted; the signed token is the only carrier.

## Sequence
```
user → /auth/start (email) → LinkIssuer → email
user → click link → /auth/redeem → LinkRedeemer → session JWT → app
```

## Error Handling
- Expired/spent/invalid → 410 with a "request a new link" prompt.
- Email send failure → retry once, then surface a soft error.

## Testing Strategy
- Each acceptance criterion maps to an integration test (single-use, expiry, token parity).

## Open Questions
- [ ] Which key-rotation cadence balances safety against in-flight links?
