import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  InspectionItemType,
  PaymentMethod,
  PrismaClient,
} from "../generated/prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured");
const databaseUrl = new URL(connectionString);
databaseUrl.searchParams.delete("sslmode");

const ca = readFileSync(
  join(process.cwd(), "certs", "prod-ca-2021.crt"),
  "utf8",
);
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl.toString(),
    ssl: { ca, rejectUnauthorized: true },
  }),
});

const productSeeds: Array<{
  name: string;
  price: number;
  typeName: string;
  isMinibar: boolean;
  imageUrl: string;
  categoryName?: string;
}> = [
  {
    name: "ไก่ทอด",
    price: 80,
    typeName: "อาหาร",
    isMinibar: false,
    imageUrl: "/images/food/frychicken.jpg",
    categoryName: "อาหารจานเดียว",
  },
  {
    name: "ปลาทอด",
    price: 120,
    typeName: "อาหาร",
    isMinibar: false,
    imageUrl: "/images/food/fryfish.jpg",
    categoryName: "อาหารจานเดียว",
  },
  {
    name: "หมูทอด",
    price: 90,
    typeName: "อาหาร",
    isMinibar: false,
    imageUrl: "/images/food/mootod.jpg",
    categoryName: "อาหารจานเดียว",
  },
  {
    name: "โรตี",
    price: 40,
    typeName: "อาหาร",
    isMinibar: false,
    imageUrl: "/images/food/roti.jpg",
    categoryName: "อาหารจานเดียว",
  },
  {
    name: "ส้มตำ",
    price: 70,
    typeName: "อาหาร",
    isMinibar: false,
    imageUrl: "/images/food/somtum.jpg",
    categoryName: "ยำ",
  },
  {
    name: "ต้มยำกุ้ง",
    price: 150,
    typeName: "อาหาร",
    isMinibar: false,
    imageUrl: "/images/food/toomyum.jpg",
    categoryName: "ต้ม",
  },
  {
    name: "เบียร์ช้าง",
    price: 70,
    typeName: "เครื่องดื่ม",
    isMinibar: true,
    imageUrl: "/images/minibar/beer.jpg",
  },
  {
    name: "ช็อกโกแลต",
    price: 35,
    typeName: "ของใช้",
    isMinibar: true,
    imageUrl: "/images/minibar/chocolate.jpg",
  },
  {
    name: "เลย์",
    price: 25,
    typeName: "ของใช้",
    isMinibar: true,
    imageUrl: "/images/minibar/lay.jpg",
  },
  {
    name: "ไอศกรีม",
    price: 45,
    typeName: "ของใช้",
    isMinibar: true,
    imageUrl: "/images/minibar/icecream.jpg",
  },
  {
    name: "นม",
    price: 25,
    typeName: "เครื่องดื่ม",
    isMinibar: true,
    imageUrl: "/images/minibar/milk.jpg",
  },
];

const inspectionCatalogs = [
  { name: "น้ำดื่ม", type: InspectionItemType.MINIBAR, unitPrice: 20 },
  { name: "น้ำอัดลม", type: InspectionItemType.MINIBAR, unitPrice: 30 },
  { name: "เบียร์", type: InspectionItemType.MINIBAR, unitPrice: 70 },
  {
    name: "ผ้าเช็ดตัวสูญหาย",
    type: InspectionItemType.MISSING,
    unitPrice: 300,
  },
  {
    name: "ผ้าปูที่นอนสูญหาย",
    type: InspectionItemType.MISSING,
    unitPrice: 800,
  },
  { name: "ผ้าห่มสูญหาย", type: InspectionItemType.MISSING, unitPrice: 1200 },
  { name: "ผ้าปูที่นอนเปื้อน", type: InspectionItemType.STAIN, unitPrice: 300 },
  { name: "ผ้าห่มเปื้อน", type: InspectionItemType.STAIN, unitPrice: 500 },
  { name: "กุญแจห้องสูญหาย", type: InspectionItemType.MISSING, unitPrice: 500 },
  {
    name: "อุปกรณ์ในห้องชำรุด",
    type: InspectionItemType.DAMAGE,
    unitPrice: 500,
  },
];
const paymentChannels = [
  { name: "เงินโอน", method: PaymentMethod.TRANSFER },
  { name: "เงินสด", method: PaymentMethod.CASH },
  { name: "พร้อมเพย์", method: PaymentMethod.PROMPTPAY },
  { name: "บัตร", method: PaymentMethod.CARD },
];

async function ensureProductType(name: string, requiresFoodCategory: boolean) {
  return prisma.productType.upsert({
    where: { name },
    update: { isActive: true, requiresFoodCategory },
    create: { name, requiresFoodCategory, isActive: true },
  });
}

async function ensureFoodCategory(name: string) {
  return prisma.foodCategory.upsert({
    where: { name },
    update: { isActive: true },
    create: { name, isActive: true },
  });
}

