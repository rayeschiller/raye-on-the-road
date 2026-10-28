"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Campaign, CampaignFilter, Person, Place } from "@/lib/types";
import type { DataStatus } from "@/lib/people";
import { clusterByCity, type CityCluster } from "./MapView";
import CityPicker from "./CityPicker";
import { distanceMiles } from "@/lib/geo";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="h-[460px] rounded-2xl bg-[#f3eef0] animate-pulse" /> });

type Tab = "explore" | "cities" | "emails" | "needs" | "settings";

type Data = { people: Person[]; status: DataStatus; campaigns: Campaign[]; generatedAt: string };

const fmt = (n: number) => n.toLocaleString("en-US");
const timeAgo = (iso: string | null) => {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`;
  return `${Math.round(s / 86400)} days ago`;
};

function placeOf(c: CityCluster): Place {
  return { city: c.city, region: c.region, country: c.country, lat: c.lat, lon: c.lon };
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("explore");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [center, setCenter] = useState<Place | null>(null);
  const [radius, setRadius] = useState(25);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const r = await fetch(`/api/data${force ? "?refresh=1" : ""}`, { cache: "no-store" });
      if (r.status === 401) {
        window.location.href = "/login";
        return;
      }
      setData(await r.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const people = useMemo(() => data?.people ?? [], [data]);
  const clusters = useMemo(() => clusterByCity(people), [people]);
  const stats = useMemo(() => {
    const onMap = people.filter((p) => p.lat != null).length;
    const eligible = people.filter((p) => p.emailEligible).length;
    const countries = new Set(people.filter((p) => p.country).map((p) => p.country)).size;
    const needs = people.filter((p) => p.lat == null).length;
    return { onMap, eligible, countries, needs };
  }, [people]);

  const nearby = useMemo(() => {
    if (!center) return [];
    return people
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => ({ p, d: distanceMiles(center.lat, center.lon, p.lat!, p.lon!) }))
      .filter((x) => x.d <= radius)
      .sort((a, b) => a.d - b.d);
  }, [people, center, radius]);

  const pickCity = useCallback((c: CityCluster) => {
    setCenter(placeOf(c));
    setTab("explore");
  }, []);

  function startEmail(filter?: Partial<CampaignFilter>) {
    const f: CampaignFilter = { center: center ? { name: center.city, region: center.region, country: center.country, lat: center.lat, lon: center.lon } : null, radiusMiles: radius, includeRecorded: true, includeRequested: true, ...filter };
    setEditing({ id: "", subject: "", body: "", filter: f, recipients: [], excludedEmails: [], status: "draft", createdAt: "", sentAt: null, sentCount: 0, error: null });
    setTab("emails");
  }

  const s = data?.status;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b lg:border-b-0 lg:border-r border-line bg-white/70 p-5 lg:p-6 lg:sticky lg:top-0 lg:h-screen flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <span className="text-pink">✳</span> raye
          </div>
          <div className="eyebrow mt-0.5">on the road</div>
        </div>
        <nav className="flex lg:flex-col gap-1 overflow-x-auto">
          <button className={`nav-item ${tab === "explore" ? "active" : ""}`} onClick={() => setTab("explore")}>
            <span>Audience explorer</span>
          </button>
          <button className={`nav-item ${tab === "cities" ? "active" : ""}`} onClick={() => setTab("cities")}>
            <span>Your cities</span>
            <span className="pill">{clusters.length}</span>
          </button>
          <button className={`nav-item ${tab === "emails" ? "active" : ""}`} onClick={() => setTab("emails")}>
            <span>Show emails</span>
            <span className="pill">{data?.campaigns.length ?? 0}</span>
          </button>
          <button className={`nav-item ${tab === "needs" ? "active" : ""}`} onClick={() => setTab("needs")}>
            <span>Needs a location</span>
            <span className="pill">{stats.needs}</span>
          </button>
          <button className={`nav-item ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
            <span>Connections</span>
            <span className={`w-2 h-2 rounded-full ${s?.wix.live ? "bg-emerald-500" : "bg-amber-400"}`} />
          </button>
        </nav>
        <div className="hidden lg:block mt-auto card p-4 bg-pink-soft/40 border-pink-soft">
          <div className="font-medium text-sm">Big room. Your people.</div>
          <div className="text-xs text-muted mt-1 leading-relaxed">Pick a city, see who's nearby, send them one email.</div>
        </div>
        <div className="hidden lg:flex items-center justify-between text-xs text-muted">
          <span>Private, just for you</span>
          <button className="hover:text-ink" onClick={async () => { await fetch("/api/logout", { method: "POST" }); window.location.href = "/login"; }}>
            Log out
          </button>
        </div>
      </aside>

      <main className="p-5 lg:p-8 space-y-6 max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">The world is your green room</div>
            <h1 className="text-3xl font-semibold tracking-tight mt-1">
              {tab === "explore" && "Your people. Your next city."}
              {tab === "cities" && "You have people everywhere."}
              {tab === "emails" && "A little hello. A full room."}
              {tab === "needs" && "A few folks need a pin."}
              {tab === "settings" && "Keep your people close."}
            </h1>
            <p className="text-muted text-sm mt-1">
              {s?.wix.live ? (
                <>Live from Wix · pulled {timeAgo(s.wix.fetchedAt)}</>
              ) : s?.wix.configured ? (
                <span className="text-amber-600">Wix pull failed — showing the last good copy ({timeAgo(s?.wix.fetchedAt ?? null)}). {s?.wix.error}</span>
              ) : (
                <span className="text-amber-600">Wix isn't connected yet — showing the saved copy. See Connections.</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => load(true)} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "↻ Refresh from Wix"}
            </button>
            <button className="btn btn-primary" onClick={() => startEmail()}>
              + New show email
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="All contacts" value={fmt(people.length)} sub={`${fmt(stats.eligible)} eligible for email`} />
          <Stat label="On your map" value={fmt(stats.onMap)} sub="city centers located" />
          <Stat label="Countries" value={fmt(stats.countries)} sub="a worldwide kind of funny" />
          <Stat label="Next stop" value={center ? center.city : "Where to?"} sub={center ? `${nearby.length} within ${radius} mi` : "pick a city below"} accent />
        </section>

        {loading ? (
          <div className="card p-10 text-center text-muted">Pulling in your people…</div>
        ) : tab === "explore" ? (
          <ExploreTab clusters={clusters} center={center} setCenter={setCenter} radius={radius} setRadius={setRadius} nearby={nearby} onPickCity={pickCity} onEmail={() => startEmail()} />
        ) : tab === "cities" ? (
          <CitiesTab clusters={clusters} onPick={pickCity} />
        ) : tab === "emails" ? (
          <EmailsTab people={people} campaigns={data?.campaigns ?? []} editing={editing} setEditing={setEditing} reload={() => load()} status={s!} />
        ) : tab === "needs" ? (
          <NeedsTab people={people.filter((p) => p.lat == null)} reload={() => load()} />
        ) : (
          <SettingsTab status={s!} reload={() => load(true)} />
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? "bg-pink-soft/50 border-pink-soft" : ""}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 truncate ${accent ? "text-pink" : ""}`}>{value}</div>
      <div className="text-xs text-muted mt-0.5">{sub}</div>
    </div>
  );
}

function PersonRow({ p, extra }: { p: Person; extra?: string }) {
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
  return (
    <li className="flex items-center gap-3 py-2 border-b border-line last:border-0 text-sm">
      <span className={`w-2 h-2 rounded-full shrink-0 ${p.locationKind === "requested" ? "bg-pink" : "bg-ink-soft"}`} title={p.locationKind === "requested" ? "Asked for a show here" : "Location on file"} />
      <div className="min-w-0 flex-1">
        <div className="truncate">
          {name || <span className="text-muted">No name</span>} <span className="text-muted">· {p.email}</span>
        </div>
        <div className="text-xs text-muted truncate">
          {[p.city, p.region].filter(Boolean).join(", ")}
          {p.rawLocation && p.rawLocation.toLowerCase() !== p.city.toLowerCase() ? ` · wrote "${p.rawLocation}"` : ""}
          {extra ? ` · ${extra}` : ""}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {p.sources.map((src) => (
          <span key={src} className="pill">{src}</span>
        ))}
        {!p.emailEligible && <span className="pill bg-amber-100 text-amber-700">no email</span>}
      </div>
    </li>
  );
}

function ExploreTab({ clusters, center, setCenter, radius, setRadius, nearby, onPickCity, onEmail }: { clusters: CityCluster[]; center: Place | null; setCenter: (p: Place | null) => void; radius: number; setRadius: (n: number) => void; nearby: { p: Person; d: number }[]; onPickCity: (c: CityCluster) => void; onEmail: () => void }) {
  return (
    <div className="space-y-4">
      <div className="card p-4 lg:p-5 space-y-4">
        <div>
          <div className="font-medium">Find your local crowd</div>
          <div className="text-xs text-muted">A city, a radius, a room full of familiar faces.</div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[240px]">
            <CityPicker value={center} onChange={setCenter} />
          </div>
          <div className="flex rounded-full border border-line overflow-hidden text-sm">
            {[25, 50, 100].map((r) => (
              <button key={r} className={`px-3 py-2 ${radius === r ? "bg-ink-soft text-white" : "bg-white hover:bg-pink-soft/50"}`} onClick={() => setRadius(r)}>
                {r} mi
              </button>
            ))}
          </div>
        </div>
        <MapView clusters={clusters} center={center} radiusMiles={radius} onPickCity={onPickCity} />
        <div className="flex gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-ink-soft" /> Location on file</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-pink" /> Asked for a show here</span>
        </div>
      </div>

      {center && (
        <div className="card p-4 lg:p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-medium">
                {nearby.length} {nearby.length === 1 ? "person" : "people"} within {radius} mi of {center.city}
              </div>
              <div className="text-xs text-muted">{nearby.filter((x) => x.p.emailEligible).length} can be emailed · {nearby.filter((x) => x.p.locationKind === "requested").length} asked for a show</div>
            </div>
            <button className="btn btn-pink" onClick={onEmail} disabled={!nearby.length}>
              Email these people
            </button>
          </div>
          <ul className="mt-3 max-h-[420px] overflow-auto">
            {nearby.map(({ p, d }) => (
              <PersonRow key={p.email} p={p} extra={`${Math.round(d)} mi`} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CitiesTab({ clusters, onPick }: { clusters: CityCluster[]; onPick: (c: CityCluster) => void }) {
  const [q, setQ] = useState("");
  const shown = clusters.filter((c) => !q || `${c.city} ${c.region} ${c.country}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="card p-4 lg:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-medium">Your audience, city by city</div>
          <div className="text-xs text-muted">Ranked by people on your list. Pink = asked for a show there.</div>
        </div>
        <input className="input max-w-xs" placeholder="Filter cities…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ol className="mt-4 grid md:grid-cols-2 gap-2">
        {shown.map((c, i) => (
          <li key={c.key} className="flex items-center gap-3 p-3 rounded-xl border border-line hover:border-pink/40 bg-white">
            <span className="text-xs text-muted w-6 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{c.city}</div>
              <div className="text-xs text-muted truncate">{[c.region, c.country].filter(Boolean).join(", ")}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold tabular-nums">{c.count}</div>
              {c.requested > 0 && <div className="text-[11px] text-pink">{c.requested} asked</div>}
            </div>
            <button className="btn btn-ghost !py-1.5 !px-3 text-xs" onClick={() => onPick(c)}>
              Local crowd
            </button>
          </li>
        ))}
      </ol>
      {!shown.length && <div className="text-sm text-muted p-6 text-center">No cities match.</div>}
    </div>
  );
}

function NeedsTab({ people, reload }: { people: Person[]; reload: () => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, Person[]>();
    for (const p of people) {
      const k = p.rawLocation?.trim() ? p.rawLocation.trim() : "";
      m.set(k, [...(m.get(k) || []), p]);
    }
    return [...m.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : b[1].length - a[1].length));
  }, [people]);
  const [busy, setBusy] = useState<string | null>(null);

  async function fix(raw: string, email: string | null, place: Place | null) {
    setBusy(raw || email || "");
    await fetch("/api/fix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(raw ? { raw, place } : { email, place }) });
    setBusy(null);
    reload();
  }
  async function hide(email: string) {
    await fetch("/api/fix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, exclude: true }) });
    reload();
  }

  return (
    <div className="space-y-3">
      <div className="card p-4 text-sm text-muted">
        These answers couldn't be matched to a city automatically. Pick the right city and everyone who wrote the same thing gets placed on the map. Fixes stick across refreshes.
      </div>
      {groups.map(([raw, ps]) => (
        <div key={raw || "__none"} className="card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              {raw ? (
                <div className="font-medium">“{raw}”</div>
              ) : (
                <div className="font-medium text-muted">No location given</div>
              )}
              <div className="text-xs text-muted">
                {ps.length} {ps.length === 1 ? "person" : "people"} · {ps[0].needsLocation}
              </div>
            </div>
            {raw && (
              <div className="w-72">
                <CityPicker value={null} onChange={(place) => place && fix(raw, null, place)} placeholder={busy === raw ? "Saving…" : "Place everyone who wrote this…"} />
              </div>
            )}
          </div>
          <ul className="mt-2">
            {ps.slice(0, raw ? 50 : 500).map((p) => (
              <li key={p.email} className="flex items-center gap-2 text-sm py-1.5 border-b border-line last:border-0">
                <span className="truncate flex-1">
                  {[p.firstName, p.lastName].filter(Boolean).join(" ") || <span className="text-muted">No name</span>} <span className="text-muted">· {p.email}</span>
                </span>
                {p.sources.map((src) => (<span key={src} className="pill">{src}</span>))}
                <div className="w-56 hidden md:block">
                  <CityPicker value={null} onChange={(place) => place && fix("", p.email, place)} placeholder="Just this person…" />
                </div>
                <button className="text-xs text-muted hover:text-pink" onClick={() => hide(p.email)} title="Hide from the list">hide</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!groups.length && <div className="card p-10 text-center text-muted">Everyone has a pin. Nice.</div>}
    </div>
  );
}

function recipientsFor(people: Person[], f: CampaignFilter) {
  return people.filter((p) => {
    if (!p.emailEligible) return false;
    if (!f.center) return true;
    if (p.lat == null || p.lon == null) return false;
    if (p.locationKind === "requested" && !f.includeRequested) return false;
    if (p.locationKind === "recorded" && !f.includeRecorded) return false;
    return distanceMiles(f.center.lat, f.center.lon, p.lat, p.lon) <= f.radiusMiles;
  });
}

function EmailsTab({ people, campaigns, editing, setEditing, reload, status }: { people: Person[]; campaigns: Campaign[]; editing: Campaign | null; setEditing: (c: Campaign | null) => void; reload: () => void; status: DataStatus }) {
  if (editing) return <Composer people={people} campaign={editing} onClose={() => { setEditing(null); reload(); }} status={status} />;
  return (
    <div className="card p-4 lg:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-medium">Your show emails</div>
          <div className="text-xs text-muted">Every send starts with a draft and a recipient review.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ id: "", subject: "", body: "", filter: { center: null, radiusMiles: 25, includeRecorded: true, includeRequested: true }, recipients: [], excludedEmails: [], status: "draft", createdAt: "", sentAt: null, sentCount: 0, error: null })}>
          Write an email
        </button>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {campaigns.map((c) => (
          <li key={c.id} className="py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{c.subject || <span className="text-muted">Untitled</span>}</div>
              <div className="text-xs text-muted">
                {c.filter.center ? `${c.filter.center.name} · ${c.filter.radiusMiles} mi` : "Everyone"} · {c.status === "sent" ? `sent to ${c.sentCount} · ${new Date(c.sentAt!).toLocaleDateString()}` : `${c.recipients.length} recipients · ${new Date(c.createdAt).toLocaleDateString()}`}
                {c.error ? ` · ${c.error}` : ""}
              </div>
            </div>
            <span className={`pill ${c.status === "sent" ? "bg-emerald-100 text-emerald-700" : c.status === "failed" ? "bg-red-100 text-red-700" : ""}`}>{c.status}</span>
            {c.status === "draft" && (
              <button className="btn btn-ghost !py-1.5 !px-3 text-xs" onClick={() => setEditing(c)}>
                Open
              </button>
            )}
          </li>
        ))}
        {!campaigns.length && <li className="py-8 text-center text-sm text-muted">No emails yet.</li>}
      </ul>
    </div>
  );
}

function Composer({ people, campaign, onClose, status }: { people: Person[]; campaign: Campaign; onClose: () => void; status: DataStatus }) {
  const [c, setC] = useState<Campaign>(campaign);
  const [center, setCenter] = useState<Place | null>(c.filter.center ? { city: c.filter.center.name, region: c.filter.center.region, country: c.filter.center.country, lat: c.filter.center.lat, lon: c.filter.center.lon } : null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set(c.excludedEmails));
  const [busy, setBusy] = useState<"save" | "send" | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [confirm, setConfirm] = useState(false);

  const filter: CampaignFilter = { ...c.filter, center: center ? { name: center.city, region: center.region, country: center.country, lat: center.lat, lon: center.lon } : null };
  const recips = useMemo(() => recipientsFor(people, filter), [people, filter.center?.lat, filter.center?.lon, filter.radiusMiles, filter.includeRecorded, filter.includeRequested]); // eslint-disable-line react-hooks/exhaustive-deps
  const finalRecips = recips.filter((p) => !excluded.has(p.email));

  async function save(): Promise<Campaign | null> {
    setBusy("save");
    const r = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...c, id: c.id || undefined, filter, recipients: finalRecips.map((p) => p.email), excludedEmails: [...excluded] }) });
    setBusy(null);
    if (!r.ok) {
      setMsg("Couldn't save.");
      return null;
    }
    const j = await r.json();
    setC(j.campaign);
    setMsg("Draft saved.");
    return j.campaign;
  }

  async function send() {
    const saved = await save();
    if (!saved) return;
    setBusy("send");
    const r = await fetch("/api/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: saved.id }) });
    const j = await r.json();
    setBusy(null);
    setConfirm(false);
    if (j.ok) {
      setMsg(`Sent to ${j.sent} people.`);
      setTimeout(onClose, 900);
    } else setMsg(j.error || "Send failed.");
  }

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-4">
      <div className="card p-4 lg:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">{c.id ? "Edit draft" : "New show email"}</div>
          <button className="text-sm text-muted hover:text-ink" onClick={onClose}>← Back</button>
        </div>
        <input className="input" placeholder="Subject — e.g. I'm doing a show in Denver Friday!" value={c.subject} onChange={(e) => setC({ ...c, subject: e.target.value })} />
        <textarea className="input min-h-[260px] font-[inherit]" placeholder={"Hi {{first_name}},\n\nI'm performing at … on … Tickets: https://…\n\nWould love to see you there!\nRaye"} value={c.body} onChange={(e) => setC({ ...c, body: e.target.value })} />
        <div className="text-xs text-muted">Use <code>{"{{first_name}}"}</code> to personalise. An unsubscribe link{status.resend.sender ? ` and "from ${status.resend.sender}"` : ""} are added automatically. Links become clickable.</div>
        {!status.resend.configured && <div className="text-xs rounded-lg bg-amber-50 text-amber-800 p-3">Email sending isn't connected yet (RESEND_API_KEY + EMAIL_FROM). You can still save drafts.</div>}
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn btn-ghost" onClick={save} disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save draft"}</button>
          {!confirm ? (
            <button className="btn btn-pink" onClick={() => setConfirm(true)} disabled={busy !== null || !finalRecips.length || !c.subject.trim() || !c.body.trim() || !status.resend.configured}>
              Send to {finalRecips.length} {finalRecips.length === 1 ? "person" : "people"}
            </button>
          ) : (
            <>
              <span className="text-sm">Really send to {finalRecips.length}?</span>
              <button className="btn btn-pink" onClick={send} disabled={busy !== null}>{busy === "send" ? "Sending…" : "Yes, send it"}</button>
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
            </>
          )}
          {msg && <span className="text-sm text-muted">{msg}</span>}
        </div>
      </div>
      <div className="card p-4 lg:p-5 space-y-3">
        <div className="font-medium">Who gets it</div>
        <CityPicker value={center} onChange={setCenter} placeholder="Everyone (or pick a city)…" />
        {center && (
          <div className="flex rounded-full border border-line overflow-hidden text-sm w-fit">
            {[25, 50, 100].map((r) => (
              <button key={r} className={`px-3 py-1.5 ${filter.radiusMiles === r ? "bg-ink-soft text-white" : "bg-white"}`} onClick={() => setC({ ...c, filter: { ...c.filter, radiusMiles: r } })}>{r} mi</button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.filter.includeRequested} onChange={(e) => setC({ ...c, filter: { ...c.filter, includeRequested: e.target.checked } })} /> People who asked for a show there</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.filter.includeRecorded} onChange={(e) => setC({ ...c, filter: { ...c.filter, includeRecorded: e.target.checked } })} /> People with that location on file</label>
        <div className="text-xs text-muted">{finalRecips.length} recipients · unsubscribed people are never included. Click a name to leave them out.</div>
        <ul className="max-h-[420px] overflow-auto text-sm">
          {recips.map((p) => (
            <li key={p.email} className={`flex items-center gap-2 py-1.5 border-b border-line last:border-0 cursor-pointer ${excluded.has(p.email) ? "opacity-40 line-through" : ""}`} onClick={() => setExcluded((s) => { const n = new Set(s); if (n.has(p.email)) n.delete(p.email); else n.add(p.email); return n; })}>
              <span className={`w-2 h-2 rounded-full ${p.locationKind === "requested" ? "bg-pink" : "bg-ink-soft"}`} />
              <span className="truncate">{[p.firstName, p.lastName].filter(Boolean).join(" ") || p.email}</span>
              <span className="text-muted text-xs truncate ml-auto">{p.city}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SettingsTab({ status, reload }: { status: DataStatus; reload: () => void }) {
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  async function upload(file: File) {
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/import", { method: "POST", body: fd });
    const j = await r.json();
    setImporting(false);
    setMsg(j.ok ? `Imported ${j.imported} Beacons contacts.` : j.error || "Import failed");
    reload();
  }
  return (
    <div className="space-y-3">
      <ConnRow ok={status.wix.live} title="Wix" body={status.wix.live ? `Pulling ${status.wix.count} contacts + their city answers live, every time this page loads (cached 60 s).` : status.wix.configured ? `Key is set but the last pull failed: ${status.wix.error}` : "Add WIX_API_KEY and WIX_SITE_ID as environment variables on Vercel. The key needs Read Contacts and Read Submissions (Wix Forms)."} />
      <ConnRow ok={status.beacons.count > 0} title="Beacons" body={status.beacons.count ? `${status.beacons.count} contacts imported from Beacons. Beacons is being sunset, so there's no sync — but you can drop in a newer audience_list.csv any time.` : "No Beacons contacts yet. Upload beacons-import.json (the one-time export) or a Beacons audience_list.csv."}>
        <label className="btn btn-ghost mt-3 cursor-pointer">
          {importing ? "Importing…" : "Import Beacons (CSV or JSON)"}
          <input type="file" accept=".csv,.json" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {msg && <span className="text-sm text-muted ml-3">{msg}</span>}
      </ConnRow>
      <ConnRow ok={status.resend.configured} title="Show emails (Resend)" body={status.resend.configured ? `Sending as ${status.resend.sender}. Every email carries a one-click unsubscribe.` : "Add RESEND_API_KEY and EMAIL_FROM (e.g. hello@rayeschiller.com, on a domain verified in Resend). Optional: MAILING_ADDRESS for the footer."} />
      <ConnRow ok={status.storage === "blob"} title="Storage" body={status.storage === "blob" ? "Drafts, fixes and unsubscribes are saved in Vercel Blob (private)." : "Running on local file storage. On Vercel, add a Blob store so saves persist between deploys."} />
    </div>
  );
}

function ConnRow({ ok, title, body, children }: { ok: boolean; title: string; body: string; children?: React.ReactNode }){
  return (
    <div className="card p-4 lg:p-5">
      <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-400"}`} />
        <div className="font-medium">{title}</div>
        <span className="pill ml-auto">{ok ? "Connected" : "Setup needed"}</span>
      </div>
      <p className="text-sm text-muted mt-2">{body}</p>
      {children}
    </div>
  );
}
