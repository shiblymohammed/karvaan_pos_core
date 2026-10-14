import { authorizedFetch } from './authFetch';

export class InventoryBackendError extends Error {}

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
