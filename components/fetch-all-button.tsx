"use client";

import { useActionState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { fetchAllSourcesAction, type FetchAllState } from "@/app/actions";

export default function FetchAllButton({ canFetch, isLoggedIn }: { canFetch: boolean; isLoggedIn: boolean }) {
  const [state, formAction, pending] = useActionState<FetchAllState, FormData>(fetchAllSourcesAction, {});
  if (!canFetch) return <div className="fetch-all">
    <button className="button button-secondary" type="button" disabled><RefreshCw size={15}/> Fetch all sources</button>
    <p className="muted">{isLoggedIn ? <><Link href="/billing">Upgrade to Pro</Link> to refresh every source on demand instead of waiting for the twice-daily run.</> : <><Link href="/signin">Sign in</Link> with a Pro plan to refresh every source on demand.</>}</p>
  </div>;
  return <form action={formAction} className="fetch-all">
    <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}><RefreshCw size={15} className={pending ? "spin" : undefined}/> {pending ? "Fetching…" : "Fetch all sources"}</button>
    {pending && <p className="muted">Fetching every enabled source. This can take a minute.</p>}
    {state.summary && <p className="success-banner" role="status">{state.summary}</p>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}
