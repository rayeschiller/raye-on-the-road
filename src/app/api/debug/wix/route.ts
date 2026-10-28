import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Diagnostics only: form names, field keys/labels, and submission counts. Never returns answer values. */
export async function GET() {
  const key = process.env.WIX_API_KEY;
  const site = process.env.WIX_SITE_ID;
  if (!key || !site) return NextResponse.json({ error: "not configured" });
  const h = { Authorization: key, "wix-site-id": site, "Content-Type": "application/json" };
  const out: Record<string, unknown> = {};
  for (const enabled of ["true", "false"]) {
    const r = await fetch(`https://www.wixapis.com/form-schema-service/v4/forms?namespace=wix.form_app.form&enabled=${enabled}&paging.limit=100`, { headers: h, cache: "no-store" });
    const t = await r.text();
    let j: { forms?: { id: string; name?: string; formFields?: unknown[]; fields?: unknown[] }[] } = {};
    try { j = JSON.parse(t); } catch {}
    out[`forms_enabled_${enabled}`] = r.ok
      ? (j.forms || []).map((f) => ({
          id: f.id,
          name: f.name,
          fields: ((f.formFields || f.fields || []) as Record<string, unknown>[]).map((fld) => {
            const io = (fld.inputOptions || {}) as Record<string, unknown>;
            const so = (io.stringOptions || {}) as Record<string, unknown>;
            const ti = (so.textInputOptions || {}) as Record<string, unknown>;
            return { target: io.target || fld.target, label: ti.label || (fld as Record<string, unknown>).label, type: io.inputType || fld.fieldType };
          }),
        }))
      : { status: r.status, body: t.slice(0, 300) };
  }
  const s = await fetch("https://www.wixapis.com/form-submission-service/v4/submissions/namespace/query", {
    method: "POST", headers: h, cache: "no-store",
    body: JSON.stringify({ query: { filter: { namespace: "wix.form_app.form" }, cursorPaging: { limit: 50 } } }),
  });
  const st = await s.text();
  let sj: { submissions?: { formId: string; contactId?: string; submissions?: Record<string, unknown> }[]; metadata?: unknown } = {};
  try { sj = JSON.parse(st); } catch {}
  out.submissions = s.ok
    ? {
        page: (sj.submissions || []).length,
        metadata: sj.metadata,
        perForm: Object.entries((sj.submissions || []).reduce<Record<string, number>>((a, x) => { a[x.formId] = (a[x.formId] || 0) + 1; return a; }, {})),
        keysSeen: [...new Set((sj.submissions || []).flatMap((x) => Object.keys(x.submissions || {})))],
        withContactId: (sj.submissions || []).filter((x) => x.contactId).length,
      }
    : { status: s.status, body: st.slice(0, 300) };
  // Walk every page: total submissions and how many have a non-empty city answer
  let total = 0, withCity = 0, pages = 0, cursor: string | undefined;
  const statuses: Record<string, number> = {};
  for (;;) {
    const body = cursor ? { query: { cursorPaging: { limit: 100, cursor } } } : { query: { filter: { namespace: "wix.form_app.form" }, cursorPaging: { limit: 100 } } };
    const rr = await fetch("https://www.wixapis.com/form-submission-service/v4/submissions/namespace/query", { method: "POST", headers: h, cache: "no-store", body: JSON.stringify(body) });
    if (!rr.ok) { out.walkError = rr.status; break; }
    const jj = (await rr.json()) as { submissions?: { status?: string; submissions?: Record<string, unknown> }[]; metadata?: { hasNext?: boolean; cursors?: { next?: string } } };
    pages++;
    for (const x of jj.submissions || []) {
      total++;
      statuses[x.status || "?"] = (statuses[x.status || "?"] || 0) + 1;
      const v = x.submissions?.what_city_should_i_come_to_next;
      if (typeof v === "string" && v.trim()) withCity++;
    }
    if (!jj.metadata?.hasNext || !jj.metadata.cursors?.next || pages > 100) break;
    cursor = jj.metadata.cursors.next;
  }
  out.walk = { pages, total, withCity, statuses };
  // Contact extended field keys (custom fields often hold a "city" answer)
  const c = await fetch("https://www.wixapis.com/contacts/v4/contacts/query", { method: "POST", headers: h, cache: "no-store", body: JSON.stringify({ query: { paging: { limit: 200 }, fields: ["info.extendedFields", "info.addresses"] } }) });
  const ct = await c.text();
  let cj: { contacts?: { info?: { extendedFields?: { items?: Record<string, unknown> }; addresses?: { items?: unknown[] } } }[] } = {};
  try { cj = JSON.parse(ct); } catch {}
  const counts: Record<string, number> = {};
  for (const x of cj.contacts || []) for (const k of Object.keys(x.info?.extendedFields?.items || {})) counts[k] = (counts[k] || 0) + 1;
  out.contactExtendedFieldKeys = counts;
  out.contactsWithAddress = (cj.contacts || []).filter((x) => (x.info?.addresses?.items || []).length).length;
  return NextResponse.json(out);
}
