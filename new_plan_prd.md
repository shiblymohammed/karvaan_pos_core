# Karvaan POS — Next Phase PRD
## Architecture, Deployment & Offline Strategy

> **Document Purpose**: Captures all architectural decisions and open problems discussed regarding
> offline resilience, cross-device sync, desktop packaging (Tauri), mobile (Capacitor), VPS cloud
> hosting, and LAN-based local server operation. Use this as the north-star reference before
> implementing any infrastructure changes.

---

## 1. Problem Statement

The current Karvaan POS stores all operational state (orders, bills, staff, inventory) in browser
`localStorage` via Zustand persist middleware. This creates a class of serious risks for a
commercial restaurant deployment:

| Risk | Impact | Frequency |
|---|---|---|
| Browser cache cleared | All data wiped | Medium |
| Server restart mid-shift | Active orders lost | High |
| localStorage quota (5MB) exceeded | Silent data loss after 2+ years | Certain |
| Internet outage with VPS backend | POS halts completely | Medium-High |
| Staff accidentally close terminal | Session lost | High |
| No native printer support | Manual print workarounds | Daily |

We have already addressed the localStorage quota problem with Prisma + SQLite backend persistence.
The remaining problems are addressed by this plan.

---

## 2. Deployment Scenarios

Three distinct deployment topologies are planned, in order of implementation priority:

### 2A. Single-PC Local (Phase 1 — Current)

```
Restaurant PC (Windows)
├── Vite Frontend (browser on same machine)
└── NestJS Backend (localhost:3001) + SQLite
```

- All operations run on one machine
- No internet required for any billing function
- Backups written to local ./backups directory
- Already functional with current codebase

---

### 2B. LAN Multi-Terminal (Phase 2 — Before First Installation)

```
                  Restaurant Wi-Fi Router
                         |
        ┌────────────────┼─────────────────┐
        ▼                ▼                 ▼
Cashier PC (Windows)   Waiter Phone     Kitchen Tablet
NestJS + SQLite        Android .apk     Android .apk
192.168.1.100:3001     └─────────────────┘
      ▲                  all connect to cashier PC
      └── Source of truth for the entire shift
```

How it works:
- The Cashier PC is the local server for the entire restaurant network
- All tablets, phones, and KDS screens connect to 192.168.1.100:3001 (the PC local IP)
- When internet is available, NestJS syncs records to VPS in the background
- When internet is down, the entire restaurant operates normally on local Wi-Fi

PROBLEM: Current code hardcodes localhost:3001 — phones cannot reach this.
SOLUTION: Make BACKEND_URL configurable via setup screen or env variable.

Required changes for LAN multi-terminal:

| Task | Description | Effort |
|---|---|---|
| Configurable BACKEND_URL | Read from env or setup screen, not hardcoded | 30 min |
| First-launch Setup Screen | Input field for server IP, saved to localStorage | 1 hour |
| QR Code Device Setup | Cashier PC shows QR with local IP; phones scan once | 1 hour |
| Windows Firewall Rule | Open port 3001 for inbound local network traffic | 5 min |
| PM2 Process Manager | Auto-restarts NestJS on crash; starts on Windows boot | 30 min |
| mDNS Auto-discovery | Devices find server as karvaan-pos.local (optional) | 2 hours |

---

### 2C. VPS Cloud + Local LAN Hybrid (Phase 3 — Multi-Outlet / Remote Access)

```
RESTAURANT LAN                           CLOUD (VPS)
──────────────                           ────────────
Cashier PC NestJS + SQLite  <--sync-->  NestJS + PostgreSQL
                                         |
                                         ├── Owner remote dashboard
                                         ├── Multi-outlet analytics
                                         └── Automated cloud backups
```

Sync behaviour:
- Every bill/KOT/delivery saved to local SQLite instantly (always works)
- Async background sync to VPS when internet is available
- If offline 4 hours → 400 buffered records sync at once on reconnect
- Owner phone shows latest data from VPS at all times

VPS Requirements (single restaurant):

| Resource | Spec | Monthly Cost |
|---|---|---|
| VPS Provider | Hetzner / DigitalOcean / Linode | Rs 500-800/month |
| RAM | 1-2 GB | — |
| Storage | 20 GB SSD | — |
| OS | Ubuntu 22.04 LTS | Free |
| Database | PostgreSQL | Free |
| Process Manager | PM2 | Free |
| Reverse Proxy | Nginx + Let Encrypt SSL | Free |

---

