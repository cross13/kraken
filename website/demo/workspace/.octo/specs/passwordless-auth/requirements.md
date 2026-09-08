# Requirements — Passwordless Auth

## Introduction
Let users sign in with a one-time magic link instead of a password, reducing
credential theft and support load while keeping the existing session model intact.

## User Stories
- As a returning user, I want to sign in with a link sent to my email, so that I never manage a password.
- As a security lead, I want links to expire quickly and be single-use, so that intercepted links are useless.
- As a new user, I want my first magic-link sign-in to create my account, so that onboarding is one step.

## Acceptance Criteria (EARS notation)
- WHEN a user submits a known email THEN the system SHALL send a single-use magic link within 5 seconds.
- WHILE a magic link is unused and unexpired THE system SHALL accept exactly one redemption.
- IF a link is older than 10 minutes THEN the system SHALL reject it and prompt to request a new one.
- WHEN a link is redeemed THEN the system SHALL issue the same session token used by password login.

## Out of Scope
- Social / OAuth providers.
- SMS one-time codes.

## Non-Functional Requirements
- Links signed with a rotating key; no link contents stored in plaintext.
- Email delivery p95 under 5s; sign-in endpoint p95 under 300ms.

## Open Questions
- [ ] Should an unverified email be allowed to receive a first magic link, or must it be pre-verified?
- [ ] What is the exact link expiry — 10 minutes, or shorter for high-risk accounts?
- [ ] Do we rate-limit by email, by IP, or both?
- [x] Reuse the existing session token format? — **Resolved:** Yes — issue the identical JWT used by password login so downstream services need no change.
