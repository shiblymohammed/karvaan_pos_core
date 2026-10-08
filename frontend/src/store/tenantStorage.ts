import { StateStorage } from 'zustand/middleware';

export const tenantStorage: StateStorage = {
  getItem: (name: string) => {
    let restaurantId = 'default';
    try {
      const authData = localStorage.getItem('auth-storage');
      if (authData) {
        const parsed = JSON.parse(authData);
        restaurantId = parsed.state?.currentUser?.restaurantId || 'default';
      }
    } catch (e) {}
    return localStorage.getItem(`${name}-${restaurantId}`);
  },
  setItem: (name: string, value: string) => {
    let restaurantId = 'default';
    try {
      const authData = localStorage.getItem('auth-storage');
      if (authData) {
        const parsed = JSON.parse(authData);
        restaurantId = parsed.state?.currentUser?.restaurantId || 'default';
      }
    } catch (e) {}
    localStorage.setItem(`${name}-${restaurantId}`, value);
  },
  removeItem: (name: string) => {
    let restaurantId = 'default';
    try {
      const authData = localStorage.getItem('auth-storage');
      if (authData) {
        const parsed = JSON.parse(authData);
        restaurantId = parsed.state?.currentUser?.restaurantId || 'default';
      }
    } catch (e) {}
    localStorage.removeItem(`${name}-${restaurantId}`);
  }
};
