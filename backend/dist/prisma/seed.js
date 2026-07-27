"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding Karvaan POS Database...');
    const tables = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'VIP-1', 'VIP-2'];
    for (const t of tables) {
        await prisma.table.upsert({
            where: { tableNumber: t },
            update: {},
            create: { tableNumber: t, capacity: t.startsWith('VIP') ? 6 : 4, status: 'AVAILABLE' },
        });
    }
    const categoriesData = [
        { name: 'Hot Beverages', sortOrder: 1 },
        { name: 'Cold Coffee & Shakes', sortOrder: 2 },
        { name: 'Artisan Burgers & Wraps', sortOrder: 3 },
        { name: 'Wood-Fired Pizzas', sortOrder: 4 },
        { name: 'Main Course & Biryani', sortOrder: 5 },
        { name: 'Desserts & Bakery', sortOrder: 6 },
    ];
    const catMap = {};
    for (const c of categoriesData) {
        const cat = await prisma.category.upsert({
            where: { name: c.name },
            update: {},
            create: c,
        });
        catMap[c.name] = cat.id;
    }
    const products = [
        { name: 'Caramel Macchiato', price: 180, categoryId: catMap['Hot Beverages'], prepTimeMinutes: 5 },
        { name: 'Masala Chai Pot', price: 120, categoryId: catMap['Hot Beverages'], prepTimeMinutes: 6 },
        { name: 'Hazelnut Cold Coffee', price: 220, categoryId: catMap['Cold Coffee & Shakes'], prepTimeMinutes: 7 },
        { name: 'Belgian Chocolate Shake', price: 250, categoryId: catMap['Cold Coffee & Shakes'], prepTimeMinutes: 8 },
        { name: 'Smoked Chicken Burger', price: 290, categoryId: catMap['Artisan Burgers & Wraps'], prepTimeMinutes: 12 },
        { name: 'Paneer Tikka Wrap', price: 240, categoryId: catMap['Artisan Burgers & Wraps'], prepTimeMinutes: 10 },
        { name: 'Margherita Pepperoni Pizza', price: 480, categoryId: catMap['Wood-Fired Pizzas'], prepTimeMinutes: 15 },
        { name: 'Four Cheese Truffle Pizza', price: 520, categoryId: catMap['Wood-Fired Pizzas'], prepTimeMinutes: 16 },
        { name: 'Hyderabadi Chicken Biryani', price: 380, categoryId: catMap['Main Course & Biryani'], prepTimeMinutes: 14 },
        { name: 'Dal Makhani with Garlic Naan', price: 320, categoryId: catMap['Main Course & Biryani'], prepTimeMinutes: 12 },
        { name: 'New York Cheesecake', price: 260, categoryId: catMap['Desserts & Bakery'], prepTimeMinutes: 3 },
        { name: 'Warm Chocolate Lava Cake', price: 210, categoryId: catMap['Desserts & Bakery'], prepTimeMinutes: 6 },
    ];
    for (const p of products) {
        await prisma.product.create({
            data: { ...p, isAvailable: true, gstRate: 5.0 },
        });
    }
    const invItems = [
        { name: 'Coffee Beans (Arabica)', category: 'Dry Pantry', currentStock: 15.0, unit: 'kg', minThreshold: 3.0 },
        { name: 'Whole Milk (Full Cream)', category: 'Dairy', currentStock: 40.0, unit: 'liters', minThreshold: 10.0 },
        { name: 'Mozzarella Cheese Block', category: 'Dairy', currentStock: 12.0, unit: 'kg', minThreshold: 4.0 },
        { name: 'Chicken Breast (Fresh)', category: 'Meat', currentStock: 25.0, unit: 'kg', minThreshold: 8.0 },
        { name: 'Paneer Cubes', category: 'Dairy', currentStock: 18.0, unit: 'kg', minThreshold: 5.0 },
    ];
    for (const i of invItems) {
        await prisma.inventoryItem.upsert({
            where: { name: i.name },
            update: {},
            create: i,
        });
    }
    console.log('✅ Seeding completed successfully.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map