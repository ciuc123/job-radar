"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { analyzeJobAction, type AnalyzeJobState } from "@/app/actions";

export default function AnalyzeFitButton({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState<AnalyzeJobState, FormData>(analyzeJobAction, {});
  return <form action={formAction} className="analyze-fit-form">
    <input type="hidden" name="jobId" value={jobId}/>
    <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}><Sparkles size={16}/> {pending ? "Analyzing…" : "Analyze fit"}</button>
    {pending && <p className="muted">Reading the listing against your profile. This usually takes 5–15 seconds.</p>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}
