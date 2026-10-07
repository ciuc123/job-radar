import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <main className="signin-page">
      <section className="signin-card">
        <div className="brand-mark">JR</div>
        <p className="eyebrow">PERSONAL JOB RADAR</p>
        <h1>Find work worth your time.</h1>
        <p className="muted">Sign in with the Google account allowed for this private dashboard.</p>
        <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
          <button className="button button-primary full-width" type="submit">Continue with Google</button>
        </form>
      </section>
    </main>
  );
}
