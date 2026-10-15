"use client";

import { useAuth } from "@clerk/nextjs";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

export default function AuthBanner() {
  const { isSignedIn } = useAuth();

  // Hide banner if user is logged in
  if (isSignedIn) {
    return null;
  }

  return (
    <div className="auth-banner">
      <span>Want to keep your progress?</span>
      <SignInButton mode="modal">
        <button className="auth-banner-button">Sign in</button>
      </SignInButton>
      <span> or </span>
      <SignUpButton mode="modal">
        <button className="auth-banner-button">Create account</button>
      </SignUpButton>
      <span> to save jobs, notes and settings.</span>
    </div>
  );
}

