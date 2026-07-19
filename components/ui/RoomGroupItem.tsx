"use client";

import { ChevronRight, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import Status from "./Status";

interface Props {
  id: string | number;
  customerName: string;
  summary?: string;
  status: string;
  showStatus?: boolean;
}

export default function RoomGroupItem({
  id,
  customerName,
  summary,
  status,
  showStatus,
}: Props) {
  const router = useRouter();

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center gap-2 p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Users size={24} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{customerName}</span>
            {summary ? (
              <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                {summary}
              </span>
            ) : null}
            {showStatus ? (
              <span className="mt-1 block">
                <Status status={status} />
              </span>
            ) : null}
          </span>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/booking/${id}`)}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/15"
        >
          รายละเอียด
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
