"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body className="bg-neutral-100 text-neutral-900 antialiased">
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2.5rem 1rem",
          }}
        >
          <section
            style={{
              width: "100%",
              maxWidth: "28rem",
              borderRadius: "1.5rem",
              border: "1px solid #e5e5e5",
              background: "#fff",
              padding: "1.75rem",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#b45309" }}>
              GLOBAL_ERROR
            </p>
            <h1
              style={{
                marginTop: "0.5rem",
                fontSize: "1.5rem",
                fontWeight: 600,
              }}
            >
              ระบบโหลดไม่สำเร็จ
            </h1>
            <p
              style={{
                marginTop: "0.75rem",
                fontSize: "0.875rem",
                lineHeight: 1.6,
                color: "#737373",
              }}
            >
              กรุณาลองใหม่ หรือปิดแท็บแล้วเปิดเว็บอีกครั้ง
            </p>
            {error.digest ? (
              <p
                style={{
                  marginTop: "0.75rem",
                  fontSize: "0.75rem",
                  color: "#737373",
                  wordBreak: "break-all",
                }}
              >
                รหัส: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "1.75rem",
                width: "100%",
                borderRadius: "0.75rem",
                background: "#171717",
                color: "#fff",
                padding: "0.75rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: 0,
                cursor: "pointer",
              }}
            >
              ลองอีกครั้ง
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
