"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    setBusy(false);
    if (r.ok) router.replace(params.get("next") || "/");
    else setErr("That's not it.");
  }
  return (
    <form onSubmit={submit} className="card w-full max-w-sm p-8 space-y-4">
      <div>
        <div className="eyebrow">Private, just for you</div>
        <h1 className="text-2xl font-semibold mt-1">Raye on the Road</h1>
      </div>
      <input className="input" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      {err && <div className="text-sm text-pink">{err}</div>}
      <button className="btn btn-primary w-full justify-center" disabled={busy || !pw}>
        Let me in
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
