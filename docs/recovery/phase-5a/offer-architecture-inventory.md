# Phase 5A offer architecture and legacy inventory

Date: 2026-07-28

Status: read-only characterization complete; implementation stop condition
reached

## Safety baseline

- Branch: `recovery/phase-2-runtime-workflows`
- Starting revision:
  `37f3486d3039739603919445f74a15c13278dd4c`
- Working tree before characterization: clean
- Recovery marker: valid
- Database fingerprint:
  `e79139302ae53b2dafb58a2eaf54ab47873df4a15dd3c0026ea0024d424da659`
- Legacy users: 4
- Recovery-only traders: 1
- Legacy offers: 9
- Recovery-trader offers: 0
- Sessions: 0
- Offer verifications: 0
- Contracts: 0
- Verification documents: 0
- Legacy-user snapshot hash:
  `3369cf18c0fb7ffa5881cdd4a6c25c2da11ef489c46e7b9e52f5d28f41288bbc`
- Legacy-offer snapshot hash:
  `b9492303d4d3bb157941fd3ed609438761eb85396e83861af4cfb5f77664c2fc`

All database inspection used `BEGIN READ ONLY` and ended with `ROLLBACK`.
No session, application record, or schema object was created.

No Render service, Stripe secret, or Sentry DSN was present. A local OpenAI
variable exists, but recovery mode's executable guard disables the OpenAI
client even when such a variable is present. No external integration was
contacted.

## Database offer table

The approved database has one `public.offers` table with 16 columns.

| Column | Database type | Null | Default | Constraint/authority |
|---|---|---:|---|---|
| `id` | `varchar` | no | `gen_random_uuid()` | primary key |
| `user_id` | `varchar` | no | none | FK to `users.id`; structural owner |
| `commodity_id` | `varchar` | no | none | FK to `commodities.id` |
| `type` | `offer_type` | no | none | enum: `buy`, `sell` |
| `quantity` | `numeric(15,2)` | no | none | no positivity check |
| `unit` | `varchar` | no | none | no unit constraint |
| `price_per_unit` | `numeric(15,2)` | no | none | no positivity check |
| `currency` | `varchar` | yes | `USD` | no currency constraint |
| `location` | `varchar` | no | none | no length/content constraint |
| `status` | `offer_status` | yes | `active` | enum: `active`, `pending`, `closed`, `cancelled` |
| `valid_until` | `timestamp` | yes | none | no future-date/expiry check |
| `min_quantity` | `numeric(15,2)` | yes | none | no positivity or quantity-bound check |
| `delivery_terms` | `text` | yes | none | combines Incoterm and free-form delivery prose |
| `payment_terms` | `text` | yes | none | free-form commercial terms |
| `created_at` | `timestamp` | yes | `now()` | creation timestamp |
| `updated_at` | `timestamp` | yes | `now()` | not automatically advanced by database |

Foreign keys have no explicit cascade behavior. The only index is the primary
key. There is no owner index, commodity index, status index, verification
column, publication column, organization column, moderation column, recovery
provenance column, version column, or idempotency key.

## Code/database schema drift

`shared/schema.ts` declares all database columns above, but also declares
current-code-only fields that do not exist in the database:

- `verified`;
- `specifications`;
- `delivery_options`;
- seller organization ID, name, verification, and rating;
- delegate identity and authorization fields;
- metal-bar and agricultural-packaging data;
- moderation status, reason, actor, and timestamp.

The shared `offer_status` enum also adds `hidden` and `archived`, which the
database enum rejects. The shared schema has no `draft` status.

Because storage uses full-table Drizzle selection, the current-code-only
columns make the legacy owner-list and detail queries fail before returning
data.

The generic `insertOfferSchema` omits only ID and timestamps. It still accepts
client-supplied owner, status, verification, seller-verification, organization,
delegate, and moderation fields. It strips unknown keys but accepts:

- quantity `0`;
- negative price;
- arbitrary unit;
- arbitrary currency;
- empty location;
- `verified: true`;
- `sellerOrgVerified: true`;
- client `userId`;
- moderation state.

This is not a safe offer-create contract.

## Route and storage trace

