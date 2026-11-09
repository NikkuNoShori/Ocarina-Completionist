/** Privacy policy and terms, shown inside the app (so they get the header, theme and ⋮ menu). */
export type LegalId = "privacy" | "terms";
export const LEGAL_TITLES: Record<LegalId, string> = { privacy: "Privacy Policy", terms: "Terms of Service" };
const CONTACT = "nickneal17@gmail.com";
const UPDATED = "November 8, 2026";

export function LegalPage({ id }: { id: LegalId }) {
  return (
    <article className="legal">
      <p className="sub">Ocarina Completionist · Last updated {UPDATED}</p>
      {id === "privacy" ? <Privacy /> : <Terms />}
      <h2>Contact</h2>
      <p><a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </article>
  );
}

function Privacy() {
  return <>
    <p>Ocarina Completionist is a free fan-made checklist for The Legend of Zelda: Ocarina of Time. This page explains what information the site keeps and why.</p>
    <h2>Without an account</h2>
    <p>If you don't sign in, your checkmarks and edits are stored only in your own browser (local storage). Nothing is sent to us.</p>
    <h2>With an account</h2>
    <p>When you sign in with Google or with an email and password, we receive and store:</p>
    <ul>
      <li>Your email address and, for Google sign-in, your name and profile picture as provided by Google.</li>
      <li>Your save files: which checklist items you've collected, any edits you make, and your display settings (theme, light/dark mode, spacing).</li>
      <li>Who you've shared a save file with, and the email addresses you've invited.</li>
      <li>Technical error reports (what failed, the page address and your browser type) so we can fix problems.</li>
    </ul>
    <p>We use this only to sign you in, keep your progress in sync across devices, let you share save files with people you choose, and fix errors. We don't sell your information, show ads, or use it for anything else.</p>
    <h2>Google user data</h2>
    <p>We request only the basic Google sign-in scopes (openid, email and profile). We use them solely to identify your account. We don't access your Gmail, Drive, contacts or any other Google data. Our use of information received from Google APIs follows the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener">Google API Services User Data Policy</a>, including its Limited Use requirements.</p>
    <h2>Who can see your data</h2>
    <p>Only you, plus anyone you share a save file with (and only that save file). People you invite see your email address and display name. Data is stored with our hosting providers, <a href="https://supabase.com/privacy" target="_blank" rel="noopener">Supabase</a> (database and sign-in) and <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener">Vercel</a> (website hosting).</p>
    <h2>Deleting your data</h2>
    <p>You can delete any save file, or your whole account and everything linked to it, from the Account panel at any time. You can also email us and we'll remove it.</p>
    <h2>Changes</h2>
    <p>If this policy changes, we'll update the date at the top of this page.</p>
  </>;
}

function Terms() {
  return <>
    <p>By using Ocarina Completionist you agree to these terms.</p>
    <h2>The service</h2>
    <p>Ocarina Completionist is a free fan-made checklist provided as is, without warranties of any kind. Checklist details are gathered from public guides and may contain mistakes. We may change or stop the service at any time.</p>
    <h2>Your account</h2>
    <p>You're responsible for activity on your account. Only share save files with people you trust; anyone you give edit access can change that save file.</p>
    <h2>Acceptable use</h2>
    <p>Don't misuse the service, try to access other people's data, or interfere with how it runs. We may suspend accounts that do.</p>
    <h2>Not affiliated with Nintendo</h2>
    <p>The Legend of Zelda and Ocarina of Time are trademarks of Nintendo. This site is an unofficial fan project and isn't affiliated with or endorsed by Nintendo. Linked guides belong to their respective owners.</p>
    <h2>Liability</h2>
    <p>To the extent the law allows, we aren't liable for any loss arising from use of the service, including lost progress.</p>
  </>;
}
