const fs = require('fs');
const path = require('path');

const patchStore = (file) => {
  const filePath = path.join(__dirname, 'src/store', file);
  if (!fs.existsSync(filePath)) return;
  
  let code = fs.readFileSync(filePath, 'utf8');
  if (code.includes('tenantStorage')) return;
  
  // Add imports
  code = code.replace(/import \{ persist \} from 'zustand\/middleware';/, "import { persist, createJSONStorage } from 'zustand/middleware';\nimport { tenantStorage } from './tenantStorage';");
  
  // Replace persist options
  code = code.replace(/\{ name: '([^']+)' \}/, "{ name: '$1', storage: createJSONStorage(() => tenantStorage) }");
  
  fs.writeFileSync(filePath, code);
  console.log('Patched ' + file);
};

patchStore('useLedgerStore.ts');
patchStore('useSettingsStore.ts');
patchStore('useTableStore.ts');
patchStore('useStaffStore.ts');
patchStore('useMenuStore.ts');
patchStore('useKdsStore.ts');
patchStore('useInventoryStore.ts');
patchStore('useDeliveryStore.ts');
patchStore('cartStore.ts');
