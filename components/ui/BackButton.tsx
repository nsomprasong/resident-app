"use client";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BackButton({ classProps = "", route }: { classProps?: string; route: string }) {
  const router = useRouter();
  return <button type="button" aria-label="ย้อนกลับ" onClick={() => router.push(route)} className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface text-primary shadow-sm hover:bg-muted ${classProps}`}><ArrowLeft size={20} /></button>;
}