| Route | Current behavior | Ownership | Recovery state | Finding |
|---|---|---|---|---|
| `GET /api/offers` | Phase 3C public fail-closed DTO | public | allowed | safe; returns zero |
| `GET /api/offers?filter=my` | calls `storage.getOffers(sessionUserId)` | session filter exists | allowed | raw joined rows and missing-column failure; not safe |
| `GET /api/offers?filter=interested` | returns full interested offer relations | session filter exists for interest row | allowed | unrecovered domain/raw relation |
| `GET /api/offers/:id` | returns full offer, commodity, and user join | none | blocked | any authenticated user could read any row outside recovery |
| `POST /api/offers` | broad validation, insert, activity writes, automatic verification submission | storage overwrites owner with session ID | blocked | creates `active`, mixes creation with verification and incompatible activity logging |
| `PATCH /api/offers/:id/status` | writes arbitrary client status | none | blocked | any authenticated user could change any offer outside recovery |
| `POST /api/offers/:offerId/verify` | creates pending verification | no offer-owner check | blocked | verification is outside Phase 5A |
| `GET /api/offers/search` | Phase 3C public fail-closed DTO | public | allowed | safe; returns zero |
| Admin offer routes | raw aggregate and moderation behavior | separate admin middleware | blocked | outside scope |

Storage findings:

- `getOffers(userId)` does filter by `offers.user_id`, but selects and spreads
  complete offer, commodity, and user rows.
- `getOfferById(id)` has no owner predicate and returns a complete joined user.
- `createOffer(userId, offer)` assigns the server user ID after spreading the
  validated offer, but immediately writes to the nonexistent current
  `audit_logs` model.
- The route logs creation a second time and automatically inserts a pending
  offer-verification record.
- There is no transaction around offer creation and its dependent logging.
  A logging failure can leave a created offer even though the route returns an
  error.
- `updateOfferStatus(id, status)` has neither owner filtering nor a typed
  transition check.
- There is no owner edit method, owner delete method, concurrency predicate,
  idempotency check, or recovery-offer cleanup method.

## Frontend trace

### `MyOffers.tsx`

- Requests `GET /api/offers?filter=my`.
- Can replace real data with three fabricated demo offers.
- Uses statuses `draft`, `pending_verification`, `active`, `paused`, `closed`,
  and `sold_out`; four do not exist in the database.
- Reads offer verification, seller organization, and delegate identity fields
  that are absent from the database.
- Offers `Pause`/`Resume`, but `paused` is not a database status.
- Labels a `closed` transition as “Archive,” while database lifecycle and
  shared moderation/archive concepts are separate.
- Displays an Edit item without an implementation.
- “Duplicate” only logs to the console and shows a success toast; it creates no
  record.
- Links to `/create-offer`, but no application route is registered for that
  path.

### `CreateOfferModal.tsx`

- Is no longer imported by the recovered dashboard, but remains used by the
  isolated legacy `ActiveOffers` component.
- Provides a separate client validation schema with only presence validation.
- Converts numbers in the client and sends `POST /api/offers`.
- Offers units `BBL`, `MT`, `KG`, `OZ`, `LB`, and `GAL`, while stored legacy
  units use six different free-form forms.
- Offers USD, EUR, GBP, and JPY without repository or database currency
  authority.
- Treats delivery terms as free text; there is no separate Incoterm field.
- Claims successful creation requires document verification and invokes a
  verification callback, mixing draft storage with verification.

### Other implementations

- `client/src/lib/marketStore.ts` is a local-storage negotiation simulation
  with a different offer model and Incoterm enum. It is not database lifecycle
  authority.
- `OfferStateBar` mutates simulated reservation/negotiation states in local
  storage. It does not establish offer states.
- `server/seedData.ts` sets active and verification fields together for demo
  presentation. It cannot establish production lifecycle or trust semantics.
- `scripts/restore_or_seed_offers.ts` contains another generated offer model
  and free-form Incoterm/delivery values. It is not active lifecycle authority.

## Legacy offer inventory

All three owners are confirmed demo/seed-classified legacy users. No
counterparty personal data is included.

Every offer:

- is stored as `active`;
- has a `valid_until` date in the past as of 2026-07-28;
- has no authoritative offer-verification field;
- has no authoritative seller-organization-verification field;
- fails the Phase 3C publication policy;
- remains excluded from the public marketplace.

