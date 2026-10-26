import { create } from 'zustand';
import { authorizedFetch } from '../services/authFetch';
import { useAuthStore } from './useAuthStore';
import { getServerUrl } from '../services/serverConfig';
import { emitAction } from '../services/socket';
import { getActionContext, sameContext } from '../services/offlineQueue';
import { assertCurrentSession } from '../services/sessionGuard';
import { applyConfigSnapshot, canEditConfig } from '../services/configSnapshot';

const settingsKey = () => `pos-settings-${encodeURIComponent(useAuthStore.getState().sessionServerUrl || getServerUrl())}-${useAuthStore.getState().currentUser?.restaurantId}`;
const draftKey = () => `${settingsKey()}:draft:${useAuthStore.getState().currentUser?.id}`;

export interface PredefinedNote {
  id: string;
  label: string;
  icon?: string;
}

export interface PredefinedDiscount {
  id: string;
  label: string;
  amount: number;
  type: 'PERCENTAGE' | 'FLAT';
}

interface SettingsState {
  serverRevision: number;
  receiptName?: string;
  receiptAddress?: string;
  receiptGstin?: string;
  paidAddons?: any[];
  floorConfig?: any[];
  tableConfig?: any[];
  notes: PredefinedNote[];
  discounts: PredefinedDiscount[];
  
  addNote: (note: Omit<PredefinedNote, 'id'>) => void;
  deleteNote: (id: string) => void;
  
  addDiscount: (discount: Omit<PredefinedDiscount, 'id'>) => void;
  deleteDiscount: (id: string) => void;

  orderTvEnabled: boolean;
  setOrderTvEnabled: (enabled: boolean) => void;

  orderTvShowPopup: boolean;
  toggleOrderTvPopup: () => void;

  orderTvPlayAudio: boolean;
  orderTvAudioTone: string;
  orderTvCustomAudioData: string | null;
  setOrderTvAudio: (play: boolean, tone: string, customData?: string | null) => void;

  orderTvTickerEnabled: boolean;
  orderTvTickerMessage: string;
  setOrderTvTicker: (enabled: boolean, message: string) => void;

  orderTvConfettiEnabled: boolean;
  setOrderTvConfetti: (enabled: boolean) => void;

  orderTvTtsEnabled: boolean;
  orderTvTtsVoiceName: string;
  setOrderTvTts: (enabled: boolean, voiceName: string) => void;

  orderTvWaterColor: string;
  setOrderTvWaterColor: (color: string) => void;

  orderTvShowDelivery: boolean;
  setOrderTvShowDelivery: (show: boolean) => void;

  orderTvReadyBadgeEnabled: boolean;
  setOrderTvReadyBadge: (enabled: boolean) => void;

  orderTvWaterFillEnabled: boolean;
  setOrderTvWaterFill: (enabled: boolean) => void;

  orderTvTimeWaitingEnabled: boolean;
  setOrderTvTimeWaiting: (enabled: boolean) => void;

  orderTvChaosAnimationEnabled: boolean;
  setOrderTvChaosAnimation: (enabled: boolean) => void;

  orderTvLayoutMode: 'FULL_QUEUE' | 'SPLIT_PROMO';
  setOrderTvLayoutMode: (mode: 'FULL_QUEUE' | 'SPLIT_PROMO') => void;

  orderTvOrientation: 'HORIZONTAL' | 'VERTICAL';
  setOrderTvOrientation: (orientation: 'HORIZONTAL' | 'VERTICAL') => void;

  orderTvSplitRatio: number;
  setOrderTvSplitRatio: (ratio: number) => void;

  orderTvPromoInterval: number;
  setOrderTvPromoInterval: (interval: number) => void;

  orderTvPromoMedia: { id: string; type: 'IMAGE' | 'VIDEO'; url: string }[];
  addOrderTvPromoMedia: (media: { id: string; type: 'IMAGE' | 'VIDEO'; url: string }) => void;
  removeOrderTvPromoMedia: (id: string) => void;

  orderTvPromoText: string;
  setOrderTvPromoText: (text: string) => void;

  orderTvPromoQrUrl: string;
  setOrderTvPromoQrUrl: (url: string) => void;

  orderTvPromoBgColor: string;
  setOrderTvPromoBgColor: (color: string) => void;

  orderPrefix: string;
  setOrderPrefix: (prefix: string) => void;

  parcelChargeAmount: number;
  setParcelChargeAmount: (amount: number) => void;

  timeFormat: '12h' | '24h';
  setTimeFormat: (format: '12h' | '24h') => void;

  dateFormat: 'AUTO' | 'MANUAL';
  setDateFormat: (format: 'AUTO' | 'MANUAL') => void;

  operatingMode: 'FINE_DINING' | 'QSR' | 'CLOUD_KITCHEN';
  setOperatingMode: (mode: 'FINE_DINING' | 'QSR' | 'CLOUD_KITCHEN') => void;

