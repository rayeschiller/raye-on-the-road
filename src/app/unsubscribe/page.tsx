"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function Unsub() {
  const params = useSearchParams();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  useEffect(() => {
    const e = params.get("e");
    const t = params.get("t");
    fetch(`/api/unsubscribe?e=${encodeURIComponent(e || "")}&t=${encodeURIComponent(t || "")}`, { method: "POST" })
      .then((r) => setState(r.ok ? "done" : "error"))
      .catch(() => setState("error"));
  }, [params]);
  return (
    <div className="card max-w-md w-full p-8 text-center space-y-2">
      <div className="eyebrow">Raye on the Road</div>
      {state === "working" && <p>One sec…</p>}
      {state === "done" && (
        <>
          <h1 className="text-xl font-semibold">You're unsubscribed.</h1>
          <p className="text-muted text-sm">No more show emails. If you change your mind, sign up again at rayeschiller.com.</p>
        </>
      )}
      {state === "error" && (
        <>
          <h1 className="text-xl font-semibold">That link didn't work.</h1>
          <p className="text-muted text-sm">Reply to the email and Raye will take you off the list by hand.</p>
        </>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Suspense>
        <Unsub />
      </Suspense>
    </main>
  );
}
