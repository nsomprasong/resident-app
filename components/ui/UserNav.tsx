import Image from "next/image";
import { LogOut } from "lucide-react";

export default function UserNav({
  image,
  name,
  role,
}: {
  image: string;
  name: string;
  role: string;
}) {
  return (
    <div className="border-t border-border/80 bg-background/50 p-3 backdrop-blur-sm">
      <div className="rounded-2xl border border-border/70 bg-surface p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Image
            className="rounded-full ring-2 ring-primary/10"
            src={image}
            alt={name}
            width={40}
            height={40}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {role || "—"}
            </p>
          </div>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-muted"
          >
            <LogOut size={16} />
            ออกจากระบบ
          </button>
        </form>
      </div>
    </div>
  );
}
