import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return <main className="signin-page"><section className="signin-card"><div className="brand-mark">JR</div><p className="eyebrow">PERSONAL JOB RADAR</p><h1>Find work worth your time.</h1><p className="muted">Sign in or create your account to review jobs matched to your profile.</p><SignIn routing="hash" /></section></main>;
}
