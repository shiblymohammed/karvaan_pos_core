// Android terminals connect to the authenticated NestJS server on the cashier PC.
// The former tablet-master prototype did not persist or authenticate actions.
export function getMasterServerUrl(): string { return ''; }
export async function startAndroidMasterServer(): Promise<void> {
  throw new Error('Tablet server mode is unavailable. Choose Tablet Client and connect to the restaurant backend.');
}
export async function stopAndroidMasterServer(): Promise<void> {}