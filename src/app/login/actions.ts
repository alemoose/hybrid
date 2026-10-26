"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, TZ_COOKIE, passwordMatches, sessionToken } from "@/lib/session";

export type LoginState = { error?: string };

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const tz = String(formData.get("tz") ?? "");
  if (!passwordMatches(password)) {
    return { error: "That password didn't work." };
  }
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(SESSION_COOKIE, sessionToken()!, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  if (tz) {
    jar.set(TZ_COOKIE, tz, { secure, sameSite: "lax", path: "/", maxAge: ONE_YEAR });
  }
  redirect("/");
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
