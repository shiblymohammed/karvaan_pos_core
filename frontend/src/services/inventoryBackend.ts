import { authorizedFetch } from './authFetch';

export class InventoryBackendError extends Error {}

export async function verifyWasteBackend() {
  const response = await authorizedFetch('/billing/waste', { signal: AbortSignal.timeout(5000) });
  if (response.status === 404) throw new InventoryBackendError('Backend update required: rebuild the VPS backend before retrying this saved waste entry.');
  if ([401, 403].includes(response.status)) throw new InventoryBackendError('This session cannot access waste records. Sign in with the original manager or kitchen account before retrying.');
  if (!response.ok) throw new Error('Waste records are unavailable. Your entry is still saved.');
  let rows: any;
  try { rows = await response.json(); } catch { throw new InventoryBackendError('The waste URL returned a page instead of data. Check the VPS proxy.'); }
  if (!Array.isArray(rows)) throw new InventoryBackendError('Update frontend and backend together before recording waste.');
}

export async function verifyInventoryBackend() {
  const response = await authorizedFetch('/billing/inventory', { signal: AbortSignal.timeout(5000) });
  if (response.status === 404) throw new InventoryBackendError('Backend update required: this server has no inventory API. Rebuild the VPS backend, then retry this saved purchase.');
  if (response.status === 401) throw new InventoryBackendError('Your server session expired. Sign in again with the original account, then retry this saved stock action.');
  if (response.status === 403) throw new InventoryBackendError('This account cannot access server inventory. Ask a restaurant manager to review its permissions.');
  if (!response.ok) throw new Error(`Inventory server is unavailable (HTTP ${response.status}). This action is still saved on this device.`);
  let rows: unknown;
  try { rows = await response.json(); } catch { throw new InventoryBackendError('The inventory URL returned a page instead of stock data. Check the VPS backend/proxy configuration before retrying.'); }
  if (!Array.isArray(rows)) throw new InventoryBackendError('The server returned incompatible inventory data. Check that the frontend and backend are updated together.');
}
