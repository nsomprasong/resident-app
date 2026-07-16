"use client";

import { useActionState, useEffect, useState } from "react";
import { LoaderCircle, LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { login, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: null, nextPath: null };

type RegisterState = {
  error: string | null;
  success: string | null;
};

const inputClassName =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-ring/30";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [state, formAction, pending] = useActionState(login, initialState);
  const [registerState, setRegisterState] = useState<RegisterState>({
    error: null,
    success: null,
  });
  const [registerPending, setRegisterPending] = useState(false);

  useEffect(() => {
    if (!state.nextPath) return;
    router.replace(state.nextPath);
    router.refresh();
  }, [state.nextPath, router]);

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
          firstName: String(form.get("firstName") ?? ""),
          lastName: String(form.get("lastName") ?? ""),
          notes: String(form.get("notes") ?? ""),
          username: String(form.get("username") ?? ""),
          phone: String(form.get("phone") ?? ""),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "ลงทะเบียนไม่สำเร็จ");
      }
      const successMessage =
        data.message ??
        "ลงทะเบียนสำเร็จ รอผู้ดูแลเปิดใช้งานก่อนเข้าสู่ระบบ";
      formElement.reset();
      setRegisterState({
        error: null,
        success: successMessage,
      });
      setMode("login");
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
          onClick={() => {
            setRegisterState({ error: null, success: null });
            setMode("register");
          }}
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
              htmlFor="identifier"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              ชื่อผู้ใช้ เบอร์โทรศัพท์ หรืออีเมล
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              required
              className={inputClassName}
              placeholder="username / 08xxxxxxxx / name@example.com"
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
              className={inputClassName}
              placeholder="••••••••"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              เข้าใช้งานครั้งแรกหรือถูกรีเซ็ตรหัสผ่าน: ใส่ Username เบอร์โทร
              หรืออีเมล แล้วกดเข้าสู่ระบบโดยไม่ต้องใส่รหัสผ่าน เพื่อไปตั้งรหัสผ่านเอง
            </p>
          </div>
          {state.error ? (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {state.error}
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
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              1. ข้อมูลส่วนตัว
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="register-first-name"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  ชื่อ
                </label>
                <input
                  id="register-first-name"
                  name="firstName"
                  required
                  autoComplete="given-name"
                  className={inputClassName}
                  placeholder="ชื่อ"
                />
              </div>
              <div>
                <label
                  htmlFor="register-last-name"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  นามสกุล
                </label>
                <input
                  id="register-last-name"
                  name="lastName"
                  autoComplete="family-name"
                  className={inputClassName}
                  placeholder="นามสกุล"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="register-notes"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  หมายเหตุ (ไม่บังคับ)
                </label>
                <textarea
                  id="register-notes"
                  name="notes"
                  rows={2}
                  className={inputClassName}
                  placeholder="ข้อมูลเพิ่มเติมสำหรับผู้ดูแล"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                2. ข้อมูลเข้าสู่ระบบ
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                ใช้ Username หรือเบอร์โทรศัพท์เข้าสู่ระบบ อีเมลเป็นข้อมูลติดต่อเท่านั้น
                และไม่บังคับกรอก
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="register-username"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Username
                </label>
                <input
                  id="register-username"
                  name="username"
                  required
                  autoComplete="username"
                  className={inputClassName}
                  placeholder="เช่น somchai.w"
                />
              </div>
              <div>
                <label
                  htmlFor="register-phone"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  เบอร์โทรศัพท์
                </label>
                <input
                  id="register-phone"
                  name="phone"
                  required
                  autoComplete="tel"
                  className={inputClassName}
                  placeholder="08xxxxxxxx"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="register-email"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  อีเมล (ไม่บังคับ)
                </label>
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className={inputClassName}
                  placeholder="name@example.com"
                />
              </div>
              <div className="sm:col-span-2">
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
                  className={inputClassName}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
              </div>
            </div>
          </section>

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
            ข้อมูลที่กรอกจะถูกใช้เป็นข้อมูลส่วนตัวพนักงานทันที
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
