"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { applyWeightSuggestionAction, explainScoreAction, type ExplainState } from "@/app/actions";

export default function ScoreExplainer({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState<ExplainState, FormData>(explainScoreAction, null);
  return <div className="aside-card">
    <div className="ai-icon"><Sparkles size={18}/></div>
    <h3>Why this score?</h3>
    <form action={action}><input type="hidden" name="jobId" value={jobId}/><button className="button" type="submit" disabled={pending}>{pending ? "Explaining…" : "Explain this score"}</button></form>
    {state?.error && <p>{state.error}</p>}
    {state?.explanation && <>
      <p>{state.explanation.summary}</p>
      {state.explanation.strengths.length > 0 && <p><strong>Helping:</strong> {state.explanation.strengths.join("; ")}</p>}
      {state.explanation.weaknesses.length > 0 && <p><strong>Hurting:</strong> {state.explanation.weaknesses.join("; ")}</p>}
      {state.explanation.suggestions.map((suggestion) => <form action={applyWeightSuggestionAction} key={suggestion.weightKey}>
        <input type="hidden" name="jobId" value={jobId}/><input type="hidden" name="weightKey" value={suggestion.weightKey}/><input type="hidden" name="suggestedWeight" value={suggestion.suggested}/>
        <p><strong>{suggestion.weightKey}</strong>: {suggestion.current ?? "default"} → {suggestion.suggested}. {suggestion.reason}</p>
        <button className="button" type="submit">Apply and re-score</button>
      </form>)}
    </>}
  </div>;
}
