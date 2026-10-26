# Workflow upgrade and rollout

Updated 15 October 2026. Changes are local; the VPS has not been redeployed.

## Before updating

1. Pause new transactions, reconcile pending writes, and take an independent database/media backup. Verify it can be read. If the old image lacks SQLite, take a stopped-volume backup before rebuilding; the new backup script requires the new image.
2. Preserve VPS changes to scripts/deploy-cloud.sh and scripts/backup-cloud.sh before pulling. Review their customizations against the updates. Preserve production .env, private JWT secret, credentials, and persistent volumes.
3. Review old demo accounts and rotate or disable their credentials. Reconcile older delivery debts against real invoices; preserve legitimate customer balances.
4. Use one backend for all active restaurant terminals. Timestamp synchronization cannot safely merge independent financial operations on both a local database and its cloud replica.

## Deploy

The public VPS at wq8ss.aiccloud.online was checked on 15 October 2026. Health and Socket.IO polling responded successfully, while /billing/inventory, /billing/menu, and /billing/ledger returned 404. This confirms that the checked live backend did not expose the new APIs. Update the backend source and rebuild/recreate its container; refreshing the frontend alone cannot provide those routes.

For Docker Compose over SSH, run the following in the VPS repository directory after pushing the intended source changes. Stop if backup or pull fails:

```sh
bash scripts/backup-cloud.sh
git pull --ff-only
grep -n 'receive_inventory_purchase' backend/src/kds/kds.gateway.ts
docker compose build --no-cache backend frontend
docker compose up -d --force-recreate --wait --wait-timeout 180
curl -i https://wq8ss.aiccloud.online/billing/inventory
```

The source check must find the PO handler. The final unauthenticated request should return 401 (authentication required), rather than 404 (route absent). If it remains 404, inspect docker compose ps and docker compose logs --tail=80 backend and confirm this deployment serves that domain. Once updated, retry the original saved purchases; do not re-enter them while awaiting confirmation.

1. Transfer source and lockfile changes through the normal Git workflow. Rebuild both containers from the repository root:

   ```sh
   docker compose up -d --build
   ```

   Keep the existing data volume. Schema changes requiring data-loss consent stop startup; investigate them using the backup instead of adding --accept-data-loss.
2. Check health, login, and category/menu image upload through the frontend URL. Upload must return JSON, and the image must still display after reloading.
3. Refresh every browser/PWA terminal together. Rebuild/install the Windows app if used. Backend requires Node 22.12 or newer; the Windows sidecar is Node 22.23.3. Older clients that replace entire inventory/delivery/parked lists must be upgraded.
4. Configure receipt name, address, and GST details in settings. Save receipt/kitchen printer selection on each terminal. With a VPS, use the Windows bridge for local LAN/serial printers or the device's print dialog.
5. Run bash scripts/backup-cloud.sh after the new backend is healthy. Keep an off-server copy and test restoration in an isolated instance.

## Local upgrades and recovery

Local startup uses %APPDATA%\KarvaanPOS\dev.db and creates before-upgrade-*.db beside it before applying a changed schema. The checksum is saved only after success. Failed upgrades stop startup and identify the restore point.

Exit all backend processes before restoring. Preserve the current database and WAL/SHM files, restore the checked snapshot, and restart the matching previous application version. Build installers from a clean template with private credentials; never bundle a live restaurant database.

## Financial behavior

Menu deletion now archives the product separately from its temporary 86'd availability flag. Deleted items disappear from the menu and reconnect snapshots while invoices, recipes used by saved returns, and already-sent orders keep their references. Old deleted items that previously returned as 86'd must be deleted once after this upgrade; legitimate temporarily unavailable items are not automatically removed. An archived ID cannot be revived by stale menu/replica data; add a new item if the product should return to the menu. Verify menuArchiving: 1 in the backend health capabilities after deploying this additive schema update.

- Dispatch consumes ingredients once. COD stays payment pending until the server creates its sale; prepaid dispatch creates the sale immediately. Kitchen readiness updates the delivery board. Riders can claim ready unassigned orders, and only the assigned rider or a cashier can collect.
- Rider remittance includes archived deliveries and actual cash/UPI/card splits. A cashier or manager must physically receive the displayed cash before confirming. Changed collection IDs or totals require reloading. Remittance records cash custody, not new sales.
- Credit repayments record the selected method and reduce the original debt. Reports separate repayments from sales.
- Returns use saved billed lines and remaining quantities, including proportional tax, discount, and charges. Choose RESTOCK only for recoverable ingredients; use WASTE for cooked/unusable food. The POS records the destination but does not execute UPI/card transfers.
- Paid deliveries require a complete refund before cancellation. Cancelled unpaid deliveries retain stock consumed at dispatch; cancellation does not automatically recover prepared food. Document disposal through the waste workflow as needed.

## Older data and failed actions

- Older device ledger entries remain in a review section. Compare them with invoices and repayments before migration or collection. No guessed migration runs automatically.
- Bills without saved snapshots require manual reviewed returns. Deliveries without known collectors are flagged for manual cash reconciliation.
- Failed bills can open the latest kitchen order in POS. Review all lines, totals, and payment allocation, then confirm using the original bill number. Independent queued actions continue while related actions wait.
- Expired refund authorization can be renewed in the pending-actions panel. The manager enters a PIN online; only a scoped token is queued.
- Older sync_inventory entries are automatically preserved as recovery records under their original account and excluded from active sync. Expand Review older stock updates in the pending panel. Use Reload Server Stock in Inventory & Recipes, compare saved values, remove only reconciled records, and re-enter actual purchases missing from the server. Invalid/null quantities cannot establish how much was purchased.
- PO intake now records quantity, purchase conversion, invoice total, supplier, and cashier on the server. A 2 kg delivery of an ingredient stocked in grams with a ₹120 invoice adds 2,000 g at ₹0.06/g. Older gram/ml rows use kg/l defaults; unknown packaging uses individual pieces unless a valid saved conversion exists. Verify pack sizes before intake.
- Force Sync only reports confirmed actions as successful. Pending and rejected actions remain visible and retain their identities.
- Lost acknowledgment can mean an action already committed. Retry its original identity or check history before removing it. Legacy unowned IndexedDB actions require manual recovery and never replay under another login.

