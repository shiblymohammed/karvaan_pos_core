const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.restaurant.findFirst().then(r => console.log('RESTAURANT_ID=' + r.id)).catch(e => console.error(e)).finally(() => prisma.$disconnect());
