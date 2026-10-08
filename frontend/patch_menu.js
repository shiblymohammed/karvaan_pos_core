const fs = require('fs');
let code = fs.readFileSync('src/store/useMenuStore.ts', 'utf8');

if (!code.includes('emitAction')) {
  code = code.replace(/import \{ create \} from 'zustand';/, "import { create } from 'zustand';\nimport { emitAction } from '../services/socket';");
}

const mutators = [
  'addProduct', 'updateProduct', 'deleteProduct', 'toggleAvailability', 'toggleFavourite',
  'addCategory', 'updateCategory', 'deleteCategory'
];

for (const mutator of mutators) {
  const regex = new RegExp(mutator + ': \\(.*?\\) => \\{([\\s\\S]*?)\\},', 'g');
  code = code.replace(regex, (match) => {
    if (match.includes('emitAction')) return match;
    return match.replace(/\\},\\s*$/, "\n        emitAction('sync_menu', { categories: get().categories, products: get().products });\n      },");
  });
}

fs.writeFileSync('src/store/useMenuStore.ts', code);
console.log('Successfully patched mutators!');
