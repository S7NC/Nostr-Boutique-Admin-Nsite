# Nostr Boutique Admin SPA Plan

## Goal

Build a single-page admin client for Nostr Boutique focused on merchant operations:

- Connect with Nostr signer methods:
  - Browser extension signer
  - Remote signer
  - Pasted `nsec`
- Manage:
  - Listings
  - Orders
  - Payments
  - Profile information
- Home dashboard with:
  - Product/order/payment stats
  - Version status UI (source hosted in a different project)

---

## Current Implementation Status (Updated)

### Implemented App Structure

- Two-stage experience:
  - Stage 1: auth/login screen only
  - Stage 2: full admin shell after signer connection
- Left menu (desktop) + horizontal tabs (mobile), responsive
- Sections implemented:
  - Home
  - Listings
  - Orders
  - Payments
  - Settings
  - Design
  - Relays
  - Blossom Servers

### Auth + Signers (Implemented)

- Signer methods:
  - Extension (NIP-07)
  - Key (pasted nsec)
  - Remote (NIP-46 bunker/nostrconnect)
- Compact auth-first login UI ("Merchant Portal")
- Theme toggle also available on auth screen

### Relay Model (Implemented)

- Inbox/outbox model implemented
- Bootstrap relays are used for initial lookup/discovery
- Relay discovery from kind `10002` (NIP-65)
- Blossom discovery from kind `10063`
- Fallback defaults if no events are found

### Listings (Implemented + UX fixes)

- Existing Listings and Create/Update flow split
- Header action: `Create New Listing`
- Existing list has `Edit` action that hydrates form
- Product ID (`d`) auto-generated from title + pubkey suffix
- Same `d` updates existing listing
- Multi-image uploads through public Blossom servers
- Upload success policy: at least one server succeeds

### Orders (Implemented)

- Order timeline grouping by `order` tag
- Status update and shipping update actions
- Uses inbox relays for incoming, outbox relays for authored/published events

### Payments (Refocused to Reconciliation)

- Payments redesigned around "has this order been paid?"
- Per-order board with:
  - due/requested/received/balance
  - payment status
  - verification state
- Request payment moved into contextual per-order action
- Manual "externally verified" state added

### Settings (Renamed from Profile)

- Section renamed to `Settings`
- "Display name" -> "Shop name"
- "Picture URL" -> "Logo URL"
- Logo upload via Blossom added
- Payment preference selector removed

### Design / Themes (Ditto-Compatible)

- New `Design` section added
- Ditto-style theme support implemented:
  - kind `36767` Theme Definition
  - kind `16767` Active Theme
- Required 3-color model:
  - primary
  - text
  - background
- Theme editor includes:
  - color pickers
  - optional fonts
  - optional background media
  - publish theme / publish+set active

### Home Version Card (Current Behavior)

- Shows:
  - "🎉 Congratulations, you are running the latest version"
- `Update to latest version` button is currently disabled/inactive
- No remote version source integration active in this repo

### Theming / Visual System (Updated)

- Light/dark mode implemented with header icon toggle
- Default theme: light
- Preference persisted in localStorage (`nb-admin-theme`)
- Palette aligned to Nostr-Boutique:
  - Light bg: `#f3edff`
  - Dark bg: `#1a1233`
- Logo used in headers and inverted in dark mode
- Auth selector has purple selected state (light/dark inverted behavior)

### Known Gaps / TODO

- NIP-17/NIP-59 complete envelope handling not fully hardened yet
- Payment proof verification is still partial/manual for some media
- Version update action is placeholder only (disabled)

---

## Product Scope

### Home

- Overview cards for:
  - Total active listings
  - Orders by status (pending/confirmed/processing/completed/cancelled)
  - Payment states
- Operational status cards (relay/signer connectivity)
- Version comparison component (read-only, external source integration point)

### Listings

- Create, edit, publish, hide, and restock product listings
- Multi-image upload for each listing
- Product metadata editor for required and optional market tags
- Collection and shipping references

### Orders

- Inbox/timeline of encrypted order events
- Parse and group by `order` ID
- Update order statuses and shipping states
- Conversation/history thread per order

### Payments

- Create/track payment requests
- Parse/verify payment receipts and proofs
- Surface payment medium (lightning/bitcoin/ecash/fiat)

### Profile

- Edit and publish merchant `kind:0` profile
- Manage payment preferences (`manual`, `ecash`, `lud16`)
- Respect application recommendation behavior (NIP-89)

---

## Protocol Research Summary

## Core Nostr

- **NIP-01**: Event model, filters, signing/verification
- **NIP-19**: `nsec`/`npub`/`naddr` decoding/encoding
- **NIP-07**: Browser extension signer (`window.nostr`)
- **NIP-46**: Remote signer (bunker/nostrconnect)
- **NIP-65**: Relay list strategy (read/write routing)
- **NIP-42**: Relay auth challenges

