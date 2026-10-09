import { clerkMiddleware } from "@clerk/nextjs/server";

// Keep Clerk middleware active so Clerk cookies and auth state are parsed,
// but do NOT force protection on public pages. Saving and other write
// operations remain protected server-side via `requireAppUser()`.

// No-op middleware: initialize Clerk but don't call auth.protect() globally.
// This allows anonymous users to browse the app. Server actions that write
// data already call `requireAppUser()` and will continue to require sign-in.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Match app routes (including `/`) while skipping static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
