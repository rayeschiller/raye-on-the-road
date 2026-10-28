"use client";
import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/types";

export default function CityPicker({ value, onChange, placeholder = "Find a city…", autoFocus }: { value: Place | null; onChange: (p: Place | null) => void; placeholder?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      const r = await fetch(`/api/cities?q=${encodeURIComponent(q)}`);
      const j = await r.json();
      setResults(j.results || []);
      setOpen(true);
    }, 150);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center gap-2 input bg-pink-soft/40">
        <span className="font-medium">{value.city}</span>
        <span className="text-muted text-sm truncate">{[value.region, value.country].filter(Boolean).join(", ")}</span>
        <button type="button" className="ml-auto text-muted hover:text-ink text-sm" onClick={() => { onChange(null); setQ(""); }} aria-label="Clear city">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input className="input" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} autoFocus={autoFocus} />
      {open && results.length > 0 && (
        <ul className="absolute z-[1000] mt-1 w-full card p-1 shadow-lg max-h-64 overflow-auto">
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" className="w-full text-left px-3 py-2 rounded-lg hover:bg-pink-soft/60 text-sm" onMouseDown={() => { onChange(r); setOpen(false); }}>
                <span className="font-medium">{r.city}</span> <span className="text-muted">{[r.region, r.country].filter(Boolean).join(", ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