  cloudSyncEnabled: boolean;
  setCloudSyncEnabled: (enabled: boolean) => void;

  fetchSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  (set) => ({
      serverRevision: -1,
      notes: [
        { id: 'n1', label: 'Extra Spicy', icon: '🔥' },
        { id: 'n2', label: 'Less Spicy', icon: '🌶️' },
        { id: 'n3', label: 'No Onion/Garlic', icon: '🚫' },
        { id: 'n4', label: 'Less Ice', icon: '🧊' },
        { id: 'n5', label: 'Extra Cheese', icon: '🧀' },
        { id: 'n6', label: 'Jain Prep', icon: '🌱' },
      ],
      discounts: [
        { id: 'd1', label: 'Staff Discount (10%)', amount: 10, type: 'PERCENTAGE' },
        { id: 'd2', label: 'VIP (15%)', amount: 15, type: 'PERCENTAGE' },
        { id: 'd3', label: 'Manager Comp (100%)', amount: 100, type: 'PERCENTAGE' },
        { id: 'd4', label: 'Zomato Gold (₹100 Flat)', amount: 100, type: 'FLAT' },
      ],
      parcelChargeAmount: 0,
      setParcelChargeAmount: (amount) => set({ parcelChargeAmount: amount }),
      timeFormat: '12h',
      setTimeFormat: (format) => set({ timeFormat: format }),
      dateFormat: 'AUTO',
      setDateFormat: (format) => set({ dateFormat: format }),
      operatingMode: 'FINE_DINING',
      setOperatingMode: (mode) => set({ operatingMode: mode }),
      cloudSyncEnabled: false,
      setCloudSyncEnabled: (enabled) => set({ cloudSyncEnabled: enabled }),
      orderTvEnabled: true,
      orderTvShowPopup: true,
      orderTvPlayAudio: true,
      orderTvAudioTone: 'chime',
      orderTvCustomAudioData: null,
      orderTvTickerEnabled: true,
      orderTvTickerMessage: 'Welcome to Karvaan POS! Your order is being prepared with love.',
      orderTvConfettiEnabled: true,
      orderTvTtsEnabled: false,
      orderTvTtsVoiceName: '',
      orderTvWaterColor: '#fbbf24',
      orderTvShowDelivery: true,
      orderTvReadyBadgeEnabled: true,
      orderTvWaterFillEnabled: true,
      orderTvTimeWaitingEnabled: true,
      orderTvChaosAnimationEnabled: false,
      
      orderTvLayoutMode: 'FULL_QUEUE',
      orderTvOrientation: 'HORIZONTAL',
      orderTvSplitRatio: 50,
      orderTvPromoInterval: 10,
      orderTvPromoMedia: [],
      orderTvPromoText: '',
      orderTvPromoQrUrl: '',
      orderTvPromoBgColor: '',

      orderPrefix: 'KOT',

      addNote: (newNote) => set((state) => ({
        notes: [...state.notes, { ...newNote, id: `note-${Date.now()}` }]
      })),

      deleteNote: (id) => set((state) => ({
        notes: state.notes.filter(n => n.id !== id)
      })),

      addDiscount: (newDiscount) => set((state) => ({
        discounts: [...state.discounts, { ...newDiscount, id: `discount-${Date.now()}` }]
      })),

      deleteDiscount: (id) => set((state) => ({
        discounts: state.discounts.filter(d => d.id !== id)
      })),

      setOrderTvEnabled: (enabled) => set(() => ({
        orderTvEnabled: enabled
      })),

      toggleOrderTvPopup: () => set((state) => ({ orderTvShowPopup: !state.orderTvShowPopup })),
      
      setOrderTvAudio: (play, tone, customData) => set(() => ({
        orderTvPlayAudio: play,
        orderTvAudioTone: tone,
        ...(customData !== undefined ? { orderTvCustomAudioData: customData } : {})
      })),
      
      setOrderTvTicker: (enabled, message) => set(() => ({
        orderTvTickerEnabled: enabled,
        orderTvTickerMessage: message
      })),

      setOrderTvConfetti: (enabled) => set(() => ({
        orderTvConfettiEnabled: enabled
      })),

      setOrderTvTts: (enabled, voiceName) => set(() => ({
        orderTvTtsEnabled: enabled,
        orderTvTtsVoiceName: voiceName
      })),

      setOrderTvWaterColor: (color) => set(() => ({
        orderTvWaterColor: color
      })),

      setOrderTvShowDelivery: (show) => set(() => ({
        orderTvShowDelivery: show
      })),

      setOrderTvReadyBadge: (enabled) => set(() => ({
        orderTvReadyBadgeEnabled: enabled
      })),

      setOrderTvWaterFill: (enabled) => set(() => ({
        orderTvWaterFillEnabled: enabled
      })),

      setOrderTvTimeWaiting: (enabled) => set(() => ({
        orderTvTimeWaitingEnabled: enabled
      })),

      setOrderTvChaosAnimation: (enabled) => set(() => ({
        orderTvChaosAnimationEnabled: enabled
      })),

      setOrderTvLayoutMode: (mode) => set(() => ({
        orderTvLayoutMode: mode
      })),

      setOrderTvOrientation: (orientation) => set(() => ({
        orderTvOrientation: orientation
      })),

      setOrderTvSplitRatio: (ratio) => set(() => ({
        orderTvSplitRatio: ratio
      })),

      setOrderTvPromoInterval: (interval) => set(() => ({
        orderTvPromoInterval: interval
      })),

      addOrderTvPromoMedia: (media) => set((state) => ({
        orderTvPromoMedia: [...state.orderTvPromoMedia, media]
      })),

      removeOrderTvPromoMedia: (id) => set((state) => ({
        orderTvPromoMedia: state.orderTvPromoMedia.filter(m => m.id !== id)
      })),

      setOrderTvPromoText: (text) => set(() => ({
        orderTvPromoText: text
      })),

      setOrderTvPromoQrUrl: (url) => set(() => ({
        orderTvPromoQrUrl: url
      })),

      setOrderTvPromoBgColor: (color) => set(() => ({
        orderTvPromoBgColor: color
      })),

      setOrderPrefix: (prefix) => set(() => ({
        orderPrefix: prefix
      })),

      fetchSettings: async () => {
        const key = settingsKey();
        try {
          const res = await authorizedFetch('/settings');
          if (res.ok) {
            const data = await res.json();
            if (settingsKey() === key) await applyConfigSnapshot('update_settings', data.serverRevision ?? 0, () => useSettingsStore.getState().serverRevision, () => applyRemoteSettings(data));
          }
        } catch (e) {
          console.error("Failed to fetch settings from backend", e);
        }
      }
    })
);

