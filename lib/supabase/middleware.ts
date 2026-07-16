import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicEnvironment } from "@/lib/supabase/config";
import {
  canAccessPageWithPermissions,
  employeeHasApiPermission,
  resolveApiPermission,
} from "@/lib/auth/authorization";
import { findEmployeeAuthorization } from "@/lib/auth/employee-authorization";
import { sessionEpochMatches } from "@/lib/auth/session-epoch";

const PUBLIC_ROUTES = new Set([
  "/login",
  "/set-password",
  "/access-denied",
  "/forbidden",
  "/api/health",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/set-password",
]);

const PASSWORD_RESET_ALLOWED_ROUTES = new Set([
  "/set-password",
  "/api/auth/set-password",
  "/api/auth/logout",
  "/api/auth/me",
]);

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });

  return target;
}

function redirectToSetPassword(request: NextRequest, response: NextResponse) {
  const setPasswordUrl = request.nextUrl.clone();
  setPasswordUrl.pathname = "/set-password";
  setPasswordUrl.search = "";
  return copyResponseCookies(response, NextResponse.redirect(setPasswordUrl));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicEnvironment();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const pathname = request.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  if (!claims && pathname.startsWith("/api/") && !isPublicRoute) {
    return NextResponse.json(
      { message: "Authentication required" },
      { status: 401 },
    );
  }

  if (!claims && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";

    return copyResponseCookies(response, NextResponse.redirect(loginUrl));
  }

  if (!claims) {
    return response;
  }

  const authUserId = typeof claims.sub === "string" ? claims.sub : null;
  let employee: Awaited<ReturnType<typeof findEmployeeAuthorization>> = null;

  if (authUserId) {
    try {
      employee = await findEmployeeAuthorization(authUserId);
    } catch (error) {
      console.error("Employee mapping verification failed", error);

      if (isPublicRoute) {
        return response;
      }

      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { message: "Access verification is temporarily unavailable" },
          { status: 503 },
        );
      }

      return new NextResponse("Access verification is temporarily unavailable", {
        status: 503,
      });
    }
  }

  // Another device logged in — invalidate this session and force re-login.
  if (
    employee &&
    authUserId &&
    !sessionEpochMatches(claims, employee.sessionEpoch)
  ) {
    await supabase.auth.signOut({ scope: "local" });

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          message: "บัญชีนี้เข้าใช้งานจากอุปกรณ์อื่นแล้ว",
          code: "SESSION_REPLACED",
        },
        { status: 401 },
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "sessionReplaced=1";
    return copyResponseCookies(response, NextResponse.redirect(loginUrl));
  }

  // Force set-password even on public routes (e.g. /login) after admin reset.
  if (employee?.isActive && employee.mustResetPassword) {
    if (!PASSWORD_RESET_ALLOWED_ROUTES.has(pathname)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { message: "Password reset required", code: "PASSWORD_RESET_REQUIRED" },
          { status: 403 },
        );
      }

      return redirectToSetPassword(request, response);
    }

    return response;
  }

  if (isPublicRoute) {
    return response;
  }

  if (!employee) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { message: "Employee access is not configured" },
        { status: 403 },
      );
    }

    const accessDeniedUrl = request.nextUrl.clone();
    accessDeniedUrl.pathname = "/access-denied";
    accessDeniedUrl.search = "";

    return copyResponseCookies(
      response,
      NextResponse.redirect(accessDeniedUrl),
    );
  }

  if (!employee.isActive) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { message: "Employee account is disabled" },
        { status: 403 },
      );
    }

    const accessDeniedUrl = request.nextUrl.clone();
    accessDeniedUrl.pathname = "/access-denied";
    accessDeniedUrl.search = "";

    return copyResponseCookies(
      response,
      NextResponse.redirect(accessDeniedUrl),
    );
  }

  if (pathname === "/set-password") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return copyResponseCookies(response, NextResponse.redirect(homeUrl));
  }

  if (!employee.role || !employee.role.isActive) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { message: "Insufficient permissions" },
        { status: 403 },
      );
    }

    const forbiddenUrl = request.nextUrl.clone();
    forbiddenUrl.pathname = "/forbidden";
    forbiddenUrl.search = "";
    return copyResponseCookies(response, NextResponse.redirect(forbiddenUrl));
  }

  if (pathname.startsWith("/api/")) {
    const requiredPermission = resolveApiPermission(request.method, pathname);

    if (
      requiredPermission === null ||
      !employeeHasApiPermission(
        employee.role.permissions,
        requiredPermission,
      )
    ) {
      return NextResponse.json(
        { message: "Insufficient permissions" },
        { status: 403 },
      );
    }
  } else if (
    !canAccessPageWithPermissions(employee.role.permissions, pathname)
  ) {
    const forbiddenUrl = request.nextUrl.clone();
    forbiddenUrl.pathname = "/forbidden";
    forbiddenUrl.search = "";

    return copyResponseCookies(response, NextResponse.redirect(forbiddenUrl));
  }

  return response;
}
