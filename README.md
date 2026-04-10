# Nostr Boutique Admin

Merchant admin client for Nostr Boutique.

This app is a Nuxt/Vue single-page admin portal to manage listings, orders, payments, profile/settings, relays, Blossom servers, and Ditto-style theme publishing.

## What this project does

- Connect with Nostr signer methods:
  - Browser extension (NIP-07)
  - Remote signer / bunker (NIP-46)
  - Pasted key (`nsec`)
- Manage marketplace operations:
  - Listings (`kind:30402`) with Blossom image uploads
  - Orders (market flow using `kind:16` message types)
  - Payments reconciliation (`kind:16` requests + `kind:17` receipts)
  - Merchant settings (`kind:0`)
- Use inbox/outbox relay routing:
  - Bootstrap relays for initial lookup
  - `kind:10002` (NIP-65) for effective inbox/outbox relays
  - `kind:10063` for Blossom server list
- Design tab for Ditto-compatible themes:
  - `kind:36767` Theme Definition
  - `kind:16767` Active Theme

## Current UX model

- Two-stage interface:
  - Stage 1: auth/login only ("Merchant Portal")
  - Stage 2: full admin shell after connection
- Responsive navigation:
  - Left sidebar on desktop
  - Horizontal menu on mobile
- Light/dark mode toggle with persisted preference (default: light)
- Color palette aligned to Nostr-Boutique:
  - Light background: `#f3edff`
  - Dark background: `#1a1233`

## Tech stack

- Nuxt 4 / Vue 3 (JavaScript)
- TailwindCSS
- Pinia
- nostr-tools

## Local development

```bash
npm install
npm run dev
```

## Build / generate

```bash
npm run build
npm run generate
npm run preview
```

## Project notes

- External version source hosting (for update checks) is out of scope for this repo.
- Payment verification currently includes parsing and operational/manual verification states; full medium-specific proof verification is a future enhancement.
- NIP-17/NIP-59 envelope hardening is a future enhancement area.

## Key docs in this repo

- Implementation plan and status: `ADMIN_SPA_PLAN.md`
- Agent guidance: `AGENTS.md`
