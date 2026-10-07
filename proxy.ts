import { auth } from "./auth";
import { NextResponse } from "next/server";

export default auth((request) => {
  if (!request.auth && request.nextUrl.pathname !== "/signin") {
    return NextResponse.redirect(new URL("/signin", request.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|signin|_next/static|_next/image|favicon.ico).*)"],
};
