// Centralised mapping between ScreenType IDs and URL paths.
// This is the single source of truth for navigation — update here to change all routes.

export type ScreenType =
  | 'POS' | 'TABLES' | 'KDS' | 'INVENTORY' | 'QR' | 'ADMIN'
  | 'PARCEL' | 'DELIVERY' | 'DASHBOARD' | 'SETTINGS' | 'QUEUE' | 'CUSTOMERS';

export const SCREEN_PATHS: Record<ScreenType, string> = {
  POS: '/app/pos',
  TABLES: '/app/tables',
  KDS: '/app/kds',
  QUEUE: '/app/queue',
  PARCEL: '/app/parcel',
  DELIVERY: '/app/delivery',
  QR: '/app/qr',
  DASHBOARD: '/app/dashboard',
  CUSTOMERS: '/app/customers',
  INVENTORY: '/app/admin',
  ADMIN: '/app/admin',
  SETTINGS: '/app/admin', // alias
};

/** Returns the ScreenType for the given pathname, or null if not matched. */
export function screenFromPath(pathname: string): ScreenType | null {
  const entry = (Object.entries(SCREEN_PATHS) as [ScreenType, string][])
    .find(([, path]) => path === pathname);
  return entry ? entry[0] : null;
}
