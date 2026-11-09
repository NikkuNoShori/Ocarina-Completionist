# Supabase Auth email templates

Paste each file into **Supabase Dashboard → Authentication → Emails → Templates**, with the subject below.
They use Supabase's template variables (`{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .Data.* }}`), so paste them as-is.

| Template in Supabase | File | Subject |
|---|---|---|
| Invite user | `invite.html` | `{{ if .Data.invited_by }}{{ .Data.invited_by }} shared a playthrough with you{{ else }}You're invited to Ocarina Completionist{{ end }}` |
| Confirm signup | `confirmation.html` | `Confirm your email for Ocarina Completionist` |
| Reset password | `recovery.html` | `Reset your Ocarina Completionist password` |
| Magic link | `magic_link.html` | `Your Ocarina Completionist sign-in link` |
| Change email address | `email_change.html` | `Confirm your new email for Ocarina Completionist` |

The invite email reads `invited_by`, `save_name` and `role` from the invite's data, which the `share-save`
edge function fills in. Invites sent from the Supabase dashboard don't have that data, so the email falls back to
"A friend" / "their playthrough".
