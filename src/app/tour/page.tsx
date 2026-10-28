import { getShare } from "@/lib/share";

export const dynamic = "force-dynamic";
export const metadata = { title: "Where should Raye go next?", description: "Where the Raye on the Road crowd lives — vote for your city.", robots: { index: true, follow: true } };

export default async function TourPage() {
  const { cities, other, countries } = await getShare();
  return (
    <main className="min-h-screen px-4 py-10 sm:py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-2">
          <div className="eyebrow">Raye on the road · 2027</div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Where should I bring the tour?</h1>
          <p className="text-muted">
            Here&apos;s where my people are so far, across {countries} countries. Don&apos;t see your city high enough?{" "}
            <a className="text-pink font-medium underline underline-offset-2" href="https://www.rayeschiller.com/signup">Sign up at rayeschiller.com/signup</a>
          </p>
        </header>
        <ol className="card p-4 sm:p-6 space-y-3">
          {cities.map((c, i) => (
            <li key={`${c.city}|${c.region}`} className="grid grid-cols-[1.75rem_1fr_3.5rem] items-center gap-3">
              <span className="text-xs text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium truncate">{c.city}</span>
                  <span className="text-xs text-muted truncate">{c.region || c.country}</span>
                </div>
                <div className="mt-1 h-2.5 rounded-full bg-pink-soft overflow-hidden">
                  <div className="h-full rounded-full bg-pink" style={{ width: `${Math.max(4, c.bar)}%` }} />
                </div>
              </div>
              <span className="text-sm tabular-nums text-right">{c.pct < 1 ? "<1" : c.pct.toFixed(0)}%</span>
            </li>
          ))}
          {other > 0 && (
            <li className="grid grid-cols-[1.75rem_1fr_3.5rem] items-center gap-3 pt-2 border-t border-line">
              <span />
              <span className="text-sm text-muted">Everywhere else</span>
              <span className="text-sm tabular-nums text-right text-muted">{other.toFixed(0)}%</span>
            </li>
          )}
        </ol>
        <div className="card p-5 sm:p-6 bg-pink-soft/40 border-pink-soft flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <div className="font-medium">Want me in your city?</div>
            <div className="text-sm text-muted">Tell me where, and I&apos;ll email you when I&apos;m coming.</div>
          </div>
          <a className="btn btn-pink justify-center" href="https://www.rayeschiller.com/signup">Vote for your city</a>
        </div>
        <p className="text-xs text-muted text-center">Shares of everyone who told me their city. No names, no counts.</p>
      </div>
    </main>
  );
}
