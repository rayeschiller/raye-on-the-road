/**
 * The "you made it on the list" welcome email, sent from hello@rayeschiller.com via Resend
 * to everyone who signs up on rayeschiller.com. See src/lib/welcomeSync.ts for how signups are found.
 */

export const WELCOME_SUBJECT = "you made it on the list! <3";
export const WELCOME_PREHEADER = "tysm for subscribing, friend. Reply and tell me a secret.";

/** Circular beach photo (already hosted publicly on Wix's media CDN). */
const PHOTO_URL =
  "https://static.wixstatic.com/media/aa06e5_6ba6b1afd7ae4f6a98de00466236cc13~mv2.png/v1/fit/w_508,h_2000,al_c,q_85/aa06e5_6ba6b1afd7ae4f6a98de00466236cc13~mv2.png";

/** "say hey!" links in the footer. Leave a url empty to hide that icon. */
export const SOCIALS: { label: string; url: string }[] = [
  { label: "Instagram", url: "https://www.instagram.com/rayeschiller" },
  { label: "Facebook", url: "https://www.facebook.com/rayeschillercomedy" },
  { label: "YouTube", url: "" },
  { label: "TikTok", url: "" },
];

const CREAM = "#FDF3E1";
const NAVY = "#1B2A6B";
const FONT = "Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderWelcome(opts: { siteUrl: string; unsubUrl: string; address?: string }) {
  const { siteUrl, unsubUrl, address } = opts;
  const sig = `${siteUrl.replace(/\/$/, "")}/email/signature.png`;
  const socials = SOCIALS.filter((s) => s.url);
  const socialLinks = socials
    .map((s) => `<a href="${esc(s.url)}" style="color:${NAVY};text-decoration:underline;font-weight:600">${esc(s.label)}</a>`)
    .join(`<span style="color:${NAVY};opacity:.4">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`);

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>${esc(WELCOME_SUBJECT)}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${CREAM}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CREAM}">${esc(WELCOME_PREHEADER)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM}">
<tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${CREAM};border:3px solid #030303">
    <tr><td style="padding:40px 36px 8px">
      <img src="${PHOTO_URL}" width="200" height="200" alt="Raye at the beach" style="display:block;width:200px;height:200px;border:0;border-radius:50%">
    </td></tr>
    <tr><td style="padding:24px 36px 0;font-family:${FONT};color:${NAVY};font-size:22px;line-height:30px;font-weight:700">You made it on the list! &lt;3</td></tr>
    <tr><td style="padding:16px 36px 0;font-family:${FONT};color:${NAVY};font-size:32px;line-height:40px;font-weight:700">Hi friend! tysm for subscribing!</td></tr>
    <tr><td style="padding:24px 36px 0;font-family:${FONT};color:${NAVY};font-size:16px;line-height:25px">
      I can't wait to see you when I'm in your city.<br><br>
      fyi I love getting messages and read every single one! Reply to this and let me know what you want to see, what's your favorite joke, or tell me a secret? Love you!
    </td></tr>
    <tr><td style="padding:28px 36px 36px">
      <img src="${sig}" width="190" alt="-Raye &lt;3" style="display:block;width:190px;height:auto;border:0;font-family:${FONT};color:${NAVY};font-size:28px">
    </td></tr>
    ${socials.length ? `<tr><td style="padding:0 36px 32px;font-family:${FONT};color:${NAVY};font-size:14px;line-height:22px"><span style="font-weight:700">say hey!</span>&nbsp;&nbsp;${socialLinks}</td></tr>` : ""}
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
    <tr><td align="center" style="padding:16px 12px 8px;font-family:${FONT};color:${NAVY};opacity:.65;font-size:11px;line-height:17px">
      You're getting this because you signed up at rayeschiller.com.${address ? `<br>${esc(address)}` : ""}<br>
      <a href="${esc(unsubUrl)}" style="color:${NAVY};text-decoration:underline">Unsubscribe</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const socialText = socials.length ? `\n\nsay hey! ${socials.map((s) => `${s.label}: ${s.url}`).join(" | ")}` : "";
  const text = `You made it on the list! <3

Hi friend! tysm for subscribing!

I can't wait to see you when I'm in your city.

fyi I love getting messages and read every single one! Reply to this and let me know what you want to see, what's your favorite joke, or tell me a secret? Love you!

-Raye <3${socialText}

—
You're getting this because you signed up at rayeschiller.com.${address ? `\n${address}` : ""}
Unsubscribe: ${unsubUrl}`;

  return { html, text };
}