async function main() {
  const mainZone = await prisma.zone.upsert({
    where: { name: "อาคารหลัก" },
    update: {},
    create: { name: "อาคารหลัก" },
  });
  const zoneB = await prisma.zone.upsert({
    where: { name: "อาคาร B" },
    update: {},
    create: { name: "อาคาร B" },
  });

  const standard = await prisma.roomType.upsert({
    where: { name: "Standard" },
    update: { basePrice: 1200, capacity: 2, bedType: "เตียงคู่" },
    create: {
      name: "Standard",
      description: "ห้องมาตรฐานสำหรับ 2 ท่าน",
      basePrice: 1200,
      capacity: 2,
      bedType: "เตียงคู่",
    },
  });
  const single = await prisma.roomType.upsert({
    where: { name: "Single" },
    update: { basePrice: 900, capacity: 1, bedType: "เตียงเดี่ยว" },
    create: {
      name: "Single",
      description: "ห้องเตียงเดี่ยวสำหรับ 1 ท่าน",
      basePrice: 900,
      capacity: 1,
      bedType: "เตียงเดี่ยว",
    },
  });
  const deluxe = await prisma.roomType.upsert({
    where: { name: "Deluxe" },
    update: { basePrice: 1800, capacity: 3, bedType: "เตียงคิงไซส์" },
    create: {
      name: "Deluxe",
      description: "ห้องขนาดใหญ่พร้อมพื้นที่พักผ่อน",
      basePrice: 1800,
      capacity: 3,
      bedType: "เตียงคิงไซส์",
    },
  });

  for (let index = 1; index <= 10; index += 1) {
    const number = `${100 + index}`;
    await prisma.room.upsert({
      where: { number },
      update: {
        floor: 1,
        zoneId: index <= 6 ? mainZone.id : zoneB.id,
        roomTypeId:
          index % 4 === 1
            ? single.id
            : index % 3 === 0
              ? deluxe.id
              : standard.id,
      },
      create: {
        number,
        floor: 1,
        zoneId: index <= 6 ? mainZone.id : zoneB.id,
        roomTypeId:
          index % 4 === 1
            ? single.id
            : index % 3 === 0
              ? deluxe.id
              : standard.id,
      },
    });
  }

  for (let index = 1; index <= 5; index += 1) {
    const number = `${index}`;
    await prisma.raft.upsert({
      where: { number },
      update: {
        name: `แพ ${number}`,
        capacity: index <= 3 ? 10 : 15,
        basePrice: index <= 3 ? 1500 : 2200,
      },
      create: {
        number,
        name: `แพ ${number}`,
        capacity: index <= 3 ? 10 : 15,
        basePrice: index <= 3 ? 1500 : 2200,
      },
    });
  }

  for (const name of ["อาหาร", "เครื่องดื่ม", "เสื้อผ้า", "ของใช้"]) {
    await ensureProductType(name, name === "อาหาร");
  }
  for (const name of [
    "ต้ม",
    "ผัดเผ็ด",
    "ยำ",
    "อาหารจานเดียว",
    "อาหารสำหรับกรุ๊ปทัวร์",
  ]) {
    await ensureFoodCategory(name);
  }

  for (const product of productSeeds) {
    const type = await prisma.productType.findUniqueOrThrow({
      where: { name: product.typeName },
    });
    const category = product.categoryName
      ? await prisma.foodCategory.findUniqueOrThrow({
          where: { name: product.categoryName },
        })
      : null;

    const existing = await prisma.product.findFirst({
      where: { name: product.name },
    });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          price: product.price,
          imageUrl: product.imageUrl,
          typeId: type.id,
          categoryId: category?.id ?? null,
          isMinibar: product.isMinibar,
          isActive: true,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
          typeId: type.id,
          categoryId: category?.id ?? null,
          isMinibar: product.isMinibar,
          isActive: true,
        },
      });
    }
  }

  for (const item of inspectionCatalogs)
    await prisma.inspectionCatalog.upsert({
      where: { name: item.name },
      update: { type: item.type, unitPrice: item.unitPrice, isActive: true },
      create: item,
    });
  for (const channel of paymentChannels)
    await prisma.paymentChannel.upsert({
      where: { name: channel.name },
      update: { method: channel.method, isActive: true },
      create: channel,
    });

  const [zoneCount, roomTypeCount, roomCount, raftCount, productCount] =
    await Promise.all([
      prisma.zone.count(),
      prisma.roomType.count(),
      prisma.room.count(),
      prisma.raft.count(),
      prisma.product.count(),
    ]);
  console.log(
    `Seed complete: ${zoneCount} zones, ${roomTypeCount} room types, ${roomCount} rooms, ${raftCount} rafts, ${productCount} products`,
  );
}

main().finally(() => prisma.$disconnect());
