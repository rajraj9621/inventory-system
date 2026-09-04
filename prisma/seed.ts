import "dotenv/config";
import { Prisma, PrismaClient, MovementKind, TimelineEntryType, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const databaseUrl = new URL(connectionString);

if (!databaseUrl.searchParams.has("sslmode")) {
  databaseUrl.searchParams.set("sslmode", "require");
  databaseUrl.searchParams.set("uselibpqcompat", "true");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl.toString(),
  max: 1,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 5_000,
});
const prisma = new PrismaClient({
  adapter,
  transactionOptions: {
    maxWait: 15_000,
    timeout: 20_000,
  },
});

async function seedItemActivity(
  itemId: string,
  actorId: string,
  movements: Prisma.StockMovementCreateManyInput[],
) {
  const movementCount = await prisma.stockMovement.count({ where: { itemId } });
  if (movementCount === 0) {
    await prisma.stockMovement.createMany({ data: movements });
  }

  const createdEntry = await prisma.itemTimelineEntry.findFirst({
    where: { itemId, type: TimelineEntryType.CREATED },
    select: { id: true },
  });
  if (!createdEntry) {
    await prisma.itemTimelineEntry.create({
      data: {
        itemId,
        type: TimelineEntryType.CREATED,
        actorId,
        note: "Seeded demo item",
      },
    });
  }
}

