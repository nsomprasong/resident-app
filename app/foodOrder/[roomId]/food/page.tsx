"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import BackButton from "@/components/ui/BackButton";
import Basket from "@/components/ui/Basket";
import CardMenu from "@/components/ui/CardMenu";
import type { MenuShowModel } from "@/interface/MenuShowModel";
import type { FoodCategoryRecord } from "@/lib/settings/product-master-shared";

const fallbackFood: MenuShowModel[] = [
  {
    image: "/images/food/frychicken.jpg",
    alt: "ไก่ทอด",
    title: "ไก่ทอด",
    price: 80,
    categoryId: "one-dish",
    categoryName: "อาหารจานเดียว",
  },
  {
    image: "/images/food/fryfish.jpg",
    alt: "ปลาทอด",
    title: "ปลาทอด",
    price: 120,
    categoryId: "one-dish",
    categoryName: "อาหารจานเดียว",
  },
  {
    image: "/images/food/mootod.jpg",
    alt: "หมูทอด",
    title: "หมูทอด",
    price: 90,
    categoryId: "one-dish",
    categoryName: "อาหารจานเดียว",
  },
  {
    image: "/images/food/roti.jpg",
    alt: "โรตี",
    title: "โรตี",
    price: 40,
    categoryId: "one-dish",
    categoryName: "อาหารจานเดียว",
  },
  {
    image: "/images/food/somtum.jpg",
    alt: "ส้มตำ",
    title: "ส้มตำ",
    price: 70,
    categoryId: "yum",
    categoryName: "ยำ",
  },
  {
    image: "/images/food/toomyum.jpg",
    alt: "ต้มยำกุ้ง",
    title: "ต้มยำกุ้ง",
    price: 150,
    categoryId: "tom",
    categoryName: "ต้ม",
  },
];

const fallbackMinibar: MenuShowModel[] = [
  {
    image: "/images/minibar/beer.jpg",
    alt: "เบียร์",
    title: "เบียร์ช้าง",
    price: 70,
  },
  {
    image: "/images/minibar/chocolate.jpg",
    alt: "ช็อกโกแลต",
    title: "ช็อกโกแลต",
    price: 35,
  },
  {
    image: "/images/minibar/lay.jpg",
    alt: "มันฝรั่ง",
    title: "เลย์",
    price: 25,
  },
  {
    image: "/images/minibar/icecream.jpg",
    alt: "ไอศกรีม",
    title: "ไอศกรีม",
    price: 45,
  },
  {
    image: "/images/minibar/milk.jpg",
    alt: "นม",
    title: "นม",
    price: 25,
  },
];

export default function FoodMenuPage() {
  const { roomId: bookingId } = useParams<{ roomId: string }>();
  const [tab, setTab] = useState<"food" | "minibar">("food");
  const [categoryFilter, setCategoryFilter] = useState<string | "ALL">("ALL");
  const [categories, setCategories] = useState<FoodCategoryRecord[]>([]);
  const [items, setItems] = useState({
    food: fallbackFood,
    minibar: fallbackMinibar,
  });
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState("กำลังโหลดลูกค้า...");
  const [roomNames, setRoomNames] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          customerName: string;
          rooms: Array<{ number: string }>;
        };
        setCustomer(data.customerName);
        setRoomNames(data.rooms.map((room) => `ห้อง ${room.number}`).join(", "));
      } catch {
        /* ใช้ข้อความสำรอง */
      }
    };
    void load();
  }, [bookingId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const minibar = tab === "minibar";
        const [productsResponse, categoriesResponse] = await Promise.all([
          fetch(`/api/products?minibar=${minibar}`),
          tab === "food"
            ? fetch("/api/food-categories")
            : Promise.resolve(null),
        ]);
        if (!productsResponse.ok) throw new Error();
        const data = (await productsResponse.json()) as MenuShowModel[];
        if (data.length) {
          setItems((current) => ({ ...current, [tab]: data }));
        }
        if (categoriesResponse?.ok) {
          const cats = (await categoriesResponse.json()) as FoodCategoryRecord[];
          if (Array.isArray(cats)) setCategories(cats);
        }
      } catch {
        /* ใช้เมนูสำรอง */
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [tab]);

  useEffect(() => {
    setCategoryFilter("ALL");
  }, [tab]);

  const visibleItems = useMemo(() => {
    const list = items[tab];
    if (tab !== "food" || categoryFilter === "ALL") return list;
    return list.filter((item) => item.categoryId === categoryFilter);
  }, [items, tab, categoryFilter]);

  const availableCategories = useMemo(() => {
    const present = new Set(
      items.food.map((item) => item.categoryId).filter(Boolean),
    );
    const fromApi = categories.filter((item) => present.has(item.id));
    if (fromApi.length) return fromApi;

    const fallback = new Map<string, string>();
    for (const item of items.food) {
      if (item.categoryId && item.categoryName) {
        fallback.set(item.categoryId, item.categoryName);
      }
    }
    return [...fallback.entries()].map(([id, name]) => ({
      id,
      name,
      isActive: true,
    }));
  }, [categories, items.food]);

  const selectedCategoryName =
    availableCategories.find((item) => item.id === categoryFilter)?.name ?? "";

  return (
    <div>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-primary px-4 text-primary-foreground shadow">
        <div className="flex items-center gap-3">
          <BackButton route="/foodOrder" />
          <div>
            <p className="text-xs text-primary-foreground/70">
              {roomNames || "รายการจอง"}
            </p>
            <h1 className="font-semibold">{customer}</h1>
          </div>
        </div>
        <Basket id={bookingId} />
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-border/70 p-1">
            <button
              type="button"
              onClick={() => setTab("food")}
              className={`rounded-lg px-5 py-2 text-sm ${
                tab === "food"
                  ? "bg-surface text-primary shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              อาหาร
            </button>
            <button
              type="button"
              onClick={() => setTab("minibar")}
              className={`rounded-lg px-5 py-2 text-sm ${
                tab === "minibar"
                  ? "bg-surface text-primary shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              มินิบาร์
            </button>
          </div>
          {loading ? (
            <span className="text-sm text-muted-foreground">กำลังโหลด...</span>
          ) : null}
        </div>

        {tab === "food" ? (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter("ALL")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                categoryFilter === "ALL"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground ring-1 ring-border"
              }`}
            >
              ทั้งหมด
            </button>
            {availableCategories.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => setCategoryFilter(option.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                  categoryFilter === option.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-muted-foreground ring-1 ring-border"
                }`}
              >
                {option.name}
              </button>
            ))}
          </div>
        ) : null}

        {visibleItems.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {tab === "food" && categoryFilter !== "ALL"
              ? `ยังไม่มีเมนูในหมวด${selectedCategoryName}`
              : "ยังไม่มีรายการ"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleItems.map((item) => (
              <CardMenu key={item.id ?? item.title} {...item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
