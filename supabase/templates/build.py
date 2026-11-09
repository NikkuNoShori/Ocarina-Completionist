"""Builds the Supabase Auth email templates in this folder.

Run:  python3 supabase/templates/build.py
Then paste each .html into Supabase -> Authentication -> Emails -> Templates (subjects in README.md).

Email-safe on purpose: tables, inline styles, no external CSS. Cinzel loads in clients that allow web
fonts (Apple Mail, iOS); everyone else gets Georgia.
"""
from pathlib import Path

NIGHT = "#0e1733"      # page background, deep Hylian night blue
ROYAL = "#1b2b63"      # header band
ROYAL2 = "#24387d"
GOLD = "#d4af37"
GOLD_DK = "#a8841f"
SILVER = "#aab4c8"
SILVER_LT = "#dfe4ee"
CARD = "#f7f8fb"
INK = "#1c2440"
MUTED = "#5a6382"
CALLOUT = "#eef1f8"
DISPLAY = "'Cinzel',Georgia,'Times New Roman',serif"
SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"


def ornament(color_line: str, color_gem: str, width: int = 120) -> str:
    """A centered rule with a diamond in the middle:  ──── ◆ ────"""
    line = f'<td width="{width}" style="border-top:1px solid {color_line};font-size:0;line-height:0;">&nbsp;</td>'
    return (f'<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr>{line}'
            f'<td style="padding:0 10px;font-family:{DISPLAY};font-size:12px;line-height:12px;color:{color_gem};">&#9670;</td>'
            f'{line}</tr></table>')


