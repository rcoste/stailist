import { NextResponse, type NextRequest } from "next/server";
import { VIEW_AS_COOKIE } from "@/lib/auth";

// Sale del modo "ver como": borra la cookie y regresa al admin de usuarios.
export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/admin/usuarios", request.url));
  res.cookies.set(VIEW_AS_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
