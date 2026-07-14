"use client";

import { LoaderCircle, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SetPasswordFormProps = {
  ticket?: string;
};

export default function SetPasswordForm({ ticket }: SetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          confirmPassword,
          ...(ticket ? { ticket } : {}),
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "บันทึกรหัสผ่านไม่สำเร็จ");
      }
      router.replace("/login?passwordUpdated=1");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "บันทึกรหัสผ่านไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-5">
      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-medium text-foreground"
        >
          รหัสผ่านใหม่
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-ring/30"
          placeholder="อย่างน้อย 8 ตัวอักษร"
        />
      </div>
      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-2 block text-sm font-medium text-foreground"
        >
          ยืนยันรหัสผ่านใหม่
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-ring/30"
          placeholder="••••••••"
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/40"
      >
        {pending ? (
          <LoaderCircle className="animate-spin" size={20} />
        ) : (
          <KeyRound size={20} />
        )}
        {pending ? "กำลังบันทึก..." : "บันทึกรหัสผ่านแล้วไปเข้าสู่ระบบ"}
      </button>
    </form>
  );
}