async function main() {
  const passwordHash = await hash("Password123!", 12);

  const manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {
      name: "Demo Manager",
      passwordHash,
      role: UserRole.MANAGER,
      managerId: null,
      active: true,
    },
    create: {
      email: "manager@example.com",
      name: "Demo Manager",
      passwordHash,
      role: UserRole.MANAGER,
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: {
      name: "Demo Staff 1",
      passwordHash,
      role: UserRole.STAFF,
      managerId: manager.id,
      active: true,
    },
    create: {
      email: "staff@example.com",
      name: "Demo Staff 1",
      passwordHash,
      role: UserRole.STAFF,
      managerId: manager.id,
    },
  });

  const staffTwo = await prisma.user.upsert({
    where: { email: "staff2@example.com" },
    update: {
      name: "Demo Staff 2",
      passwordHash,
      role: UserRole.STAFF,
      managerId: manager.id,
      active: true,
    },
    create: {
      email: "staff2@example.com",
      name: "Demo Staff 2",
      passwordHash,
      role: UserRole.STAFF,
      managerId: manager.id,
    },
  });

  const hardware = await prisma.category.upsert({
    where: { name: "Hardware" },
    update: {},
    create: { name: "Hardware" },
  });

  const packaging = await prisma.category.upsert({
    where: { name: "Packaging" },
    update: {},
    create: { name: "Packaging" },
  });

  const officeSupplies = await prisma.category.upsert({
    where: { name: "Office Supplies" },
    update: {},
    create: { name: "Office Supplies" },
  });

  const electrical = await prisma.category.upsert({
    where: { name: "Electrical" },
    update: {},
    create: { name: "Electrical" },
  });

  const safetyEquipment = await prisma.category.upsert({
    where: { name: "Safety Equipment" },
    update: {},
    create: { name: "Safety Equipment" },
  });

  const warehouse = await prisma.location.upsert({
    where: { name: "Main Warehouse" },
    update: { active: true },
    create: {
      name: "Main Warehouse",
      description: "Primary receiving and storage location",
    },
  });

  const retail = await prisma.location.upsert({
    where: { name: "Retail Floor A" },
    update: { active: true },
    create: {
      name: "Retail Floor A",
      description: "Customer-facing stock location",
    },
  });

  await prisma.staffLocationAssignment.upsert({
    where: {
      staffId_locationId: {
        staffId: staff.id,
        locationId: warehouse.id,
      },
    },
    update: { assignedById: manager.id },
    create: {
      staffId: staff.id,
      locationId: warehouse.id,
      assignedById: manager.id,
    },
  });

  await prisma.staffLocationAssignment.upsert({
    where: {
      staffId_locationId: {
        staffId: staffTwo.id,
        locationId: retail.id,
      },
    },
    update: { assignedById: manager.id },
    create: {
      staffId: staffTwo.id,
      locationId: retail.id,
      assignedById: manager.id,
    },
  });

  await prisma.staffLocationAssignment.upsert({
    where: {
      staffId_locationId: {
        staffId: staff.id,
        locationId: retail.id,
      },
    },
    update: { assignedById: manager.id },
    create: {
      staffId: staff.id,
      locationId: retail.id,
      assignedById: manager.id,
    },
  });

  const bolts = await prisma.item.upsert({
    where: { sku: "BOLT-M8-100" },
    update: {
      name: "M8 Hex Bolts",
      reorderLevel: 80,
      archivedAt: null,
    },
    create: {
      sku: "BOLT-M8-100",
      name: "M8 Hex Bolts",
      description: "Box of 100 zinc-plated M8 bolts",
      unitOfMeasure: "box",
      reorderLevel: 80,
      categoryId: hardware.id,
      createdById: manager.id,
    },
  });

  const cartons = await prisma.item.upsert({
    where: { sku: "CARTON-MED" },
    update: {
      name: "Medium Shipping Cartons",
      reorderLevel: 40,
      archivedAt: null,
    },
    create: {
      sku: "CARTON-MED",
      name: "Medium Shipping Cartons",
      description: "Single-wall cartons for standard shipments",
      unitOfMeasure: "piece",
      reorderLevel: 40,
      categoryId: packaging.id,
      createdById: manager.id,
    },
  });

  const paper = await prisma.item.upsert({
    where: { sku: "DEMO-PAPER-A4" },
    update: { name: "Demo A4 Copy Paper", reorderLevel: 12, archivedAt: null },
    create: {
      sku: "DEMO-PAPER-A4",
      name: "Demo A4 Copy Paper",
      description: "A4 paper used for demo receipt, issue, and transfer testing",
      unitOfMeasure: "ream",
      reorderLevel: 12,
      categoryId: officeSupplies.id,
      createdById: manager.id,
    },
  });

  const mouse = await prisma.item.upsert({
    where: { sku: "DEMO-MOUSE-WL" },
    update: { name: "Demo Wireless Mouse", reorderLevel: 6, archivedAt: null },
    create: {
      sku: "DEMO-MOUSE-WL",
      name: "Demo Wireless Mouse",
      description: "Wireless mouse for assigned-location testing",
      unitOfMeasure: "piece",
      reorderLevel: 6,
      categoryId: electrical.id,
      createdById: manager.id,
    },
  });

  const tape = await prisma.item.upsert({
    where: { sku: "DEMO-TAPE-48" },
    update: { name: "Demo Packing Tape", reorderLevel: 10, archivedAt: null },
    create: {
      sku: "DEMO-TAPE-48",
      name: "Demo Packing Tape",
      description: "48 mm packing tape for warehouse testing",
      unitOfMeasure: "roll",
      reorderLevel: 10,
      categoryId: packaging.id,
      createdById: manager.id,
    },
  });

  const ink = await prisma.item.upsert({
    where: { sku: "DEMO-INK-BLK" },
    update: { name: "Demo Black Ink Cartridge", reorderLevel: 5, archivedAt: null },
    create: {
      sku: "DEMO-INK-BLK",
      name: "Demo Black Ink Cartridge",
      description: "Low-stock example for alert testing",
      unitOfMeasure: "cartridge",
      reorderLevel: 5,
      categoryId: officeSupplies.id,
      createdById: manager.id,
    },
  });

  const gloves = await prisma.item.upsert({
    where: { sku: "DEMO-GLOVE-L" },
    update: { name: "Demo Work Gloves Large", reorderLevel: 8, archivedAt: null },
    create: {
      sku: "DEMO-GLOVE-L",
      name: "Demo Work Gloves Large",
      description: "Protective work gloves for stock movement testing",
      unitOfMeasure: "pair",
      reorderLevel: 8,
      categoryId: safetyEquipment.id,
      createdById: manager.id,
    },
  });

  await seedItemActivity(bolts.id, manager.id, [
    { itemId: bolts.id, kind: MovementKind.RECEIPT, quantity: 120, locationId: warehouse.id, recordedById: manager.id },
    { itemId: bolts.id, kind: MovementKind.TRANSFER, quantity: 35, locationId: warehouse.id, sourceLocationId: warehouse.id, destinationLocationId: retail.id, recordedById: manager.id },
  ]);
  await seedItemActivity(cartons.id, manager.id, [
    { itemId: cartons.id, kind: MovementKind.RECEIPT, quantity: 55, locationId: warehouse.id, recordedById: manager.id },
  ]);
  await seedItemActivity(paper.id, manager.id, [
    { itemId: paper.id, kind: MovementKind.RECEIPT, quantity: 50, locationId: warehouse.id, recordedById: manager.id, reason: "Demo opening stock" },
    { itemId: paper.id, kind: MovementKind.TRANSFER, quantity: 15, locationId: warehouse.id, sourceLocationId: warehouse.id, destinationLocationId: retail.id, recordedById: manager.id },
  ]);
  await seedItemActivity(mouse.id, manager.id, [
    { itemId: mouse.id, kind: MovementKind.RECEIPT, quantity: 24, locationId: warehouse.id, recordedById: manager.id, reason: "Demo opening stock" },
    { itemId: mouse.id, kind: MovementKind.TRANSFER, quantity: 8, locationId: warehouse.id, sourceLocationId: warehouse.id, destinationLocationId: retail.id, recordedById: manager.id },
  ]);
  await seedItemActivity(tape.id, manager.id, [
    { itemId: tape.id, kind: MovementKind.RECEIPT, quantity: 36, locationId: warehouse.id, recordedById: manager.id, reason: "Demo opening stock" },
    { itemId: tape.id, kind: MovementKind.TRANSFER, quantity: 12, locationId: warehouse.id, sourceLocationId: warehouse.id, destinationLocationId: retail.id, recordedById: manager.id },
  ]);
  await seedItemActivity(ink.id, manager.id, [
    { itemId: ink.id, kind: MovementKind.RECEIPT, quantity: 8, locationId: warehouse.id, recordedById: manager.id, reason: "Demo opening stock" },
    { itemId: ink.id, kind: MovementKind.ISSUE, quantity: 4, locationId: warehouse.id, recordedById: manager.id, reason: "Create a low-stock demo alert" },
  ]);
  await seedItemActivity(gloves.id, manager.id, [
    { itemId: gloves.id, kind: MovementKind.RECEIPT, quantity: 20, locationId: warehouse.id, recordedById: manager.id, reason: "Demo opening stock" },
    { itemId: gloves.id, kind: MovementKind.TRANSFER, quantity: 6, locationId: warehouse.id, sourceLocationId: warehouse.id, destinationLocationId: retail.id, recordedById: manager.id },
  ]);

  console.log("Seed complete");
  console.log("Manager: manager@example.com / Password123!");
  console.log("Staff 1: staff@example.com / Password123!");
  console.log("Staff 2: staff2@example.com / Password123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
