/**
 * Seed 31 tour-group menus + Food Set 1–8 with ingredient options.
 * Idempotent upsert by product/set name. Does not touch product images.
 *
 * Usage: npx tsx scripts/seed-tour-food-sets.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "../generated/prisma/client";

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

const MENU_NAMES = [
  "แกงส้มชะอมกุ้ง",
  "ยำรวมมิตร",
  "ผัดผักรวมมิตร",
  "ปลาทับทิมนึ่งมะนาว",
  "ทอดมันปลากราย",
  "ต้มยำไก่ไทย",
  "ยำสามกรอบ",
  "ผัดพริกหยวก",
  "ผัดพริกหวานทะเล",
  "น้ำพริกกะปิพร้อมเครื่องเคียง",
  "ต้มจืดเต้าหู้หมูสับ",
  "ปลาทับทิมราดพริก",
  "ผัดเผ็ดหมูป่า",
  "ผัดโป๊ยเซียน",
  "ยำหมูฝอย",
  "ไข่ยัดไส้",
  "คะน้าหมูกรอบ",
  "ยำเส้น",
  "แกงป่า",
  "ต้มแซ่บกระดูกอ่อน",
  "แกงคั่วหอยสับปะรด",
  "มะระปลาเค็ม",
  "ปลาทับทิมสามรส",
  "ไก่ไทยต้มขมิ้น",
  "ปลาทับทิมทอดสมุนไพร",
  "ต้มยำรวมมิตร",
  "คะน้าปลาเค็ม",
  "ผัดพริกแกง",
  "ผลไม้รวม",
  "ข้าวสวย",
] as const;

type OptionDef = { groupName: string; labels: string[] };

const PRODUCT_OPTIONS: Partial<Record<(typeof MENU_NAMES)[number], OptionDef>> =
  {
    ยำเส้น: { groupName: "เส้น", labels: ["เส้นแก้ว", "วุ้นเส้น"] },
    แกงป่า: { groupName: "เนื้อสัตว์", labels: ["ไก่", "หมู"] },
    ผัดพริกหยวก: { groupName: "เนื้อสัตว์", labels: ["ไก่", "หมู"] },
    ผัดพริกแกง: { groupName: "เนื้อสัตว์", labels: ["ไก่", "หมู"] },
  };

type SetItemDef = {
  name: (typeof MENU_NAMES)[number];
  requireOptions?: boolean;
};

const FOOD_SETS: Array<{
  name: string;
  description: string;
  items: SetItemDef[];
}> = [
  {
    name: "Set 1",
    description: "โต๊ะละ 8 ท่าน · อาหารเย็น 5 อย่าง + ผลไม้ + ข้าว",
    items: [
      { name: "แกงส้มชะอมกุ้ง" },
      { name: "ยำรวมมิตร" },
      { name: "ผัดผักรวมมิตร" },
      { name: "ปลาทับทิมนึ่งมะนาว" },
      { name: "ทอดมันปลากราย" },
      { name: "ผลไม้รวม" },
      { name: "ข้าวสวย" },
    ],
  },
  {
    name: "Set 2",
    description: "โต๊ะละ 8 ท่าน · อาหารเย็น 5 อย่าง + ผลไม้ + ข้าว",
    items: [
      { name: "ต้มยำไก่ไทย" },
      { name: "ยำสามกรอบ" },
      { name: "ผัดผักรวมมิตร" },
      { name: "ปลาทับทิมนึ่งมะนาว" },
      { name: "ผัดพริกหยวก", requireOptions: false },
      { name: "ผลไม้รวม" },
      { name: "ข้าวสวย" },
    ],
  },
  {
    name: "Set 3",
    description: "โต๊ะละ 8 ท่าน · อาหารเย็น 5 อย่าง + ผลไม้ + ข้าว",
    items: [
      { name: "ผัดพริกหวานทะเล" },
      { name: "น้ำพริกกะปิพร้อมเครื่องเคียง" },
      { name: "ต้มจืดเต้าหู้หมูสับ" },
      { name: "ปลาทับทิมราดพริก" },
      { name: "ผัดผักรวมมิตร" },
      { name: "ผลไม้รวม" },
      { name: "ข้าวสวย" },
    ],
  },
  {
    name: "Set 4",
    description: "โต๊ะละ 8 ท่าน · อาหารเย็น 5 อย่าง + ผลไม้ + ข้าว",
    items: [
      { name: "ผัดเผ็ดหมูป่า" },
      { name: "ต้มยำไก่ไทย" },
      { name: "ผัดโป๊ยเซียน" },
      { name: "ยำหมูฝอย" },
      { name: "ทอดมันปลากราย" },
      { name: "ผลไม้รวม" },
      { name: "ข้าวสวย" },
    ],
  },
  {
    name: "Set 5",
    description: "โต๊ะละ 8 ท่าน · มีตัวเลือกเส้น/เนื้อสัตว์",
    items: [
      { name: "ไข่ยัดไส้" },
      { name: "คะน้าหมูกรอบ" },
      { name: "ยำเส้น", requireOptions: true },
      { name: "แกงป่า", requireOptions: true },
      { name: "ต้มแซ่บกระดูกอ่อน" },
      { name: "ผลไม้รวม" },
      { name: "ข้าวสวย" },
    ],
  },
  {
    name: "Set 6",
    description: "โต๊ะละ 8 ท่าน · อาหารเย็น 5 อย่าง + ผลไม้ + ข้าว",
    items: [
      { name: "แกงคั่วหอยสับปะรด" },
      { name: "มะระปลาเค็ม" },
      { name: "ยำรวมมิตร" },
      { name: "ปลาทับทิมสามรส" },
      { name: "ไก่ไทยต้มขมิ้น" },
      { name: "ผลไม้รวม" },
      { name: "ข้าวสวย" },
    ],
  },
  {
    name: "Set 7",
    description: "โต๊ะละ 8 ท่าน · มีตัวเลือกไก่/หมู และชนิดเส้น",
    items: [
      { name: "ผัดพริกหยวก", requireOptions: true },
      { name: "ปลาทับทิมทอดสมุนไพร" },
      { name: "ต้มยำรวมมิตร" },
      { name: "ยำเส้น", requireOptions: true },
      { name: "แกงป่า", requireOptions: true },
      { name: "ผลไม้รวม" },
      { name: "ข้าวสวย" },
    ],
  },
  {
    name: "Set 8",
    description: "โต๊ะละ 8 ท่าน · มีตัวเลือกไก่/หมู ในผัดพริกแกง",
    items: [
      { name: "คะน้าปลาเค็ม" },
      { name: "ปลาทับทิมสามรส" },
      { name: "ต้มจืดเต้าหู้หมูสับ" },
      { name: "ยำรวมมิตร" },
      { name: "ผัดพริกแกง", requireOptions: true },
      { name: "ผลไม้รวม" },
      { name: "ข้าวสวย" },
    ],
  },
];

async function ensureTypeAndCategory() {
  const type = await prisma.productType.upsert({
    where: { name: "อาหาร" },
    create: { name: "อาหาร", requiresFoodCategory: true, isActive: true },
    update: { requiresFoodCategory: true, isActive: true },
  });
  const category = await prisma.foodCategory.upsert({
    where: { name: "อาหารสำหรับกรุ๊ปทัวร์" },
    create: { name: "อาหารสำหรับกรุ๊ปทัวร์", isActive: true },
    update: { isActive: true },
  });
  return { type, category };
}

async function upsertProduct(
  name: string,
  typeId: string,
  categoryId: string,
) {
  const existing = await prisma.product.findFirst({
    where: { name, typeId, isMinibar: false },
  });
  if (existing) {
    return prisma.product.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        categoryId,
        description: existing.description ?? "เมนูกรุ๊ปทัวร์ (โต๊ะละ 8 ท่าน)",
      },
    });
  }
  return prisma.product.create({
    data: {
      name,
      description: "เมนูกรุ๊ปทัวร์ (โต๊ะละ 8 ท่าน)",
      price: 0,
      typeId,
      categoryId,
      isMinibar: false,
      isActive: true,
      imageUrl: null,
    },
  });
}

async function syncProductOptions(
  productId: string,
  def: OptionDef | undefined,
) {
  if (!def) return;
  const group = await prisma.productOptionGroup.upsert({
    where: {
      productId_name: { productId, name: def.groupName },
    },
    create: {
      productId,
      name: def.groupName,
      isRequired: true,
      sortOrder: 0,
    },
    update: { isRequired: true },
  });

  for (const [index, label] of def.labels.entries()) {
    await prisma.productOption.upsert({
      where: {
        groupId_label: { groupId: group.id, label },
      },
      create: {
        groupId: group.id,
        label,
        sortOrder: index,
        isActive: true,
      },
      update: { sortOrder: index, isActive: true },
    });
  }
}

async function upsertFoodSet(
  setDef: (typeof FOOD_SETS)[number],
  productByName: Map<string, string>,
) {
  const foodSet = await prisma.foodSet.upsert({
    where: { name: setDef.name },
    create: {
      name: setDef.name,
      description: setDef.description,
      isActive: true,
    },
    update: {
      description: setDef.description,
      isActive: true,
    },
  });

  await prisma.foodSetItem.deleteMany({ where: { foodSetId: foodSet.id } });

  await prisma.foodSetItem.createMany({
    data: setDef.items.map((item, index) => {
      const productId = productByName.get(item.name);
      if (!productId) {
        throw new Error(`Missing product for ${item.name}`);
      }
      return {
        foodSetId: foodSet.id,
        productId,
        quantity: 1,
        sortOrder: index,
        requireOptions: item.requireOptions === true,
      };
    }),
  });

  return foodSet;
}

async function main() {
  const { type, category } = await ensureTypeAndCategory();
  const productByName = new Map<string, string>();

  for (const name of MENU_NAMES) {
    const product = await upsertProduct(name, type.id, category.id);
    productByName.set(name, product.id);
    await syncProductOptions(product.id, PRODUCT_OPTIONS[name]);
    console.log(`menu: ${name}`);
  }

  for (const setDef of FOOD_SETS) {
    await upsertFoodSet(setDef, productByName);
    console.log(`set: ${setDef.name} (${setDef.items.length} items)`);
  }

  console.log(
    `Done: ${MENU_NAMES.length} menus, ${FOOD_SETS.length} food sets`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
