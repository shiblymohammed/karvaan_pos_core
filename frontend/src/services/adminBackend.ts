import { authorizedFetch } from './authFetch';
import { InventoryBackendError } from './inventoryBackend';

export async function verifyAdminBackend() {
  const response = await authorizedFetch('/billing/admin-config', { signal: AbortSignal.timeout(5000) });
  if ([404, 401, 403].includes(response.status)) throw new InventoryBackendError(response.status === 404 ? 'Backend update required: rebuild the VPS backend before retrying this saved admin edit.' : 'This server session cannot access admin data. Sign in with the original administrator account before retrying.');
  if (!response.ok) throw new Error(`Admin server is unavailable (HTTP ${response.status}). Your edit remains saved.`);
  let snapshot: any;
  try { snapshot = await response.json(); } catch { throw new InventoryBackendError('The admin URL returned a page instead of data. Check the VPS backend/proxy configuration.'); }
  if (!Number.isInteger(snapshot.staffRevision) || !Number.isInteger(snapshot.recipeRevision)) throw new InventoryBackendError('The frontend and backend need to be updated together before sending admin edits.');
}