## 3. Offline Mode Architecture

### The Three Offline Scenarios

**Scenario A: Backend server crashes (most common)**
```
NestJS crashes → PM2 auto-restarts in ~5 seconds
Devices show "Reconnecting..." banner
Waiter can still add items to cart (Zustand in memory)
On reconnect → pending actions replay via IndexedDB queue
```

**Scenario B: Internet down, Wi-Fi fine (medium frequency)**
```
ISP outage (minutes to hours)
All devices still connect to Cashier PC on local Wi-Fi ✅
All billing, KOT, KDS, delivery operates normally ✅
VPS sync paused → buffered in local SQLite
On internet return → sync resumes automatically ✅
IMPACT: ZERO. Restaurant does not notice.
```

**Scenario C: Full power cut + router restart (rare)**
```
Everything off → power returns
Router reboots (~60 seconds)
Cashier PC reboots (PM2 starts NestJS on boot)
Devices reconnect to local IP automatically
All state reloaded from SQLite DB ✅
IMPACT: 2-3 minute outage. All historical data intact.
```

### IndexedDB Offline Queue (Required for VPS scenario)

When VPS is unreachable, an offline queue in the browser IndexedDB buffers all events.
IndexedDB can store hundreds of MBs (vs localStorage 5MB limit).

Flow:
  Bill settled → IndexedDB queue (instant, always works)
              → When online → POST to VPS API → PostgreSQL

Implementation plan:
1. Create offlineQueue.ts service using idb library
2. Wrap emitSettleBill, fire_order, sync_delivery_orders calls
3. On reconnect, flush queue in chronological order with duplicate prevention
4. Show "N bills pending sync" badge in admin dashboard

---

## 4. Desktop Application: Tauri (.exe)

### Why Tauri Over Browser

| Feature | Browser | Tauri .exe |
|---|---|---|
| Opens with double-click | No (run 2 terminals) | Yes |
| 100% offline billing | Partial | Yes (embedded SQLite) |
| Thermal receipt printer | Workaround only | Yes (native ESC/POS) |
| Cash drawer trigger | Not possible | Yes (serial port) |
| Staff cannot close accidentally | No | Yes (kiosk mode) |
| Auto-updater | Manual only | Yes (built-in) |
| App size | N/A | ~10-15 MB |
| RAM usage | ~200 MB (Chrome) | ~50 MB |
| Windows Installer (.msi) | No | Yes |

### Tauri Architecture

```
KarvaanPOS.exe (Tauri)
├── WebView (Edge/WebKit) — all existing React screens unchanged
├── Tauri Rust Core
│   ├── tauri-plugin-sql → SQLite from TypeScript
│   ├── tauri-plugin-fs → backups, receipt PDFs
│   ├── Serial port → ESC/POS thermal printer + cash drawer
│   └── tauri-plugin-updater → auto-update from GitHub Releases
└── NestJS for WebSocket multi-terminal sync (unchanged)
```

### What Changes for Tauri

| Change | Impact on Existing Code |
|---|---|
| Add src-tauri/ directory | New files only |
| Replace fetch() with Tauri commands | For direct DB calls only |
| WebSocket still works for multi-terminal | Unchanged |
| All React screens | 100% UNCHANGED |
| All Zustand stores | 100% UNCHANGED |

### Tauri Build Output
```
npm run tauri build
└── KarvaanPOS_1.0.0_x64-setup.exe  (NSIS installer)
└── KarvaanPOS_1.0.0_x64.msi        (MSI installer)
└── KarvaanPOS.exe                  (portable)
```

---

## 5. Mobile Application: Capacitor (.apk)

### Target Use Cases by Role

| Role | Device | App Features |
|---|---|---|
| Waiter | Android phone/tablet | Tables, add items, fire KOT only |
| Delivery Rider | Android phone | Delivery dispatch screen, collect payment |
| Kitchen Staff | Wall-mounted Android tablet | KDS screen only |
| Owner | Any phone (browser PWA) | Remote dashboard via VPS — no install needed |

### Why Capacitor (NOT React Native)

Capacitor wraps the EXACT SAME React code into a native Android .apk:

  React/Vite Code (unchanged)
          |
          ├── Tauri build → Windows .exe
          └── Capacitor build → Android .apk + iOS .ipa

React Native would require rewriting the entire UI from scratch. NOT worth it.

### Capacitor vs PWA

