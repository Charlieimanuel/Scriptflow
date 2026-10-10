"use client";

import type { AnalyzedScene, ShootingDay } from "@/lib/types";

type Props = { days: ShootingDay[]; scenes: AnalyzedScene[]; pendingCount: number };

export function ScheduleBoard({ days, scenes, pendingCount }: Props) {
  const byNo = new Map(scenes.map((s) => [s.sceneNo, s]));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-sm text-slate-400">
          <b className="text-white">{days.length} hari syuting</b> · dikelompokkan per lokasi, diurutkan per waktu
        </p>
        {pendingCount > 0 && <span className="text-xs text-amber-300">{pendingCount} adegan menunggu analisis…</span>}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {days.map((d) => (
          <section key={d.dayNo} className="w-64 shrink-0 animate-fade-up rounded-xl border border-white/5 bg-white/[0.02]">
            <header className="border-b border-white/5 px-4 py-3">
              <p className="font-mono text-[11px] text-amber-400">HARI {d.dayNo}</p>
              <h3 className="mt-0.5 truncate font-display text-[15px] font-semibold text-white" title={d.location}>
                {d.location}
              </h3>
              <p className="text-[11px] text-slate-500">{d.sceneNos.length} adegan</p>
            </header>
            <ul className="space-y-2 p-3">
              {d.sceneNos.map((n) => {
                const s = byNo.get(n);
                if (!s) return null;
                const cast = s.elements.filter((e) => e.category === "cast");
                const night = s.timeOfDay === "MALAM" || s.timeOfDay === "SUBUH";
                return (
                  <li key={n} className="rounded-lg border border-white/5 bg-[#070a12] p-3 transition hover:-translate-y-0.5 hover:border-white/15">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-slate-300">Adegan {n}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${night ? "bg-indigo-400/15 text-indigo-200" : "bg-sky-400/10 text-sky-300"}`}>
                        {night ? "☾" : "☀"} {s.timeOfDay ?? "—"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-500">{s.body.split("\n").find((l) => l.trim()) ?? ""}</p>
                    {cast.length > 0 && (
                      <div className="mt-2 flex -space-x-1.5">
                        {cast.slice(0, 5).map((c) => (
                          <span
                            key={c.name}
                            title={`${c.name}${c.quantity > 1 ? ` ×${c.quantity}` : ""}`}
                            className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-sky-400/80 to-violet-500/80 text-[9px] font-bold text-white ring-2 ring-[#070a12]"
                          >
                            {c.name.slice(0, 2).toUpperCase()}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export default ScheduleBoard;
