# Karvaan POS: Client Deployment Guide

This document outlines the exact steps required to deploy the Karvaan POS system from scratch onto a new client's Windows Cashier PC.

## Requirements (The USB Drive)
Before leaving for the client's restaurant, ensure your USB drive contains:
1. **`backend/`** folder (Contains all backend code, Prisma schema, and `package.json`).
2. **`scripts/`** folder (Contains `deploy-backend.bat` and `setup-firewall.ps1`).
3. **`KarvaanPOS_1.0.0_x64-setup.exe`** (The Tauri Desktop App Installer).
4. **`node-v20.x.x-x64.msi`** (Download the latest LTS version from nodejs.org).
5. *(Optional)* **`app-debug.apk`** (For Waiter/Rider Android phones).

---

## Step 1: Prepare the Client's Cashier PC
1. Plug in your USB drive.
2. Install **Node.js** using the `.msi` file. Keep all default settings (Next -> Next -> Finish).
3. Create a dedicated folder on the client's `C:\` drive (e.g., `C:\KarvaanPOS`).
4. Copy the `backend/` and `scripts/` folders from your USB drive into `C:\KarvaanPOS\`.

---

## Step 2: Configure the Network & Backend
The backend needs to run continuously in the background and be accessible to Waiter tablets over the local Wi-Fi.

1. Navigate to `C:\KarvaanPOS\scripts\`.
2. Right-click **`setup-firewall.ps1`** -> Select **"Run with PowerShell"**. Click Yes if prompted by Admin privileges. (This opens Port 3001).
3. Double-click **`deploy-backend.bat`**. 
   - A terminal will open and install all NPM dependencies.
   - It will generate the Prisma SQLite database.
   - It will install PM2 globally and start the backend service.
   - It will save the PM2 process list so it survives computer reboots.
   - *(You can close the terminal once it says "PM2 successfully saved")*.

---

## Step 3: Install the Cashier App
1. Copy **`KarvaanPOS_1.0.0_x64-setup.exe`** to the PC.
2. Double-click to install it.
3. Open Karvaan POS from the Desktop shortcut.
4. On the Network Setup screen, choose **"Skip (Use Localhost)"**.
5. Log in with a Cashier or Admin PIN (e.g., `1234` or `9999`).

---

## Step 4: Connect Waiter Phones (Android)
1. Ensure the Android phone is connected to the exact same Wi-Fi network as the Cashier PC.
2. On the Cashier PC, open Command Prompt, type `ipconfig`, and note the **IPv4 Address** (e.g., `192.168.1.100`).
3. Transfer and install **`app-debug.apk`** on the Android phone.
4. Open the app on the phone.
5. In the Network Setup screen, enter: `http://[CASHIER_IP_ADDRESS]:3001`
6. Tap **Test**, then tap **Save & Connect**.
7. Log in with a Waiter PIN.
