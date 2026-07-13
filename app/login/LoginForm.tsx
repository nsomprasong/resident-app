"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, LogIn, UserPlus } from "lucide-react";

import { login, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: null };

type RegisterState = {
  error: string | null;
  success: string | null;
};

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [state, formAction, pending] = useActionState(login, initialState);
  const [registerState, setRegisterState] = useState<RegisterState>({
    error: null,
    success: null,
  });
  const [registerPending, setRegisterPending] = useState(false);

  const submitRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setRegisterPending(true);
    setRegisterState({ error: null, success: null });
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          password: String(form.get("password") ?? ""),
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "ลงทะเบียนไม่สำเร็จ");
      }
      setRegisterState({
        error: null,
        success:
          data.message ??
          "ลงทะเบียนสำเร็จ รอผู้ดูแลเปิดใช้งานก่อนเข้าสู่ระบบ",
      });
      formElement.reset();
    } catch (reason) {
      setRegisterState({
        error:
          reason instanceof Error ? reason.message : "ลงทะเบียนไม่สำเร็จ",
        success: null,
      });
    } finally {
      setRegisterPending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="inline-flex w-full rounded-xl bg-border/70 p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            mode === "login"
              ? "bg-surface text-primary shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          เข้าสู่ระบบ
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            mode === "register"
              ? "bg-surface text-primary shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          ลงทะเบียน
        </button>
      </div>

      {mode === "login" ? (
        <form action={formAction} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              อีเมล
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-ring/30"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              รหัสผ่าน
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-ring/30"
              placeholder="••••••••"
            />
          </div>
          {state.error ? (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {state.error}
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
              <LogIn size={20} />
            )}
            {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void submitRegister(e)} className="space-y-5">
          <div>
            <label
              htmlFor="register-name"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              ชื่อ-นามสกุล
            </label>
            <input
              id="register-name"
              name="name"
              required
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-ring/30"
              placeholder="ชื่อที่ใช้ในระบบ"
            />
          </div>
          <div>
            <label
              htmlFor="register-email"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              อีเมล
            </label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-ring/30"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="register-phone"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              เบอร์โทร (ไม่บังคับ)
            </label>
            <input
              id="register-phone"
              name="phone"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-ring/30"
              placeholder="08x-xxx-xxxx"
            />
          </div>
          <div>
            <label
              htmlFor="register-password"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              รหัสผ่าน
            </label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-ring/30"
              placeholder="อย่างน้อย 8 ตัวอักษร"
            />
          </div>
          {registerState.error ? (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {registerState.error}
            </p>
          ) : null}
          {registerState.success ? (
            <p
              role="status"
              className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success"
            >
              {registerState.success}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            หลังลงทะเบียนจะยังเข้าใช้งานไม่ได้ จนกว่าผู้ดูแลจะกำหนดสิทธิ์และเปิดใช้งาน
          </p>
          <button
            type="submit"
            disabled={registerPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/40"
          >
            {registerPending ? (
              <LoaderCircle className="animate-spin" size={20} />
            ) : (
              <UserPlus size={20} />
            )}
            {registerPending ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
          </button>
        </form>
      )}
    </div>
  );
}
