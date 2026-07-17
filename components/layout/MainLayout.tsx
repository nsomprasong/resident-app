"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { usePathname } from "next/navigation";

import { ClientErrorBoundary } from "@/components/auth/ClientErrorBoundary";
import { ClientErrorLogger } from "@/components/auth/ClientErrorLogger";
import {
  EmployeePermissionsProvider,
  useEmployeePermissionsOptional,
} from "@/components/auth/EmployeePermissionsProvider";
import { AppTooltip } from "@/components/ui/AppTooltip";
import { store } from "../../store";
import Header from "./Header";
import Sidebar from "./Sidebar";

function AuthenticatedShell({
  children,
  sidebarOpen,
  setSidebarOpen,
}: {
  children: React.ReactNode;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  const permissions = useEmployeePermissionsOptional();
  const role = permissions?.employee?.role ?? null;

  return (
    <ClientErrorBoundary role={role}>
      <ClientErrorLogger />
      <AppTooltip />
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex min-h-screen pt-16 md:pt-0">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 bg-background md:ml-[17.5rem]">
          {children}
        </main>
      </div>
    </ClientErrorBoundary>
  );
}

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  if (
    pathname === "/login" ||
    pathname === "/access-denied" ||
    pathname === "/forbidden" ||
    pathname === "/set-password"
  ) {
    return (
      <Provider store={store}>
        <ClientErrorBoundary>{children}</ClientErrorBoundary>
      </Provider>
    );
  }

  return (
    <Provider store={store}>
      <EmployeePermissionsProvider>
        <AuthenticatedShell
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        >
          {children}
        </AuthenticatedShell>
      </EmployeePermissionsProvider>
    </Provider>
  );
}
