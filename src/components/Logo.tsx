import Link from "next/link";

export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5" aria-label="ScriptFlow AI — beranda">
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 shadow-[0_6px_24px_-6px_rgba(251,191,36,0.7)] transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-slate-950" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16M4 7l3-3M10 7l3-3M16 7l3-3" />
          <rect x="4" y="7" width="16" height="13" rx="2" />
          <path d="M9 12.5h6M9 16h4" />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-[17px] font-semibold tracking-tight text-white">
          ScriptFlow<span className="text-amber-400"> AI</span>
        </span>
      )}
    </Link>
  );
}
