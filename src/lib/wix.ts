import type { WixPerson } from "./types";

const BASE = "https://www.wixapis.com";

function headers() {
  const key = process.env.WIX_API_KEY;
  const site = process.env.WIX_SITE_ID;
  if (!key || !site) throw new Error("Wix is not connected: set WIX_API_KEY and WIX_SITE_ID.");
  return { Authorization: key, "wix-site-id": site, "Content-Type": "application/json" };
}

export function wixConfigured() {
  return Boolean(process.env.WIX_API_KEY && process.env.WIX_SITE_ID);
}

async function wixPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wix ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

async function wixGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wix ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

type WixContact = {
  id: string;
  createdDate?: string;
  primaryInfo?: { email?: string };
  primaryEmail?: { email?: string; subscriptionStatus?: string };
  info?: {
    name?: { first?: string; last?: string };
    emails?: { items?: { email?: string; primary?: boolean }[] };
    extendedFields?: { items?: Record<string, unknown> };
  };
};

async function fetchContacts(): Promise<WixContact[]> {
  const out: WixContact[] = [];
  let offset = 0;
  for (;;) {
    const r = await wixPost<{ contacts: WixContact[]; pagingMetadata?: { count?: number } }>("/contacts/v4/contacts/query", {
      query: { paging: { limit: 1000, offset }, fields: ["createdDate", "primaryInfo", "info.name", "info.emails", "info.extendedFields"] },
    });
    out.push(...(r.contacts || []));
    if (!r.contacts || r.contacts.length < 1000) break;
    offset += 1000;
    if (offset > 50000) break;
  }
  return out;
}

type WixForm = {
  id: string;
  name?: string;
  fields?: { target?: string; inputOptions?: { target?: string; stringOptions?: { textInputOptions?: { label?: string } } } }[];
  formFields?: { target?: string; inputOptions?: { target?: string; stringOptions?: { textInputOptions?: { label?: string } } } }[];
};

type WixSubmission = {
  id: string;
  formId: string;
  contactId?: string;
  createdDate?: string;
  status?: string;
  submissions?: Record<string, unknown>;
};

async function fetchForms(): Promise<WixForm[]> {
  const forms: WixForm[] = [];
  for (const enabled of ["true", "false"]) {
    try {
      const r = await wixGet<{ forms: WixForm[] }>(`/form-schema-service/v4/forms?namespace=wix.form_app.form&enabled=${enabled}&paging.limit=100`);
      forms.push(...(r.forms || []));
    } catch {
      /* Forms app may not be installed; contacts still work */
    }
  }
  return forms;
}

async function fetchSubmissions(): Promise<WixSubmission[]> {
  const out: WixSubmission[] = [];
  let cursor: string | undefined;
  for (;;) {
    const body = cursor
      ? { query: { cursorPaging: { limit: 100, cursor } } }
      : { query: { filter: { namespace: "wix.form_app.form" }, sort: [{ fieldName: "createdDate", order: "DESC" }], cursorPaging: { limit: 100 } } };
    let r: { submissions?: WixSubmission[]; metadata?: { hasNext?: boolean; cursors?: { next?: string } } };
    try {
      r = await wixPost("/form-submission-service/v4/submissions/namespace/query", body);
    } catch (e) {
      if (out.length) break;
      // Forms not installed or no permission: treat as no submissions
      console.warn("Wix submissions unavailable:", (e as Error).message);
      return [];
    }
    out.push(...(r.submissions || []));
    if (!r.metadata?.hasNext || !r.metadata.cursors?.next) break;
    cursor = r.metadata.cursors.next;
    if (out.length > 20000) break;
  }
  return out;
}

const CITY_LABEL = /(city|where|town|tour|location|come|bring|near|live)/i;
const EMAIL_KEY = /email/i;
const NAME_KEY = /(first|last|name)/i;

/**
 * Pulls every Wix contact plus the city answer from your signup form.
 * The city comes from Wix Forms submissions (matched by contactId, then by email).
 */
export async function fetchWixPeople(): Promise<WixPerson[]> {
  const [contacts, forms, submissions] = await Promise.all([fetchContacts(), fetchForms(), fetchSubmissions()]);

  // Which submission keys look like a "city" question, per form
  const cityKeys = new Map<string, Set<string>>();
  for (const f of forms) {
    const fields = f.fields || f.formFields || [];
    const keys = new Set<string>();
    for (const fld of fields) {
      const target = fld.inputOptions?.target || fld.target;
      const label = fld.inputOptions?.stringOptions?.textInputOptions?.label || "";
      if (target && (CITY_LABEL.test(label) || CITY_LABEL.test(target))) keys.add(target);
    }
    cityKeys.set(f.id, keys);
  }

  // Latest city answer per contactId / per email
  const byContact = new Map<string, { answer: string; at: string | null }>();
  const byEmail = new Map<string, { answer: string; at: string | null }>();
  for (const s of submissions) {
    const vals = s.submissions || {};
    const keys = cityKeys.get(s.formId);
    let answer = "";
    if (keys && keys.size) {
      for (const k of keys) {
        const v = vals[k];
        if (typeof v === "string" && v.trim()) { answer = v.trim(); break; }
      }
    }
    if (!answer) {
      // Fallback: first short free-text answer that isn't an email/name field
      for (const [k, v] of Object.entries(vals)) {
        if (EMAIL_KEY.test(k) || NAME_KEY.test(k)) continue;
        if (typeof v === "string" && v.trim() && v.length <= 80 && !v.includes("@")) {
          if (CITY_LABEL.test(k) || keys === undefined || keys.size === 0) { answer = v.trim(); break; }
        }
      }
    }
    if (!answer) continue;
    const at = s.createdDate || null;
    const rec = { answer, at };
    if (s.contactId && !byContact.has(s.contactId)) byContact.set(s.contactId, rec); // submissions sorted DESC → first = latest
    for (const [k, v] of Object.entries(vals)) {
      if (EMAIL_KEY.test(k) && typeof v === "string" && v.includes("@")) {
        const e = v.trim().toLowerCase();
        if (!byEmail.has(e)) byEmail.set(e, rec);
      }
    }
  }

  const people: WixPerson[] = [];
  for (const c of contacts) {
    const email = (c.primaryInfo?.email || c.primaryEmail?.email || c.info?.emails?.items?.find((e) => e.primary)?.email || c.info?.emails?.items?.[0]?.email || "")
      .trim()
      .toLowerCase();
    if (!email) continue;
    const ans = byContact.get(c.id) || byEmail.get(email);
    people.push({
      contactId: c.id,
      email,
      firstName: c.info?.name?.first || "",
      lastName: c.info?.name?.last || "",
      subscriptionStatus: (c.primaryEmail?.subscriptionStatus as WixPerson["subscriptionStatus"]) || "NOT_SET",
      createdAt: c.createdDate || null,
      cityAnswer: ans?.answer || "",
      answeredAt: ans?.at || null,
    });
  }
  return people;
}
