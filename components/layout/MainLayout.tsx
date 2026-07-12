"use client";

import { useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { Provider } from "react-redux";
import { store } from "../../store";
import { usePathname } from "next/navigation";

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/access-denied" || pathname === "/forbidden") {
    return <Provider store={store}>{children}</Provider>;
  }

  return (
    <Provider store={store}>
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex min-h-screen pt-16 md:pt-0">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 bg-slate-50 md:ml-64">{children}</main>
      </div>
    </Provider>
  );
}