## Marketplace (Gamma spec)

- Required flows and kinds:
  - `30402` Product Listing
  - `30405` Product Collection
  - Merchant preferences via `kind:0` + NIP-89 recommendations
  - Order communication via NIP-17-style encrypted messaging flow
- Order/payment flow kinds:
  - `16` with `type` values:
    - `1` order creation
    - `2` payment request
    - `3` order status update
    - `4` shipping update
  - `17` payment receipt/proof
- Optional later:
  - `30406` shipping options
  - `31555` reviews
  - Drafts via NIP-37

## Encrypted messaging primitives

- **NIP-17**: Private DM model for order communications
- **NIP-44**: Encryption format
- **NIP-59**: Gift-wrap and sealed rumor mechanics
- **NIP-10**: Message threading conventions

## Blossom (listing image uploads)

- **BUD-01**: Blob retrieval + server behavior
- **BUD-02**: Upload endpoint and blob descriptor
- **BUD-03**: User server list (`kind:10063`)
- **BUD-06**: Preflight upload requirements (`HEAD /upload`)
- **BUD-11**: Nostr authorization token (`kind:24242`)
- Optional support:
  - **BUD-07** paid upload/download (`402` + payment headers)
  - **BUD-08** NIP-94 tags in descriptor

---

## Architecture Plan

## 1) App shell and state

- Replace starter landing UI with admin SPA shell
- Add sections/tabs: `Home`, `Listings`, `Orders`, `Payments`, `Profile`
- Create Pinia stores:
  - `authStore`
  - `relayStore`
  - `listingsStore`
  - `ordersStore`
  - `paymentsStore`
  - `profileStore`

## 2) Signer abstraction layer

- One unified signer interface with adapters for:
  - NIP-07 browser extension
  - NIP-46 remote signer
  - Local `nsec` signer (session-first)
- Unified methods:
  - `getPublicKey`
  - `signEvent`
  - optional encrypt/decrypt helpers

## 3) Event model and validation

- Build a parsing/validation module for:
  - product events (`30402`)
  - collection events (`30405`)
  - shipping options (`30406`)
  - order/payment DM events (`16`, `17`)
- Enforce required tags per event type
- Normalize data for UI use (typed JS objects)

## 4) Listings module

- Product editor for required tags:
  - `d`, `title`, `price`
- Support optional tags:
  - `summary`, `stock`, `visibility`, `spec`, `t`, `shipping_option`, `a`
- Image uploader workflow:
  1. Hash file (SHA-256)
  2. `HEAD /upload` pre-check (BUD-06)
  3. Optional BUD-11 auth token
  4. `PUT /upload`
  5. Attach returned URL to product `image` tags
- Upload success strategy:
  - Primary success rule: **at least one public Blossom server succeeds**
  - Optional mirror to additional servers

## 5) Orders module

- Subscribe/fetch encrypted order communications
- Decrypt and classify `kind:16` by `type`
- Build order threads keyed by `order` tag
- Merchant actions:
  - set status (`pending`/`confirmed`/`processing`/`completed`/`cancelled`)
  - send shipping updates (`processing`/`shipped`/`delivered`/`exception`)

## 6) Payments module

- Build/send payment request messages (`kind:16`, `type:2`)
- Ingest payment receipts (`kind:17`)
- Parse proof tags and display verification state
- Track payment lifecycle per order

## 7) Profile module

- Manage merchant `kind:0` fields
- Support payment preference tag behavior
- Read and apply app recommendation path (NIP-89)

## 8) Home dashboard

- Real-time stats from stores and fetched events
- Connectivity summaries:
  - signer connected/disconnected
  - relay reachability status
- Version component placeholder for externally hosted source

## 9) Reliability and security

- Relay retry/backoff and de-duplication
- Validation before publish/sign
- Protect local key handling and avoid accidental key logging
- Defensive handling of malformed events

---

## Implementation Phases

## Phase 1: Foundation

- SPA layout + navigation
- Core stores and basic app state
- Signer adapter skeleton

## Phase 2: Listings + Blossom uploads

- Product CRUD and publish pipeline
- Blossom upload manager with optional auth

## Phase 3: Orders

- Encrypted inbox + order timeline
- Status and shipping update actions

## Phase 4: Payments

- Payment request and receipt handling
- Proof display + state tracking

## Phase 5: Profile + Home

- Merchant profile/preferences editor
- Home analytics/status cards

## Phase 6: Hardening

- Edge-case handling
- Performance cleanup
- QA and event flow verification

---

## Deliverables

- Production-ready admin SPA structure
- Signer connection UX for extension/remote/nsec
- Listings editor with Blossom image uploads
- Orders and payments operational workflows
- Profile management UI
- Protocol-aligned event parsing and publishing logic

---

## Out of Scope for This Repo

- Hosting and managing the external version JSON source
- External project deployment concerns unrelated to this admin client codebase
