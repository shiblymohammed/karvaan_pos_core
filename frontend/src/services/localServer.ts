import { getOperatingMode } from './serverConfig';
import { useCartStore } from '../store/cartStore';
import { HttpServer } from '@cantoo/capacitor-http-server';

// @ts-ignore - The plugin uses a global object on window
const WebServer = (window as any).webserver;

let isServerRunning = false;
let masterServerUrl = '';

export function getMasterServerUrl(): string {
  return masterServerUrl;
}

export async function startAndroidMasterServer(): Promise<void> {
  const mode = getOperatingMode();
  if (mode !== 'ANDROID_MASTER') return;

  if (isServerRunning) return;

  // We are in Android Master mode.
  // 1. Keep the screen awake so the server doesn't die.
  try {
    const { KeepAwake } = await import('@capacitor-community/keep-awake');
    await KeepAwake.keepAwake();
    console.log('[Android Master] KeepAwake activated.');
    
    console.log('[Android Master] Starting local web server on port 8080...');
    
    // Remove old listeners to prevent duplicates if restarting
    await HttpServer.removeAllListeners();

    HttpServer.addListener('request', async (request) => {
      const path = request.path;
      const method = request.method;

      // Handle CORS Preflight
      if (method === 'OPTIONS') {
        await HttpServer.respond({
          requestId: request.requestId,
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        });
        return;
      }

      // 1. Sync State (Polling)
      if (path === '/api/sync' && method === 'GET') {
        const state = {
          tableStatuses: {}, // simplified for now, would map useTableStore
          kdsTickets: [],
          parkedOrders: [],
          deliveryOrders: [],
          staffMembers: [],
          inventoryStock: [],
          recipes: [],
          wasteLogs: [],
        };
        
        await HttpServer.respond({
          requestId: request.requestId,
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          bodyText: JSON.stringify({ success: true, data: state })
        });
        return;
      }

      // 2. Handle Actions (emitAction from Waiter Client)
      if (path === '/api/action' && method === 'POST') {
        try {
          const bodyStr = request.bodyText || '{}';
          const body = JSON.parse(bodyStr);
          console.log(`[Master] Received action from client:`, body.type);
          
          await HttpServer.respond({
            requestId: request.requestId,
            status: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            bodyText: JSON.stringify({ success: true })
          });
        } catch (e) {
          await HttpServer.respond({
            requestId: request.requestId,
            status: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
            bodyText: JSON.stringify({ success: false, error: 'Invalid JSON' })
          });
        }
        return;
      }

      // Health check endpoint
      if (path === '/health') {
        await HttpServer.respond({
          requestId: request.requestId,
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          bodyText: JSON.stringify({ ok: true, status: 'ANDROID_MASTER_ACTIVE' })
        });
        return;
      }

      // Default 404
      await HttpServer.respond({
        requestId: request.requestId,
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        bodyText: 'Not Found'
      });
    });

    const result = await HttpServer.start({ 
      port: 8080,
      android: {
        notificationTitle: 'Karvaan Server',
        notificationText: 'Tablet is running as the local server.',
        channelId: 'karvaan-server',
        channelName: 'Server Status'
      }
    });

    isServerRunning = true;
    masterServerUrl = result.url || `http://${result.localIp}:8080`;
    console.log(`[Android Master] Local web server started on ${masterServerUrl}`);
    
  } catch (err) {
    console.error('[Android Master] Failed to start local web server', err);
  }
}

export async function stopAndroidMasterServer(): Promise<void> {
  if (!isServerRunning) return;
  try {
    await HttpServer.stop();
    isServerRunning = false;
    console.log('[Android Master] Local web server stopped.');
  } catch (err) {
    console.error('[Android Master] Error stopping local web server', err);
  }
}