def page(preheader, eyebrow, title, body, button, url, after, why):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:{NIGHT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{NIGHT};">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{NIGHT};">
<tr><td align="center" style="padding:36px 14px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

    <!-- Wordmark -->
    <tr><td align="center" style="padding:0 0 6px;font-family:{DISPLAY};font-size:22px;letter-spacing:4px;text-transform:uppercase;color:{GOLD};font-weight:700;">
      Ocarina Completionist
    </td></tr>
    <tr><td align="center" style="padding:0 0 22px;">{ornament(SILVER, GOLD, 90)}</td></tr>

    <!-- Card: gold outer frame, silver inner frame -->
    <tr><td style="border:2px solid {GOLD};border-radius:10px;padding:4px;background:{NIGHT};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid {SILVER};border-radius:7px;background:{CARD};">

        <!-- Royal header band -->
        <tr><td align="center" style="background:{ROYAL};background-image:linear-gradient(180deg,{ROYAL2},{ROYAL});border-radius:6px 6px 0 0;border-bottom:3px solid {GOLD};padding:30px 28px 26px;">
          <div style="font-family:{SANS};font-size:12px;letter-spacing:3px;text-transform:uppercase;color:{SILVER_LT};font-weight:bold;">&#9670;&nbsp; {eyebrow} &nbsp;&#9670;</div>
          <h1 style="margin:12px 0 0;font-family:{DISPLAY};font-size:26px;line-height:1.3;color:{GOLD};font-weight:700;letter-spacing:.5px;">{title}</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px 0;font-family:{SANS};font-size:16px;line-height:1.65;color:{INK};">
          {body}
        </td></tr>

        <!-- Button -->
        <tr><td align="center" style="padding:28px 32px 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="border-radius:6px;background:{GOLD};background-image:linear-gradient(180deg,#e6c65a,{GOLD} 55%,{GOLD_DK});border:1px solid {GOLD_DK};">
              <a href="{url}" style="display:inline-block;padding:14px 34px;font-family:{DISPLAY};font-size:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:{NIGHT};text-decoration:none;border-radius:6px;">{button}</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td align="center" style="padding:10px 36px 0;font-family:{SANS};font-size:14px;line-height:1.55;color:{MUTED};">{after}</td></tr>

        <!-- Fallback link -->
        <tr><td style="padding:24px 32px 28px;">
          {ornament(SILVER_LT, SILVER, 160)}
          <div style="padding-top:16px;font-family:{SANS};font-size:12px;line-height:1.55;color:{MUTED};text-align:center;">
            Button not working? Copy this link into your browser:<br>
            <a href="{url}" style="color:{ROYAL2};word-break:break-all;">{url}</a>
          </div>
        </td></tr>
      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td align="center" style="padding:22px 12px 0;font-family:{SANS};font-size:12px;line-height:1.6;color:{SILVER};">
      {why}<br>
      <a href="{{{{ .SiteURL }}}}" style="color:{GOLD};text-decoration:none;">Ocarina Completionist</a> is an unofficial fan project, not affiliated with Nintendo.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
'''


def callout(html: str) -> str:
    return (f'<p style="margin:0;padding:14px 16px;background:{CALLOUT};border-left:4px solid {GOLD};'
            f'border-radius:4px;">{html}</p>')


WHO = '{{ if .Data.invited_by }}{{ .Data.invited_by }}{{ else }}A friend{{ end }}'
SAVE = '{{ if .Data.save_name }}&ldquo;{{ .Data.save_name }}&rdquo;{{ else }}their playthrough{{ end }}'

TEMPLATES = {
    "invite.html": dict(
        preheader=f"{WHO} shared {SAVE} with you. Accept to start checking things off.",
        eyebrow="You're invited",
        title=f"{WHO} shared a playthrough with you",
        body=f'''<p style="margin:0 0 16px;">{WHO} invited you to {SAVE} on <b>Ocarina Completionist</b>, a checklist for every Gold Skulltula, Heart Piece, Great Fairy, song and upgrade in Ocarina of Time.</p>
          {callout('{{ if eq .Data.role "viewer" }}You can <b>follow along</b> with their progress.{{ else }}You can <b>check things off together</b>. Changes show up for both of you right away.{{ end }}')}''',
        button="Accept invite", url="{{ .ConfirmationURL }}",
        after="Next you'll pick a name and a password, or skip the password and use Google with this email.",
        why="You got this because someone shared a playthrough with {{ .Email }}. If you weren't expecting it, you can ignore this email."),
    "confirmation.html": dict(
        preheader="Confirm your email to start tracking your playthrough.",
        eyebrow="Almost there", title="Confirm your email",
        body='''<p style="margin:0;">Thanks for signing up for <b>Ocarina Completionist</b>. Confirm your email and your checklists will follow you to every device, with as many save files as you like.</p>''',
        button="Confirm email", url="{{ .ConfirmationURL }}",
        after="This link works once. If it expires, sign in again and we'll send a new one.",
        why="You got this because {{ .Email }} was used to create an account. If that wasn't you, ignore this email."),
    "recovery.html": dict(
        preheader="Reset your Ocarina Completionist password.",
        eyebrow="Password reset", title="Choose a new password",
        body='''<p style="margin:0;">Someone (hopefully you) asked to reset the password for <b>{{ .Email }}</b>. Tap the button and you'll be asked for a new one. Your save files aren't affected.</p>''',
        button="Reset password", url="{{ .ConfirmationURL }}",
        after="This link works once and expires soon. Didn't ask for this? Ignore it; your password stays the same.",
        why="Sent because a password reset was requested for {{ .Email }}."),
    "magic_link.html": dict(
        preheader="Your sign-in link for Ocarina Completionist.",
        eyebrow="Sign in", title="Here's your sign-in link",
        body='''<p style="margin:0;">Tap the button to sign in to <b>Ocarina Completionist</b> as <b>{{ .Email }}</b>.</p>''',
        button="Sign in", url="{{ .ConfirmationURL }}",
        after="This link works once and expires soon.",
        why="Sent because a sign-in link was requested for {{ .Email }}. If that wasn't you, ignore this email."),
    "email_change.html": dict(
        preheader="Confirm the new email for your Ocarina Completionist account.",
        eyebrow="Email change", title="Confirm your new email",
        body='''<p style="margin:0;">Confirm that you want to change your account email from <b>{{ .Email }}</b> to <b>{{ .NewEmail }}</b>.</p>''',
        button="Confirm new email", url="{{ .ConfirmationURL }}",
        after="If you didn't ask for this, ignore this email and nothing will change.",
        why="Sent because an email change was requested for {{ .Email }}."),
}

# Sent by the share-save edge function (not by Supabase Auth) when you share with someone who already
# has an account. The function fills in %%INVITER%%, %%SAVE%%, %%ROLE_LINE%%, %%URL%% and %%EMAIL%%,
# HTML-escaping each value first.
SHARE_EMAIL = dict(
    preheader="%%INVITER%% shared &ldquo;%%SAVE%%&rdquo; with you on Ocarina Completionist.",
    eyebrow="New shared playthrough",
    title="%%INVITER%% shared a playthrough with you",
    body=f'''<p style="margin:0 0 16px;">%%INVITER%% shared &ldquo;<b>%%SAVE%%</b>&rdquo; with you. It's waiting under <b>Shared with you</b> in your Account panel.</p>
          {callout("%%ROLE_LINE%%")}''',
    button="Open the playthrough", url="%%URL%%",
    after="Sign in with the same account you use now and pick it from Account &rarr; Shared with you.",
    why="You got this because someone shared a playthrough with %%EMAIL%%. If you don't want it, open Account and choose Leave.")


def minify(html: str) -> str:
    """Collapse whitespace between tags so the result is easy to paste."""
    import re
    html = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    return re.sub(r">\s+<", "><", re.sub(r"\n\s*", "\n", html)).strip() + "\n"


if __name__ == "__main__":
    here = Path(__file__).parent
    for name, t in TEMPLATES.items():
        (here / name).write_text(page(**t))
        print("wrote", name)
    share = page(**SHARE_EMAIL).replace("{{ .SiteURL }}", "%%SITE%%")
    fn = here.parent / "functions" / "share-save" / "email.ts"
    fn.parent.mkdir(parents=True, exist_ok=True)
    fn.write_text("// Generated by supabase/templates/build.py. Don't edit by hand.\n"
                  "export const SHARE_EMAIL_HTML = " + __import__("json").dumps(minify(share)) + ";\n")
    print("wrote", fn)
