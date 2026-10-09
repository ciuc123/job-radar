import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import SiteHeader from "@/components/site-header";
import { getCurrentAppUser, hasPaidFeature } from "@/lib/app-user";
import { saveNotificationSettingsAction, saveProfileAction } from "@/app/actions";
import { defaultProfile } from "@/lib/profile";
import { getScoringProfile, hasDatabase } from "@/lib/repository/jobs";
import { db } from "@/db";
import { notificationSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
const join = (items: string[]) => items.join(", ");

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ updated?: string; notifications?: string }> }) {
  const user = await getCurrentAppUser();
  const canUseEmail = await hasPaidFeature("email_alerts");
  const profile = await getScoringProfile(user?.id);
  const editable = hasDatabase();
  const { updated, notifications } = await searchParams;
  const notification = db && user?.id ? (await db.select().from(notificationSettings).where(eq(notificationSettings.userId, user.id)).limit(1))[0] : undefined;
  return <main className="app-shell settings-shell">
    <SiteHeader userName={user?.name ?? "Developer"} isAdmin={user?.role === "admin"} backHref="/" backLabel={<><ArrowLeft size={16}/> Dashboard</>} />
    <section className="settings-content"><p className="eyebrow">YOUR PROFILE</p><h1>Scoring preferences</h1><p className="muted">Backend roles enter your pipeline. PHP + Laravel backend roles are worth reviewing. Strong matches also need to be fully remote and meet your salary floor.</p>
      {updated && <div className="success-banner">Preferences saved.</div>}{!editable && <div className="demo-notice">Demo mode: preferences are shown but saving requires Neon.</div>}
      <form action={saveProfileAction} className="settings-form">
        <fieldset disabled={!editable}><legend>Experience</legend>
          <label>Profile headline<input name="headline" defaultValue={profile.headline}/></label>
          <label>Years of experience<input type="number" min="0" max="60" name="experienceYears" defaultValue={profile.experienceYears}/></label>
          <label>Experience summary<textarea name="experienceSummary" defaultValue={profile.experienceSummary}/></label>
          <label>Preferred job titles <small>Comma-separated</small><textarea name="preferredTitles" defaultValue={join(profile.preferredTitles)}/></label>
        </fieldset>
        <fieldset disabled={!editable}><legend>Skills</legend>
          <label>Strong skills <small>Comma-separated</small><textarea name="strongSkills" defaultValue={join(profile.strongSkills)}/></label>
          <label>Secondary skills <small>Comma-separated</small><textarea name="secondarySkills" defaultValue={join(profile.secondarySkills)}/></label>
        </fieldset>
        <fieldset disabled={!editable}><legend>Location and work type</legend>
          <label>Preferred locations <small>Comma-separated</small><textarea name="preferredLocations" defaultValue={join(profile.preferredLocations)}/></label>
          <label>Excluded locations/signals <small>Comma-separated</small><textarea name="excludedLocations" defaultValue={join(profile.excludedLocations)}/></label>
          <label>Preferred employment types <small>Comma-separated</small><textarea name="preferredEmploymentTypes" defaultValue={join(profile.preferredEmploymentTypes)}/></label>
          <label>Negative signals <small>Comma-separated. Removing a default negative signal removes its built-in penalty.</small><textarea name="negativeSignals" defaultValue={join(profile.negativeSignals)}/></label>
          <label>Minimum salary for a strong match (same numeric scale as the listing; leave blank to disable the salary gate)<input type="number" min="0" name="salaryMinimum" defaultValue={profile.salaryMinimum ?? ""}/></label>
        </fieldset>
        <fieldset disabled={!editable}><legend>Recommendation thresholds</legend><div className="threshold-grid">
          <label>Strong / Apply from<input type="number" min="0" max="100" name="applyThreshold" defaultValue={profile.thresholds.apply ?? defaultProfile.thresholds.apply}/></label>
          <label>Review from<input type="number" min="0" max="100" name="reviewThreshold" defaultValue={profile.thresholds.review ?? defaultProfile.thresholds.review}/></label>
          <label>Pipeline from<input type="number" min="0" max="100" name="maybeThreshold" defaultValue={profile.thresholds.maybe ?? defaultProfile.thresholds.maybe}/></label>
        </div><label>Scoring weight overrides <small>Optional JSON map. Keys include PHP, Laravel, senior, location.europe, employment.contract, juniorPenalty.</small><textarea name="scoreWeights" defaultValue={JSON.stringify(profile.scoreWeights, null, 2)}/></label></fieldset>
        {editable && <button className="button button-primary" type="submit"><Save size={15}/> Save preferences</button>}
      </form>
      <section className="settings-form"><fieldset disabled={!editable || !canUseEmail}><legend>Notifications</legend>{notifications && <div className="success-banner">Notification preferences saved.</div>}<p className="muted">Daily email summarizes recent matches. Immediate email alerts are checked by the scheduled fetch. Configure Resend in GitHub Actions to deliver them. {!canUseEmail && <>Email alerts are a Pro feature. <Link href="/billing">View plans.</Link></>}</p><form action={saveNotificationSettingsAction}><label><input type="checkbox" name="dailyDigestEnabled" defaultChecked={notification?.dailyDigestEnabled ?? false}/> Enable daily digest</label><label><input type="checkbox" name="immediateEnabled" defaultChecked={notification?.immediateEnabled ?? false}/> Immediate alerts for new high scoring jobs</label><label>Minimum score<input name="immediateThreshold" type="number" min="50" max="100" defaultValue={notification?.immediateThreshold ?? 92}/></label>{editable && canUseEmail && <button className="button button-primary">Save notifications</button>}</form></fieldset></section>
    </section>
  </main>;
}