// Keep an unsubmitted draft separate from the last server snapshot. Incoming broadcasts
// must not cancel a local edit in the debounce window.
let syncTimeout: ReturnType<typeof setTimeout>;
let applyingRemote = false;
let dirty = false;
let generation = 0;
const settingsValues = (state: any) => Object.fromEntries(Object.entries(state).filter(([key, value]) => typeof value !== 'function' && key !== 'serverRevision'));

useSettingsStore.subscribe((state) => {
  if (applyingRemote) return;
  clearTimeout(syncTimeout);
  let context;
  try {
    const session = assertCurrentSession();
    if (!session.currentUser?.restaurantId || !['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(session.currentUser.role)) return;
    context = getActionContext();
  } catch { return; }
  dirty = true;
  const settings = settingsValues(state);
  const expectedRevision = state.serverRevision;
  const savedDraftKey = draftKey();
  const draft = JSON.stringify({ settings, expectedRevision, savedAt: new Date().toISOString() });
  localStorage.setItem(savedDraftKey, draft);
  window.dispatchEvent(new CustomEvent('local-draft-updated'));
  if (!canEditConfig(expectedRevision)) { dirty = false; return; }
  const sessionGeneration = generation;
  syncTimeout = setTimeout(async () => {
    try {
      if (generation !== sessionGeneration || !sameContext(context, getActionContext())) return;
      dirty = false;
      applyingRemote = true;
      useSettingsStore.setState({ serverRevision: expectedRevision + 1 });
      applyingRemote = false;
      const result = await emitAction('update_settings', { settings, expectedRevision });
      if (result.status === 'OK' && localStorage.getItem(savedDraftKey) === draft) {
        localStorage.removeItem(savedDraftKey);
        window.dispatchEvent(new CustomEvent('local-draft-updated'));
      }
    } catch { /* The scoped draft remains available for review. */ }
  }, 1000);
});

export function applyRemoteSettings(data: any, force = false) {
  if (dirty && !force) return false;
  const initial = useSettingsStore.getInitialState();
  const values = Object.fromEntries(Object.entries(data || {}).filter(([key]) => key in initial && typeof (initial as any)[key] !== 'function'));
  clearTimeout(syncTimeout);
  dirty = false;
  applyingRemote = true;
  useSettingsStore.setState({ ...initial, ...values });
  applyingRemote = false;
  localStorage.setItem(settingsKey(), JSON.stringify({ ...settingsValues(useSettingsStore.getState()), serverRevision: useSettingsStore.getState().serverRevision }));
  return true;
}

export function getSavedSettingsDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey()) || 'null');
    return draft?.savedAt === localStorage.getItem(`${draftKey()}:reviewed`) ? null : draft;
  } catch { return null; }
}

export function markSettingsDraftReviewed() {
  const draft = getSavedSettingsDraft();
  if (draft) localStorage.setItem(`${draftKey()}:reviewed`, draft.savedAt);
  window.dispatchEvent(new CustomEvent('local-draft-updated'));
}

export function resetSessionSettings() {
  generation++;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(settingsKey()) || '{}'); } catch {}
  applyRemoteSettings(saved, true);
}
