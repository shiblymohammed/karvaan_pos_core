import { useAuthStore } from './useAuthStore';
import { useSettingsStore } from './useSettingsStore';
import { useTableStore } from './useTableStore';
import { useAddonStore } from './useAddonStore';

let initialized = false;
let enabled = false;
export function suspendCatalogConfig() { enabled = false; }
export function initializeCatalogConfig() {
  enabled = false;
  const settings = useSettingsStore.getState();
  useAddonStore.setState({ addons: settings.paidAddons || useAddonStore.getInitialState().addons });
  if (settings.floorConfig) useTableStore.setState({ floors: settings.floorConfig });
  enabled = true;
  if (initialized) return;
  initialized = true;
  useAddonStore.subscribe(state => {
    if (!enabled) return;
    if (!['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(useAuthStore.getState().currentUser?.role)) return;
    if (JSON.stringify(state.addons) !== JSON.stringify(useSettingsStore.getState().paidAddons)) useSettingsStore.setState({ paidAddons: state.addons });
  });
  useTableStore.subscribe(state => {
    if (!enabled) return;
    if (!['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(useAuthStore.getState().currentUser?.role)) return;
    const tables = state.tables.map(({ id, number, capacity, floorId }) => ({ id, number, capacity, floorId }));
    if (JSON.stringify(state.floors) !== JSON.stringify(useSettingsStore.getState().floorConfig) || JSON.stringify(tables) !== JSON.stringify(useSettingsStore.getState().tableConfig)) {
      useSettingsStore.setState({ floorConfig: state.floors, tableConfig: tables });
    }
  });
}