## Staging acceptance

After deploying the latest source, verify `/health` includes `capabilities.inventoryPurchases: 1` and `capabilities.versionedAdminConfig: 1`. A healthy response without those markers does not confirm this backend update. Updating a desktop client requires rebuilding/installing the Windows app; updating the VPS frontend alone does not replace an installed app. Inventory and admin commands check API compatibility before sending, and connection/acknowledgment failures remain visible without losing action identities.

Before live service, exercise counter checkout, another waiter's added items, stale-checkout review, COD/prepaid delivery, split collection/remittance, partial credit repayment, partial/remaining refunds, PO intake and reload, rejected Force Sync actions, disconnection/reconnection, receipt reprint, and backup restoration. Check invoice count, stock, balances, and sales/collection totals. CI includes a container/proxy/restore smoke test; it has not run remotely from this checkout.

## Multi-device and browser-tab update

All devices for a restaurant must use the same operational backend and updated application version. Independent local/cloud databases still use timestamp replication and are not safe for simultaneous operational writes.

- Cached stores now include backend, restaurant, account, and terminal in their namespace. New caches are rebuilt from server snapshots. Older ambiguous keys remain intact; they are never guessed to belong to the selected backend/account.
- Fresh admin stores have an unknown revision until a server snapshot is loaded. They cannot publish a demo/empty list as version zero and erase existing server data. Fresh staff stores do not contain demo credentials.
- Active carts use tab-local session storage, so two open tabs cannot overwrite each other's cart. Separate local recovery copies survive a closed tab. Review saved local drafts opens a copy only into an empty cart, after confirming its restaurant/account and checking current order/bill history. Originals remain saved. Older held orders and other ambiguous cached data remain in their original storage records for manual recovery.
- Account, lock, and connection changes in another tab stop the old tab and require a reload. HTTP and socket responses from the old session cannot update the new account's stores.
- IndexedDB queue processing uses a renewable lease per backend/restaurant/account. Another tab cannot send while that lease is active. If a suspended/crashed tab loses its lease, a new tab retries the same action identity, and the old sender stops before sending another action. Server receipts still prevent duplicate purchases or invoices after lost acknowledgments.
- Staff, recipe, and settings saves include the server version they were edited against. A competing outdated save is rejected and preserved in the confirmation panel. Reload current server data, compare Saved edit for comparison, then remove reconciled actions and re-enter only missing edits. Retry does not silently advance the version or overwrite another manager's work. Removing a stock item also changes the recipe version.
- Settings autosave is durable and versioned. A remote broadcast cannot cancel an edit during its debounce window; a scoped draft remains available for comparison. Earlier confirmations cannot replace newer queued edits.
- Older unversioned staff/recipe snapshots remain saved separately for review and are not replayed. If an older tab blocks the IndexedDB schema update, close older Karvaan tabs and reload; do not clear site data or delete pending actions.

Deploy backend and frontend together with the Compose commands above, then close older tabs and reopen/refresh every browser/PWA. Rebuild/install each Windows client. On two devices, edit the same settings/recipe/staff entry from the same starting version; one save must succeed and the other must report a reviewable conflict. With two tabs, queue one purchase offline and reconnect both; stock must increase once. Switch accounts in one tab and verify the other shows the reload message while retaining its original draft and queue.

## Stock approval and workflow follow-up

This source now requires manager approval before checkout or delivery dispatch can consume more recorded ingredients than are available. Configure an active administrator/manager PIN in Staff first. At a shortage prompt, review required/available quantities and enter the manager PIN and a reason. Approval is scoped to the original sale, quantities, and shortage and expires after 15 minutes. A larger shortage or deactivated manager requires fresh approval. Pending actions offer the same approval workflow; retry the original sale rather than creating a replacement invoice.

Approvals and their reasons appear under Inventory & Recipes, Waste tab. Correct stock counts or record genuinely missing purchases after reviewing the exception. Previous committed invoices are not changed automatically. Normal sales with sufficient stock require no override.

Waste now saves its stock movement, operator, and historical cost in one transaction. Recipe waste allowances and preparation metadata persist and are included consistently in cost and consumption. These additions require the updated database schema and rebuilt clients. Check `/health` for `inventoryWaste: 1` and `stockShortageApproval: 1`. Older waste/delivery snapshots remain recovery records and do not replay.

See [UX_WORKFLOW_REVIEW.md](UX_WORKFLOW_REVIEW.md) for the confirmed UI fixes and remaining combo, guest QR, forecasting, packaging, tooling, and installation work. The automated suites now contain 110 POS tests and 12 local print-worker tests; real restaurant acceptance remains required.

## Browser printing with the VPS

See [PRINTING_WORKFLOW.md](PRINTING_WORKFLOW.md) for the paired local worker, Windows installation, durable queue, paper-review recovery, and staging checks. Backend and frontend must be updated together. `/health` now advertises `durablePrinting: 1`. Automatic printing is off until destinations are assigned and tested. The frontend Docker build context is the repository root; use the updated Docker Compose file.