| Feature | PWA | Capacitor .apk |
|---|---|---|
| Works on Android home screen | Yes | Yes |
| Bluetooth thermal printer | No | Yes (pocket printers) |
| NFC payment | No | Yes |
| Push notifications | Limited | Yes |
| Google Play distribution | No | Yes |

### RBAC on Mobile
All existing RBAC already works — role is set at login. No extra work needed:
- Waiter logs in → Table + KOT screens only (already enforced)
- Delivery rider logs in → Delivery screen only (already enforced)

---

## 6. Implementation Roadmap

### Phase 1: Feature Complete (Current Sprint)
- [x] Database persistence (Prisma + SQLite)
- [x] Automated daily backups (3 AM cron)
- [x] Historical order API with pagination
- [x] Bill settlement persistence via WebSocket
- [x] RBAC (Admin, Manager, Cashier, Waiter, Delivery, Kitchen)
- [x] Menu category management (add/edit/delete/reorder)
- [x] Inventory and recipe management
- [x] Customer ledger
- [ ] Split payments
- [ ] Return orders (delivery/parcel/dine-in)
- [x] Reports screen (day-close summary, top items)

### Phase 2: LAN Multi-Terminal (Before First Restaurant Installation)
- [x] Configurable BACKEND_URL (env variable or setup screen)
- [x] First-launch IP configuration screen
- [x] QR code device pairing from cashier PC
- [x] PM2 setup for auto-restart and Windows startup
- [x] Windows Firewall rule script for port 3001
- [ ] Responsive CSS for tablet and phone screen sizes
- [ ] Test: waiter phone → fire KOT → cashier PC KDS screen

### Phase 3: Tauri Desktop App (Before Handoff to Restaurant)
- [x] Add src-tauri/ directory to project
- [x] Configure Tauri window (resize, min 1024x600, production no-devtools)
- [x] Integrate tauri-plugin-sql for embedded SQLite
- [x] Thermal printer support via serial port (ESC/POS commands in Rust)
- [x] Cash drawer trigger via serial kick pulse
- [x] Auto-updater from GitHub Releases (tauri-plugin-updater)
- [x] Build pipeline ready: npm run tauri:build -> .msi + .exe

### Phase 4: VPS Cloud Sync (For Remote Access / Multi-Outlet)
- [ ] Provision VPS (Hetzner / DigitalOcean)
- [ ] Migrate SQLite to PostgreSQL on VPS
- [ ] Configure Nginx + SSL (Let Encrypt)
- [ ] Implement IndexedDB offline queue for bill/order events
- [ ] Background sync service (local SQLite → VPS PostgreSQL)
- [ ] Conflict resolution strategy (timestamp-based last-write-wins)
- [ ] Owner remote dashboard (read-only PWA)

### Phase 5: Capacitor Mobile App (Waiter Tablets / Rider Phones)
- [ ] Add Capacitor to project
- [ ] Android build pipeline setup
- [ ] Waiter view: responsive table + KOT screen
- [ ] Delivery rider view: responsive dispatch screen
- [ ] Bluetooth printer plugin (for rider receipts)
- [ ] Push notifications (Order Ready for Pickup)
- [ ] .apk build and sideload to Android devices

---

## 7. Key Technical Decisions (Confirmed)

| Decision | Choice | Reason |
|---|---|---|
| Local database | SQLite (Prisma) | Zero setup, single file, copy-to-backup |
| Cloud database | PostgreSQL | Better concurrent access for multi-terminal |
| Desktop packaging | Tauri | Native, small footprint, Rust core for printer |
| Mobile packaging | Capacitor | Reuses existing React code, no rewrite |
| Offline queue | IndexedDB (via idb library) | 100s of MB capacity, survives browser restart |
| Process manager | PM2 | Auto-restart on crash, start on Windows boot |
| Multi-terminal sync | WebSocket (NestJS) | Already implemented, real-time |
| Owner remote access | PWA on VPS | No app install needed, works on any phone |

---

## 8. Open Questions (Resolve Before Phase 2)

1. Multi-terminal count: How many simultaneous devices per restaurant?
   - Cashier PC x ?
   - Waiter phones/tablets x ?
   - KDS screens x ?
   - Delivery screen x ?

2. Printer model: Which thermal receipt printer?
   - USB (needs Tauri serial plugin)
   - Network (raw TCP from NestJS)
   - Bluetooth (Capacitor plugin for mobile)

3. Target OS: Windows 10/11 only, or also Linux on the PC?

4. VPS timeline: When is remote owner access needed?

5. First restaurant installation date (sets Phase 2 deadline).



