"use client";

import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  ClipboardCheck,
  CreditCard,
  Layers3,
  MapPinned,
  PackageOpen,
  ShieldCheck,
  ShipWheel,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { EmployeesManager } from "@/components/settings/EmployeesManager";
import { InspectionCatalogManager } from "@/components/settings/InspectionCatalogManager";
import { PaymentChannelsManager } from "@/components/settings/PaymentChannelsManager";
import { ProductsManager } from "@/components/settings/ProductsManager";
import { RaftsManager } from "@/components/settings/RaftsManager";
import { RolesManager } from "@/components/settings/RolesManager";
import { RoomTypesManager } from "@/components/settings/RoomTypesManager";
import { RoomsManager } from "@/components/settings/RoomsManager";
import { ZonesManager } from "@/components/settings/ZonesManager";

export type SettingsSummary = {
  roomTypes: number;
  zones: number;
  rooms: number;
  roomsAvailable: number;
  rafts: number;
  raftsAvailable: number;
  products: number;
  productsActive: number;
  inspectionItems: number;
  inspectionActive: number;
  channels: number;
  channelsActive: number;
  employees: number;
  employeesWithRole: number;
  roles: number;
};

type SectionId =
  | "room-types"
  | "zones"
  | "rooms"
  | "rafts"
  | "products"
  | "inspection-catalog"
  | "payment-channels"
  | "employees"
  | "roles";

type SectionDef = {
  id: SectionId;
  title: string;
  description: string;
  icon: LucideIcon;
  summary: (s: SettingsSummary) => string;
};

type GroupDef = {
  id: string;
  title: string;
  description: string;
  sections: SectionDef[];
};

const groups: GroupDef[] = [
  {
    id: "property",
    title: "ที่พักและทรัพยากร",
    description: "โครงสร้างห้อง โซน และแพที่ใช้ในการจอง",
    sections: [
      {
        id: "room-types",
        title: "ประเภทห้อง",
        description: "กำหนดประเภทห้อง ราคา และสถานะการใช้งาน",
        icon: Layers3,
        summary: (s) => `${s.roomTypes} ประเภท`,
      },
      {
        id: "zones",
        title: "โซน",
        description: "จัดกลุ่มพื้นที่สำหรับห้องพัก",
        icon: MapPinned,
        summary: (s) => `${s.zones} โซน`,
      },
      {
        id: "rooms",
        title: "ห้องพัก",
        description: "จัดการห้อง สถานะ และผูกกับประเภท/โซน",
        icon: BedDouble,
        summary: (s) => `${s.roomsAvailable}/${s.rooms} พร้อมใช้`,
      },
      {
        id: "rafts",
        title: "แพ",
        description: "จัดการแพและสถานะความพร้อม",
        icon: ShipWheel,
        summary: (s) => `${s.raftsAvailable}/${s.rafts} พร้อมใช้`,
      },
    ],
  },
  {
    id: "commerce",
    title: "สินค้าและบริการ",
    description: "เมนูอาหาร มินิบาร์ และราคากลางตรวจห้อง",
    sections: [
      {
        id: "products",
        title: "สินค้า",
        description: "รายการสินค้า ราคา และการเปิดขาย",
        icon: PackageOpen,
        summary: (s) => `${s.productsActive}/${s.products} เปิดขาย`,
      },
      {
        id: "inspection-catalog",
        title: "ราคากลางตรวจห้อง",
        description: "รายการตรวจหลังเช็กเอาต์และราคากลาง",
        icon: ClipboardCheck,
        summary: (s) => `${s.inspectionActive}/${s.inspectionItems} เปิดใช้`,
      },
    ],
  },
  {
    id: "finance",
    title: "การเงิน",
    description: "ช่องทางรับชำระและคืนเงิน",
    sections: [
      {
        id: "payment-channels",
        title: "ช่องทางรับชำระ",
        description: "เงินสด โอน พร้อมเพย์ และบัตร",
        icon: CreditCard,
        summary: (s) => `${s.channelsActive}/${s.channels} เปิดใช้`,
      },
    ],
  },
  {
    id: "people",
    title: "พนักงานและสิทธิ์",
    description: "บัญชีพนักงาน บทบาท และการผูกสิทธิ์",
    sections: [
      {
        id: "employees",
        title: "พนักงาน",
        description: "ข้อมูลพนักงานและการผูกบทบาท",
        icon: UsersRound,
        summary: (s) => `${s.employeesWithRole}/${s.employees} มีบทบาท`,
      },
      {
        id: "roles",
        title: "บทบาทและสิทธิ์",
        description: "กำหนดบทบาทและชุดสิทธิ์การเข้าถึง",
        icon: ShieldCheck,
        summary: (s) => `${s.roles} บทบาท`,
      },
    ],
  },
];

