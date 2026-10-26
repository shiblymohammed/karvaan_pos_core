# Browser POS printing with a VPS

Implemented locally on 15 October 2026. This does not deploy the VPS or install a background task on the restaurant computer.

## Components and boundaries

- `backend/src/printer/print-queue.service.ts` owns restaurant pairing, versioned destinations, durable jobs, claims, recovery, and receipt copies. Order/payment transactions create jobs in the same database commit. A disconnected printer does not reverse a saved sale.
- `backend/src/printer/print-document.ts` renders immutable document snapshots to ESC/POS. Reprints use saved invoice values and preserve the original queued document when available. Item prices already include add-ons. Modifiers/instructions wrap; pre-bills and unpaid dispatch notes are explicit.
- `print-agent/` is a dependency-free Node worker. It connects outward over HTTPS, sends raw data to private IPv4 LAN printers or an installed local Windows printer queue, and records attempted jobs locally. No router port forwarding is required.
- The browser provides one **Send to Kitchen** action, a Printing status panel, acknowledged setup, paper review/reprint controls, and receipt copies from Order History. A device's browser print dialog remains an explicit manual fallback.

There is one shared receipt destination and one shared kitchen destination per restaurant. They may use the same or different agents. Automatic printing is off until an administrator enables it. It applies to future accepted transactions, including browser-queued orders accepted later; enabling it does not replay older orders. Existing jobs retain their original destination even when assignments change. Cancel obsolete waiting jobs explicitly before changing computers or printers.

## Delivery and duplicate handling

`QUEUED -> CLAIMED -> SENDING -> SENT / FAILED / UNCERTAIN`

- Claims expire after 60 seconds if delivery has not started; those jobs can return to the waiting queue. Only one job is in flight per agent.
- The worker durably records intent, then requires the server to acknowledge `SENDING` before writing any printer bytes. A lost start acknowledgment never causes a speculative send.
- Once sending starts, an expired 120-second lease becomes `UNCERTAIN`. No automatic physical resend occurs. A confirmed result can arrive later for the same claim.
- A dropped result acknowledgment retries only the result. A service restart during delivery requires paper review. Confirmed attempts are kept in small individual local records so an older VPS backup cannot silently reprint the same job ID.
- Stable request IDs deduplicate automatic jobs, manual originals, pre-bills, and recovery requests. Active receipt copies and active recovery children block additional copies from another browser.
- A recovery creates a new marked copy after the operator checks paper and the Windows queue and enters a reason. If no copy is needed, the operator can record the paper check and clear the alert without printing. It does not resubmit the order or payment. The parent review and requesting user are retained.
- `SENT` confirms transport/spooler acceptance, **not physical paper output**. ESC/POS TCP and Windows spooling cannot guarantee exactly one physical page after every crash or paper fault. Uncertain outcomes require an operator's decision.

Kitchen appends queue only their new batch. Checkout queues only quantities not already persisted as kitchen items, comparing product, add-ons, and cooking notes. COD dispatch prints an unpaid dispatch note; collection later creates a paid receipt. Settling food already sent to the kitchen does not print the whole meal again.

## Deploy and connect

1. Back up the VPS database/media first. Deploy backend and frontend together using the repository's Docker Compose configuration. Keep named volumes. Startup must apply the additive `PrintAgent`, `PrintDestination`, and `PrintJob` schema changes; never use a destructive schema reset.
2. Confirm `/health` advertises `durablePrinting: 1`. Refresh PWA/browser clients; rebuild installed app clients that use the changed kitchen screen.
3. Open **Admin -> Label & Printers**. Download the Windows printing ZIP and extract every file. Install Node.js 22.12+ and the printer's driver; verify a Windows test page.
4. Create a pairing code. Run the included `install-windows.ps1` as the Windows user who will remain signed in; enter the HTTPS backend URL and code. See `SETUP.txt` for exact commands. Codes expire after ten minutes and are single-use. Credentials are hashed on the VPS and stored in a restricted local user profile.
5. The installer starts a hidden **Karvaan Local Printing** scheduled task at that user's sign-in. It does not install a machine-wide Windows service. Keep the computer on and that user signed in. Locking the screen is supported; signing out stops printing until sign-in.
6. Assign receipt/kitchen printers with automatic printing off. For USB, choose the exact installed Windows queue name. For LAN, reserve a private IPv4 address and normally use port 9100. Save, test, inspect the actual paper, then enable automatic printing.

The ZIP is generated from source during frontend `predev`/`prebuild`; it contains no credentials or journal. Docker Compose's frontend build context is now the repository root, with `frontend/Dockerfile`. To build it directly use `docker build -f frontend/Dockerfile .` from the repository root. The root `.dockerignore` allows only frontend/agent build inputs and excludes local state, environments, dependencies, and generated outputs. Backend's existing build context is unchanged.

## Acceptance before restaurant use

- Two browser devices: one sale, one invoice, one original receipt; an acknowledged repeated request must not print again.
- Kitchen: new batch, add-ons, long cooking instructions, append, checkout, delivery dispatch/collection; no repeated full kitchen ticket.
- Both paper widths, actual UTF-8 character support, cut command, USB spooler and LAN targets used at the restaurant. Printers differ: use browser/driver output for unsupported scripts until a tested character/raster profile is available.
- Unplug a printer before delivery, disconnect internet during a job, stop the agent mid-delivery, and restart both services. Check waiting/failed/uncertain states and marked recovery copies.
- Change a printer assignment from two browsers: the stale edit must be rejected and its draft retained. Revoke the old computer: waiting jobs cancel, active sends require paper review, and old credentials stop working.
- Restart the Windows computer, sign in, and confirm the hidden task reconnects. Confirm the service's logs and printer queue are accessible to the operator.

## Operations, restore, and limits

Local state is under `%LOCALAPPDATA%\KarvaanPrint`: private credentials, a small unresolved-delivery journal, individual attempted-job records, and logs. Do not delete or copy that profile to another active computer. Updates should reuse the same user/profile. Pair a second computer separately. Agent delivery is serialized; a failing connection can delay its next job until that connection's bounded timeout.

Before restoring a VPS backup, stop local workers. Review old jobs, disable automatic printing, and reconcile paper/Windows queues before restarting them. Preserve local attempt history. A new computer without that history cannot detect jobs printed before the backup; do not replay restored pending jobs blindly. Single-restaurant physical backups contain the print tables. Tenant JSON backups include tenant-scoped job/destination audit data and agent identity metadata, omitting token/pairing hashes; pair new credentials when rebuilding from JSON. Print jobs and credentials are deliberately not part of business-data replication between independent servers.

Internet is required to receive VPS jobs. Orders saved only in a browser create print jobs after server acceptance. This is not a local financial server or offline printing replication system. Barcode/label station routing, automatic cash-drawer control, Linux auto-start installation, per-item multi-kitchen routing, and raster fonts are outside this version. The existing advanced native/manual connections remain available.

Verification includes isolated database/HTTP/browser-storage tests, worker crash/acknowledgment/restore tests, backend compilation, frontend type checking and production PWA build, PowerShell syntax parsing, ZIP extraction/content verification, and a browser check of setup, F2 pre-bill and the single kitchen-send flow. Real paper output, Windows scheduled-task installation, Docker runtime and live VPS deployment still need restaurant acceptance.

Automated verification: 110 POS regression tests and 12 local worker tests.
