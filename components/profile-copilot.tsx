import { Sparkles } from "lucide-react";
import { acceptProfileDraftAction, discardProfileDraftAction, generateProfileDraftAction } from "@/app/actions";
import { MAX_CV_CHARS, getProfileDraft } from "@/lib/ai/profile-copilot";

const messages: Record<string, { tone: "success-banner" | "demo-notice"; text: string }> = {
  drafted: { tone: "success-banner", text: "Draft ready. Review it below before applying." },
  accepted: { tone: "success-banner", text: "Profile applied and your jobs were re-scored." },
  discarded: { tone: "success-banner", text: "Draft discarded." },
  consent: { tone: "demo-notice", text: "Please confirm that you agree to send your CV text to the AI provider." },
  invalid: { tone: "demo-notice", text: "Paste a few paragraphs of your CV or LinkedIn profile (at most 20,000 characters)." },
  limit: { tone: "demo-notice", text: "You reached this month's AI limit. It resets next month." },
  refused: { tone: "demo-notice", text: "The AI provider declined this request. Try different text." },
  missing: { tone: "demo-notice", text: "There is no draft to apply. Generate one first." },
  error: { tone: "demo-notice", text: "The draft could not be generated. Try again later." },
};

export default async function ProfileCopilot({ userId, status }: { userId: string; status?: string }) {
  const draft = await getProfileDraft(userId);
  const message = status ? messages[status] : undefined;
  return <section className="settings-form ai-panel">
    <fieldset><legend><Sparkles size={14}/> AI profile assistant</legend>
      {message && <div className={message.tone}>{message.text}</div>}
      {draft ? <div className="ai-draft">
        <p className="muted">Review this draft. Nothing changes until you apply it, and you can still edit every field afterwards.</p>
        <p><strong>{draft.profile.headline}</strong> · {draft.profile.experienceYears} years</p>
        <p><strong>Core skills:</strong> {draft.profile.strongSkills.join(", ") || "None"}</p>
        <p><strong>Also relevant:</strong> {draft.profile.secondarySkills.join(", ") || "None"}</p>
        <p><strong>Roles to match:</strong> {draft.profile.rubric?.roleFamilies.map((family) => `${family.name} (${family.titlePatterns.join(", ")})`).join("; ") || "Not set"}</p>
        <p><strong>Review tier requires:</strong> {draft.profile.rubric?.mustHaveSkills.join(" + ") || "Role match only"}</p>
        {draft.rationale && <p className="muted">{draft.rationale}</p>}
        <div className="ai-draft-actions">
          <form action={acceptProfileDraftAction}><button className="button button-primary" type="submit">Apply draft</button></form>
          <form action={discardProfileDraftAction}><button className="button" type="submit">Discard</button></form>
        </div>
      </div> : <form action={generateProfileDraftAction}>
        <p className="muted">Paste your CV or LinkedIn text and get a draft profile and scoring rules tailored to your stack. Your text is sent to the AI provider once to build the draft and is not stored.</p>
        <label>CV or LinkedIn text<textarea name="cv" rows={8} maxLength={MAX_CV_CHARS} required/></label>
        <label className="checkbox-label"><input type="checkbox" name="consent"/> I agree to send this text to the AI provider to generate my draft.</label>
        <button className="button button-primary" type="submit"><Sparkles size={15}/> Generate draft</button>
      </form>}
    </fieldset>
  </section>;
}
