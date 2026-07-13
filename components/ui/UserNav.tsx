import Image from "next/image";
import { LogOut } from "lucide-react";

export default function UserNav({ image, name, role }: { image: string; name: string; role: string }) {
  return (
    <div className="border-t border-border p-4">
      <div className="rounded-xl bg-background p-3">
        <div className="flex items-center gap-3">
          <Image className="rounded-full" src={image} alt={name} width={40} height={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{role}</p>
          </div>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            <LogOut size={16} />
            ออกจากระบบ
          </button>
        </form>
      </div>
    </div>
  );
}
