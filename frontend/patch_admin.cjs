const fs = require('fs');
let code = fs.readFileSync('src/screens/Admin/AdminMenuManager.tsx', 'utf8');

// Patch handleProductSave
code = code.replace(
  "    } else {\r\n      addProduct(data);\r\n    }\r\n    setProductModal({ open: false });",
  "    } else {\r\n      addProduct(data);\r\n    }\r\n    triggerMenuSync();\r\n    setProductModal({ open: false });"
);
code = code.replace(
  "    } else {\n      addProduct(data);\n    }\n    setProductModal({ open: false });",
  "    } else {\n      addProduct(data);\n    }\n    triggerMenuSync();\n    setProductModal({ open: false });"
);

// Patch handleCategorySave
code = code.replace(
  "    } else {\r\n      addCategory(data);\r\n    }\r\n    setCatModal({ open: false });",
  "    } else {\r\n      addCategory(data);\r\n    }\r\n    triggerMenuSync();\r\n    setCatModal({ open: false });"
);
code = code.replace(
  "    } else {\n      addCategory(data);\n    }\n    setCatModal({ open: false });",
  "    } else {\n      addCategory(data);\n    }\n    triggerMenuSync();\n    setCatModal({ open: false });"
);

// Patch confirmDelete
code = code.replace(
  "    if (deleteConfirm.type === 'product') deleteProduct(deleteConfirm.id);\r\n    else deleteCategory(deleteConfirm.id);\r\n    setDeleteConfirm(null);",
  "    if (deleteConfirm.type === 'product') deleteProduct(deleteConfirm.id);\r\n    else deleteCategory(deleteConfirm.id);\r\n    triggerMenuSync();\r\n    setDeleteConfirm(null);"
);
code = code.replace(
  "    if (deleteConfirm.type === 'product') deleteProduct(deleteConfirm.id);\n    else deleteCategory(deleteConfirm.id);\n    setDeleteConfirm(null);",
  "    if (deleteConfirm.type === 'product') deleteProduct(deleteConfirm.id);\n    else deleteCategory(deleteConfirm.id);\n    triggerMenuSync();\n    setDeleteConfirm(null);"
);

// Patch reorderCategory
code = code.replace(
  "const reorderCategory = (id: string, direction: 'up' | 'down') => {",
  "const reorderCategory = (id: string, direction: 'up' | 'down') => {\r\n  // To be patched"
);
// I can just replace the bottom of reorderCategory
code = code.replace(
  "      updates.forEach(u => updateCategory(u.id, { sortOrder: u.sortOrder }));\r\n    }\r\n  };",
  "      updates.forEach(u => updateCategory(u.id, { sortOrder: u.sortOrder }));\r\n      triggerMenuSync();\r\n    }\r\n  };"
);
code = code.replace(
  "      updates.forEach(u => updateCategory(u.id, { sortOrder: u.sortOrder }));\n    }\n  };",
  "      updates.forEach(u => updateCategory(u.id, { sortOrder: u.sortOrder }));\n      triggerMenuSync();\n    }\n  };"
);


fs.writeFileSync('src/screens/Admin/AdminMenuManager.tsx', code);
console.log('AdminMenuManager patched completely!');
