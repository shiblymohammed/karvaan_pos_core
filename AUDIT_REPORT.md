# Deployment and workflow audit

Updated 15 October 2026. Repository changes and isolated tests are complete. Public VPS endpoints were checked read-only; authenticated live transactions and restaurant hardware have not been changed or exercised. See [WORKFLOW_UPGRADE.md](WORKFLOW_UPGRADE.md) for rollout and reconciliation instructions.

## Implemented fixes

| Area | Result |
| --- | --- |
| Menu images | Nginx forwards /upload with or without a trailing slash. Images resolve against the selected backend, multipart requests preserve file data, and failures explain proxy, size, or backend errors. Persistent uploads work without Cloudinary. |
| Dependencies | Coordinated NestJS 12.1.3 and Passport 12 upgrade; compatible scheduling/throttling libraries and reproducible lockfile installs. Backend requires Node 22.12 or newer. Windows bundles checksum-verified Node 22.23.3. Removed obsolete ts-node-dev. |
| Cloud deployment | Docker uses Node 22 and npm ci; schema push cannot accept destructive changes automatically. Seed failures stop startup, empty cloud databases require a private administrator password, and health timeouts fail deployment. |
| Delivery accounting | Dispatch saves server-priced lines and consumes recipe stock once. Prepaid dispatch creates the bill immediately; COD collection creates the bill before completion. Rider and restaurant ownership are checked. Client-generated credit debts and synthetic completed parked orders are removed. |
| Rider cash | Collector and actual tender allocation are saved. Archived deliveries retain cash custody. A cashier or manager records remittance against current collection IDs and amount; retries do not duplicate it or increase sales revenue. Older records without a known collector are flagged for review. |
| Customer credit | Credit and split-credit sales create durable server ledger entries. Partial repayments retain the original debt and record payment method, cashier, amount, and action identity. Older device-only entries remain available for review. |
| Returns | Saved invoice lines and previous returns determine available quantities, amounts, and tax reversals. One transaction records refund, customer balance, stock restock/waste, and authorizing manager. Scoped manager grants keep raw PINs out of the offline queue. |
| Multi-terminal work | Per-record parked/delivery commands use revisions; inventory uses idempotent quantity deltas and versioned metadata. Menu revisions protect newer edits. Checkout rejects omitted kitchen items and stale order versions. Kitchen retries cannot rewind a ticket. |
| Offline recovery | Every write is queued before sending. Stable identities survive lost acknowledgments. Failed commands block related bills/tables/stock while independent work continues. Staff can retry, review bills with current kitchen items, renew refund authorization, or remove actions after reviewing server history. |
| Force Sync and PO intake | Force Sync awaits original queue acknowledgments instead of copying/removing actions optimistically. Stock reloads preserve purchase units, conversions, and suppliers. PO receipt is a server transaction with a purchase log; total invoice cost is divided by the full received quantity. Invalid old quantities require review, and repeated toast messages are bounded. |
| Old queue recovery | Legacy inventory snapshots move into owner-scoped recovery records without losing IDs or payloads. They stop replaying and stop counting as pending purchases. Active purchases remain first in the panel. The health response now identifies inventory-command support for deployment verification; 17 frontend recovery/storage tests pass. |
| Live deployment verification | On 15 October 2026 the provided VPS answered health and Socket.IO polling, but its inventory/menu/ledger APIs returned 404. Inventory writes now check API compatibility first and explain old backends, expired sessions, proxy HTML, and acknowledgment failures. All 19 frontend recovery/connectivity tests pass; the live backend still requires rebuilding from updated source. |
| Menu deletion | Deletion uses a separate archive flag from temporary 86'd status. Menu queries, reconnect snapshots, and cached hydration omit archived items. Stale menu and replica data cannot revive their IDs. Invoices and already-sent quantities remain billable, and new archived quantities are rejected. The updated suite passes 60 tests including sold/unused deletion, reconnect, stale replication, and temporary availability. |
| Invoice records | Bills retain immutable line names, charged prices, tax/refund allocations, original recipe quantities, and split tenders. Standalone add-ons resolve through the server catalogue. Reports subtract returns and separate repayments from sales. |
| Printing | Receipt/kitchen profiles persist per server, restaurant, and terminal. Windows sends local TCP printer bytes directly; a VPS cannot scan or print on its LAN for the restaurant. Receipts use configured business identity and show pending confirmation/payment. Browser printing isolates the receipt. |
| Backup and upgrades | Cloud backup creates checked consistent SQLite snapshots and includes uploads. New restaurants receive IST backup schedules immediately. Local schema upgrades create readable restore points and stop on unsafe changes. |
| Pipeline | CI installs both lockfiles, audits production packages, builds both apps, runs regression tests, checks each shell script, builds containers, and checks startup, proxy login, and restored backup integrity. |

## Verification

- All **60 regression tests pass**, including uploads/authentication, restaurant isolation, lost acknowledgments, Force Sync confirmation counts, PO conversion/cost/retry handling, menu deletion and stale replication, stale kitchen carts, menu/parked/inventory conflicts, COD/prepaid billing, split remittance after archiving, credit/refund idempotency, manager grant expiry, report tax reversal, and database upgrade recovery.
- Backend TypeScript build and frontend type check/Vite/PWA production build pass. Frontend output was written to a temporary directory. Vite reports large chunks and mixed static/dynamic imports; performance optimization remains useful.
- Native Windows printer bridge passes cargo check --offline. TCP printing is tested against a local server, not physical hardware.
- Official npm audits: backend production **0**, backend including development **0**, frontend production **0**. Frontend development/build dependencies retain **10** findings: seven high and three moderate. Production-only counts do not cover build tools.
- The older-schema fixture is committed independently of the current Git revision. Saved rows and the pre-upgrade snapshot are read successfully after upgrade.
- Docker's Linux engine is not running on this workstation. Container runtime, the extended CI workflow, a distributable installer, Android installation, physical printers, and simultaneous real terminals still need staging acceptance.

## Remaining operational and design work

| Priority | Work |
| --- | --- |
| P1 | Back up and rebuild the VPS, then refresh all terminals together. Older clients cannot safely overwrite parked/inventory/delivery snapshots and are rejected with a refresh instruction. |
| P1 | Review existing demo credentials, false delivery debts, device-only ledgers, old queued actions, and old delivery collections. No historical balances or credentials were changed automatically. |
| P1 | Older invoices lack immutable snapshots and cannot use automated returns. Reconcile these manually; a schema upgrade cannot recover historical names or original tender splits. |
| P1 | Use one authoritative operational backend. Timestamp-based local/cloud synchronization is not a multi-master financial conflict resolver; simultaneous financial writes to independent databases need a separate replication design. |
| P2 | General settings, staff, and recipe edits still need broader revision checks when multiple managers edit simultaneously. New protections cover orders, parked carts, menu, stock movements, and deliveries. |
| P2 | Upgrade frontend build tooling and validate PWA/Android builds together. Optimize large bundles separately. |
| P2 | Provision installers from a clean database template with private credentials. Automatic local schema upgrades are implemented; universally distributable first-run account provisioning remains separate work. |
| P2 | Guest QR ordering needs customer/table sessions and acknowledged staff notifications before public rollout. |
| P2 | Run a complete restaurant restore/hardware drill and retain an off-server backup. POS refund/repayment records do not execute bank or UPI transfers. |

The initial audit was performed on 14 October 2026; this report supersedes its unresolved dependency and financial workflow findings. The Node minimum follows official [NestJS migration guidance](https://docs.nestjs.com/migration-guide).
