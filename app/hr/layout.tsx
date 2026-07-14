import type { ReactNode } from "react";

export default function HrLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-muted">{children}</div>;
}
