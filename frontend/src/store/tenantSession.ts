// Reset in-memory data as well as changing the persistence namespace when a session changes.
export async function hydrateTenantStores(isCurrent: () => boolean = () => true) {
  const modules = await Promise.all([
    import('./cartStore'), import('./useTableStore'), import('./useKdsStore'),
    import('./useDeliveryStore'), import('./useStaffStore'), import('./useInventoryStore'),
    import('./useMenuStore'), import('./useLedgerStore'),
  ]);
  for (const module of modules) {
    if (!isCurrent()) return;
    const store: any = Object.values(module).find((value: any) => value?.persist && value?.getInitialState);
    if (!store) continue;
    // Read the incoming tenant first: setState would otherwise overwrite its saved cart.
    const options = store.persist.getOptions();
    const saved = await options.storage.getItem(options.name);
    if (!isCurrent()) return;
    store.setState(store.getInitialState(), true);
    if (saved) {
      await options.storage.setItem(options.name, saved);
      if (!isCurrent()) return;
      await store.persist.rehydrate();
    }
  }
}
