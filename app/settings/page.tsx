import { Suspense } from "react";

import { SettingsShell } from "@/components/settings/SettingsShell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function SettingsFallback() {
  return (
    <div className="min-h-screen bg-muted p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-border" />
          <div className="h-9 w-56 animate-pulse rounded bg-border" />
          <div className="h-4 w-full max-w-xl animate-pulse rounded bg-border" />
        </div>
        <div className="h-48 animate-pulse rounded-3xl border border-border bg-surface" />
        <div className="h-48 animate-pulse rounded-3xl border border-border bg-surface" />
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const [
    roomTypes,
    zones,
    rooms,
    roomsAvailable,
    rafts,
    raftsAvailable,
    products,
    productsActive,
    foodSets,
    foodSetsActive,
    inspectionItems,
    inspectionActive,
    channels,
    channelsActive,
    employees,
    employeesWithRole,
    roles,
  ] = await Promise.all([
    prisma.roomType.count(),
    prisma.zone.count(),
    prisma.room.count(),
    prisma.room.count({ where: { status: "AVAILABLE" } }),
    prisma.raft.count(),
    prisma.raft.count({ where: { status: "AVAILABLE" } }),
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.foodSet.count(),
    prisma.foodSet.count({ where: { isActive: true } }),
    prisma.inspectionCatalog.count(),
    prisma.inspectionCatalog.count({ where: { isActive: true } }),
    prisma.paymentChannel.count(),
    prisma.paymentChannel.count({ where: { isActive: true } }),
    prisma.employee.count(),
    prisma.employee.count({ where: { roleId: { not: null } } }),
    prisma.role.count(),
  ]);

  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsShell
        summary={{
          roomTypes,
          zones,
          rooms,
          roomsAvailable,
          rafts,
          raftsAvailable,
          products,
          productsActive,
          foodSets,
          foodSetsActive,
          inspectionItems,
          inspectionActive,
          channels,
          channelsActive,
          employees,
          employeesWithRole,
          roles,
        }}
      />
    </Suspense>
  );
}