| Offer ID | Owner | Type | Commodity | Quantity / unit | Price / currency | Location |
|---|---|---|---|---|---|---|
| `dbefd152-6526-4ceb-bc6f-d9ade59ecff5` | `demo-user-1` | sell | WTI Crude Oil | 10,000.00 barrels | 78.45 USD | Houston, TX |
| `49d6c4b6-1d93-411a-ae02-f7cb6d5c2b3b` | `demo-user-1` | buy | Natural Gas (Henry Hub) | 50,000.00 MMBtu | 2.85 USD | Henry Hub, LA |
| `f99ec48a-af7c-4cfe-a160-02c4701953aa` | `demo-user-1` | sell | Brent Crude Oil | 25,000.00 barrels | 82.20 USD | Rotterdam, Netherlands |
| `b2bdd386-f8e6-41ba-a592-213be872eccf` | `demo-user-2` | buy | Gold Bullion | 100.00 bars (400oz) | 775,000.00 USD | London, UK |
| `f3e6b280-ebd6-4794-af76-a217acd37fcd` | `demo-user-2` | sell | Silver Bullion | 500.00 bars (1000oz) | 23,500.00 USD | New York, NY |
| `e19f0e34-bf49-40b1-820a-4a3dd2fbc93d` | `demo-user-2` | buy | Copper Cathode | 250.00 metric tons | 8,450.00 USD | Shanghai, China |
| `74d76314-5f42-4097-aa8e-68fdaae2ff4e` | `demo-user-3` | sell | Hard Red Winter Wheat | 5,000.00 metric tons | 285.00 USD | Kansas City, MO |
| `24388766-71fd-4ab5-add6-7fd582456a67` | `demo-user-3` | buy | Soybeans | 10,000.00 metric tons | 445.00 USD | Chicago, IL |
| `235f1eda-deac-4c08-b8c6-f1052511e2e5` | `demo-user-3` | sell | Arabica Coffee Beans | 100.00 bags (60kg) | 195.00 USD | Bogotá, Colombia |

### Terms, validity, and timestamps

The database has no separate Incoterm column. The “delivery/Incoterm” values
below are the complete free-form `delivery_terms` values.

| Offer ID | Minimum | Delivery/Incoterm terms | Valid until | Created / updated |
|---|---:|---|---|---|
| `dbefd152-6526-4ceb-bc6f-d9ade59ecff5` | 1,000 | FOB Houston Ship Channel, 15-day delivery window | 2025-12-21 | 2025-11-21 08:31:19.576 / same |
| `49d6c4b6-1d93-411a-ae02-f7cb6d5c2b3b` | 10,000 | Pipeline delivery, firm transportation | 2026-01-05 | 2025-11-21 08:31:19.798 / same |
| `f99ec48a-af7c-4cfe-a160-02c4701953aa` | 5,000 | CIF Rotterdam, Aframax tanker lots | 2025-12-12 | 2025-11-21 08:31:20.012 / same |
| `b2bdd386-f8e6-41ba-a592-213be872eccf` | 10 | LBMA approved vault, allocated storage | 2025-12-05 | 2025-11-21 08:31:20.223 / same |
| `f3e6b280-ebd6-4794-af76-a217acd37fcd` | 50 | COMEX approved warehouse, warrant delivery | 2025-12-19 | 2025-11-21 08:31:20.429 / same |
| `e19f0e34-bf49-40b1-820a-4a3dd2fbc93d` | 25 | CIF Shanghai, LME warehouse delivery | 2025-12-26 | 2025-11-21 08:31:20.653 / same |
| `74d76314-5f42-4097-aa8e-68fdaae2ff4e` | 500 | FOB Kansas City, rail or truck loading | 2026-01-20 | 2025-11-21 08:31:20.856 / same |
| `24388766-71fd-4ab5-add6-7fd582456a67` | 1,000 | CIF destination, containerized shipment | 2026-01-02 | 2025-11-21 08:31:21.049 / same |
| `235f1eda-deac-4c08-b8c6-f1052511e2e5` | 20 | FOB Buenaventura Port, GrainPro bags | 2025-12-16 | 2025-11-21 08:31:21.244 / same |

Payment terms are present as free-form commercial text for all nine rows. They
were not used to infer lifecycle or contract authority.

## Inventory safety result

- Offer rows before and after inventory: 9
- Legacy offer hash before and after inventory:
  `b9492303d4d3bb157941fd3ed609438761eb85396e83861af4cfb5f77664c2fc`
- Legacy user hash before and after inventory:
  `3369cf18c0fb7ffa5881cdd4a6c25c2da11ef489c46e7b9e52f5d28f41288bbc`
- Fingerprint before and after:
  `e79139302ae53b2dafb58a2eaf54ab47873df4a15dd3c0026ea0024d424da659`
- Sessions before and after: 0
- Public marketplace: HTTP 200, zero published offers
- Database or repository write during inventory: none