const allSections = groups.flatMap((group) => group.sections);

function isSectionId(value: string | null): value is SectionId {
  return allSections.some((section) => section.id === value);
}

function renderManager(id: SectionId) {
  switch (id) {
    case "room-types":
      return <RoomTypesManager />;
    case "zones":
      return <ZonesManager />;
    case "rooms":
      return <RoomsManager />;
    case "rafts":
      return <RaftsManager />;
    case "products":
      return <ProductsManager />;
    case "inspection-catalog":
      return <InspectionCatalogManager />;
    case "payment-channels":
      return <PaymentChannelsManager />;
    case "employees":
      return <EmployeesManager />;
    case "roles":
      return <RolesManager />;
  }
}

export function SettingsShell({ summary }: { summary: SettingsSummary }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("section");
  const activeSection = useMemo(
    () => (isSectionId(activeId) ? allSections.find((s) => s.id === activeId) : undefined),
    [activeId],
  );
  const activeGroup = useMemo(
    () =>
      activeSection
        ? groups.find((group) => group.sections.some((s) => s.id === activeSection.id))
        : undefined,
    [activeSection],
  );

  function openSection(id: SectionId) {
    router.push(`/settings?section=${id}`);
  }

  function backToHub() {
    router.push("/settings");
  }

  if (activeSection) {
    const Icon = activeSection.icon;
    return (
      <div className="min-h-screen bg-muted p-4 sm:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <button
                type="button"
                onClick={backToHub}
                className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-secondary/80"
              >
                <ArrowLeft size={16} />
                กลับไปตั้งค่าข้อมูลหลัก
              </button>
              <p className="text-sm font-medium text-primary">
                ตั้งค่าข้อมูลหลัก
                {activeGroup ? ` · ${activeGroup.title}` : ""}
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-foreground">
                {activeSection.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {activeSection.description}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Icon size={20} />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">สรุป</p>
                <p className="text-sm font-semibold text-foreground">
                  {activeSection.summary(summary)}
                </p>
              </div>
            </div>
          </div>

          <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border p-4 sm:px-5">
              <nav className="flex gap-2 overflow-x-auto">
                {activeGroup?.sections.map((section) => {
                  const selected = section.id === activeSection.id;
                  const ItemIcon = section.icon;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => openSection(section.id)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                        selected
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-background hover:text-foreground"
                      }`}
                    >
                      <ItemIcon size={16} />
                      {section.title}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="p-4 sm:p-5">{renderManager(activeSection.id)}</div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm font-medium text-primary">Settings</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground">
            ตั้งค่าข้อมูลหลัก
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ตรวจสอบและจัดการข้อมูลหลักที่ใช้ในการจอง ทรัพยากร สินค้า การรับเงิน
            และพนักงาน โดยเลือกหัวข้อทีละส่วน
          </p>
        </div>

        {groups.map((group) => (
          <section
            key={group.id}
            className="rounded-3xl border border-border bg-surface p-5 shadow-sm"
          >
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-foreground">{group.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => openSection(section.id)}
                    className="group rounded-2xl border border-border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icon size={20} />
                      </span>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {section.summary(summary)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-foreground">
                      {section.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {section.description}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-secondary">
                      เปิดจัดการ
                      <ArrowRight
                        size={14}
                        className="transition group-hover:translate-x-0.5"
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
