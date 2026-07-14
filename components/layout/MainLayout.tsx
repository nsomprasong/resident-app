"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { usePathname } from "next/navigation";

import { EmployeePermissionsProvider } from "@/components/auth/EmployeePermissionsProvider";
import { store } from "../../store";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/access-denied" || pathname === "/forbidden") {
    return <Provider store={store}>{children}</Provider>;
  }

  return (
    <Provider store={store}>
      <EmployeePermissionsProvider>
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex min-h-screen pt-16 md:pt-0">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="min-w-0 flex-1 bg-background md:ml-[17.5rem]">
            {children}
          </main>
        </div>
      </EmployeePermissionsProvider>
    </Provider>
  );
}
