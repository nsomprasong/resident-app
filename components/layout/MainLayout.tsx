"use client";

import { useState } from "react";
import { Box } from "@mui/material";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { Provider } from "react-redux";
import { store } from "../../store";

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = (state: boolean) => () => setSidebarOpen(state);

  return (
    <>
      <Provider store={store}>
        {/* Header only on mobile */}
        <Box className="md:hidden">
          <Header onMenuClick={toggleSidebar(true)} />
        </Box>
        <Box className="flex min-h-screen">
          <Sidebar open={sidebarOpen} onClose={toggleSidebar(false)} />
          <Box className="flex-1 w-full min-h-screen bg-background">
            {children}
          </Box>
        </Box>
      </Provider>
    </>
  );
}