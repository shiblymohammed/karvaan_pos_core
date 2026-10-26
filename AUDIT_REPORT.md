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
| Device and tab isolation | Store caches are scoped to backend, restaurant, account, and terminal. Each tab has its own active cart and recovery copy. Shared queue leases prevent duplicate tab processing; account changes stop the old tab, and old HTTP/socket responses are ignored. |
| Admin conflicts | Staff, recipes, and settings use server revisions and durable action receipts. Stale edits remain available for comparison; earlier confirmations cannot overwrite newer queued edits. Legacy unversioned edits are quarantined without deleting their payloads. |
| Offline recovery | Every write is queued before sending. Stable identities survive lost acknowledgments. Failed commands block related bills/tables/stock while independent work continues. Staff can retry, review bills with current kitchen items, renew refund authorization, or remove actions after reviewing server history. |
| Force Sync and PO intake | Force Sync awaits original queue acknowledgments instead of copying/removing actions optimistically. Stock reloads preserve purchase units, conversions, and suppliers. PO receipt is a server transaction with a purchase log; total invoice cost is divided by the full received quantity. Invalid old quantities require review, and repeated toast messages are bounded. |
| Old queue recovery | Legacy inventory and unversioned admin snapshots move into owner-scoped recovery records without losing IDs or payloads. They stop replaying. Active purchases remain first in the panel. Health capabilities identify inventory and versioned admin support for deployment verification. |
| Live deployment verification | The initial read-only VPS check found missing inventory/menu/ledger APIs. The user subsequently reported healthy rebuilt containers and a protected API returning 401. This multi-device follow-up remains local and needs deployment. Commands explain old backends, expired sessions, proxy HTML, and acknowledgment failures. |
| Menu deletion | Deletion uses a separate archive flag from temporary 86'd status. Menu queries, reconnect snapshots, and cached hydration omit archived items. Stale menu and replica data cannot revive their IDs. Invoices and already-sent quantities remain billable, and new archived quantities are rejected. |
| Invoice records | Bills retain immutable line names, charged prices, tax/refund allocations, original recipe quantities, and split tenders. Standalone add-ons resolve through the server catalogue. Reports subtract returns and separate repayments from sales. |
| Printing | The VPS creates durable jobs alongside saved orders/payments. A paired local worker sends them to LAN or Windows USB queues. Claims, delivery journals, attempted-job history, marked reprints and versioned printer assignments handle recovery. Browser printing remains a manual fallback. See [PRINTING_WORKFLOW.md](PRINTING_WORKFLOW.md). |
| Backup and upgrades | Cloud backup creates checked consistent SQLite snapshots and includes uploads. New restaurants receive IST backup schedules immediately. Local schema upgrades create readable restore points and stop on unsafe changes. |
| Pipeline | CI installs both lockfiles, audits production packages, builds both apps, runs regression tests, checks each shell script, builds containers, and checks startup, proxy login, and restored backup integrity. |

## Verification

- The suite includes **110 POS regression tests plus 12 local print-worker tests**, with real IndexedDB transaction semantics through fake-indexeddb. Coverage now also includes scoped manager stock approvals, atomic waste, recipe allowances, cart preservation/metadata, parked-board versions, confirmed kitchen states, HTTP-client UUIDs, and business-day boundaries. See [UX_WORKFLOW_REVIEW.md](UX_WORKFLOW_REVIEW.md) for fixed UX problems and remaining feature gaps.
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
| P1 | Deploy the versioned admin/cache update together, close older tabs, and verify simultaneous edits and one-time purchase receipt on real devices. Isolated revision and IndexedDB lease tests pass; live acceptance remains necessary. |
| P2 | Upgrade frontend build tooling and validate PWA/Android builds together. Optimize large bundles separately. |
| P2 | Provision installers from a clean database template with private credentials. Automatic local schema upgrades are implemented; universally distributable first-run account provisioning remains separate work. |
| P2 | Guest QR ordering needs customer/table sessions and acknowledged staff notifications before public rollout. |
| P1 | Combo Studio still needs backend composition persistence and an acknowledged save path. Do not rely on local combo contents for inventory consumption; see the workflow review. |
| P2 | Run a complete restaurant restore/hardware drill and retain an off-server backup. POS refund/repayment records do not execute bank or UPI transfers. |

The initial audit was performed on 14 October 2026; this report supersedes its unresolved dependency and financial workflow findings. The Node minimum follows official [NestJS migration guidance](https://docs.nestjs.com/migration-guide).
