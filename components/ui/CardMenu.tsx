"use client";

import Image from "next/image";
import { Plus } from "lucide-react";
import { useState } from "react";

import { useBasketList } from "@/hooks/useBasketList";
import AddMenuDialog from "./AddMenuDialog";

interface Props {
  id?: string;
  image: string;
  alt: string;
  title: string;
  price: number;
}

export default function CardMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const { basketList } = useBasketList();
  const count = basketList.filter((item) => item.title === props.title).length;
  const isRemote = /^https?:\/\//i.test(props.image);

  return (
    <>
      <article className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            fill
            src={props.image}
            alt={props.alt}
            unoptimized={isRemote}
            className="object-cover transition duration-300 group-hover:scale-105"
          />
          {count > 0 ? (
            <span className="absolute right-2 top-2 rounded-full bg-surface px-2 py-1 text-xs font-semibold shadow">
              {count}
            </span>
          ) : null}
        </div>
        <div className="p-3">
          <h3 className="font-medium">{props.title}</h3>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              ฿{props.price.toLocaleString()}
            </span>
            <button
              type="button"
              aria-label={`เพิ่ม ${props.title}`}
              onClick={() => setOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </article>
      <AddMenuDialog open={open} setOpen={setOpen} menu={props} />
    </>
  );
}
