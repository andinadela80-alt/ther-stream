import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Share2 } from "lucide-react";

import fomoLogo from "@/assets/fomo-logo.jpg.asset.json";
import { AppShell } from "@/components/AppShell";
import { getFomo } from "@/lib/fomo.functions";

export const Route = createFileRoute("/fomo")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Fomo — Mindcaster" },
      { name: "description", content: "FOMO trader live feed, theses, and weekly PnL leaderboard on Mindcaster." },
      { property: "og:title", content: "Fomo — Mindcaster" },
      { property: "og:description", content: "FOMO trader live feed, theses, and weekly PnL leaderboard on Mindcaster." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell title="Fomo">{() => <Fomo />}</AppShell>,
});

type Tab = "alerts" | "thesis" | "leaderboard";
type Row = Record<string, unknown>;
const TABS: { id: Tab; label: string }[] = [
  { id: "alerts", label: "Live Feed" },
  { id: "thesis", label: "Thesis" },
  { id: "leaderboard", label: "PnL 7 Hari" },
];

function list(json: unknown): Row[] {
  if (Array.isArray(json)) return json as Row[];
  if (json && typeof json === "object") {
    for (const k of ["data", "items", "results", "alerts", "theses", "thesis", "leaderboard", "traders"]) {
      const v = (json as Row)[k];
      if (Array.isArray(v)) return v as Row[];
      if (v && typeof v === "object") { const inner = list(v); if (inner.length) return inner; }
    }
  }
  return [];
}
function pick(r: Row, ...keys: string[]): unknown {
  for (const k of keys) {
    const parts = k.split(".");
    let v: unknown = r;
    for (const p of parts) v = v && typeof v === "object" ? (v as Row)[p] : undefined;
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}
const str = (v: unknown) => (v === undefined ? "" : typeof v === "object" ? "" : String(v));
const usd = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }) : str(v); };
const when = (v: unknown) => { const d = new Date(typeof v === "number" && v < 1e12 ? v * 1000 : (v as string)); return isNaN(+d) ? "" : d.toLocaleString(); };
const trader = (r: Row) => str(pick(r, "trader.handle", "trader.username", "user.handle", "user.username", "handle", "username", "trader.name", "name")) || "Trader";
const token = (r: Row) => str(pick(r, "token.symbol", "symbol", "token_symbol", "token.name", "token"));

function Fomo() {
  const fetchFomo = useServerFn(getFomo);
  const navigate = useNavigate();
  const share = (r: Row, text: string, side: string) => {
    const tk = token(r).replace(/[^A-Za-z0-9]/g, "");
    const val = pick(r, "value_usd", "amount_usd", "position_usd", "size_usd");
    const draft = `📡 FOMO signal: ${trader(r)}${side ? ` ${side}` : ""}${tk ? ` $${tk.toUpperCase()}` : ""}${val !== undefined ? ` (${usd(val)})` : ""}${text ? `\n\n"${text.slice(0, 300)}"` : ""}`;
    sessionStorage.setItem("mc-draft", draft);
    void navigate({ to: "/" });
  };
  const [tab, setTab] = useState<Tab>("alerts");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fetchFomo({ data: { tab } })
      .then((r) => { if (alive) setRows(list(JSON.parse(r.json))); })
      .catch((e: Error) => { if (alive) { setRows([]); setError(e.message); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [tab, nonce, fetchFomo]);

  return (
    <>
      <section className="glass-panel flex items-center gap-3 rounded-[24px] border border-surface/80 p-4">
        <img src={fomoLogo.url} alt="Logo Fomo" width={816} height={816} className="size-11 rounded-xl object-contain" />
        <div className="flex-1"><h2 className="font-display font-semibold">Fomo Family</h2><p className="text-xs text-muted-foreground">Live trader data from FOMO</p></div>
        <button type="button" onClick={() => setNonce((n) => n + 1)} aria-label="Reload" className="grid size-9 place-items-center rounded-full bg-surface/70"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button>
      </section>
      <div className="glass-panel grid grid-cols-3 gap-1 rounded-full border border-surface/80 p-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`rounded-full py-2 text-xs font-semibold transition ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t.label}</button>
        ))}
      </div>
      {error && <p role="alert" className="glass-panel rounded-2xl p-4 text-sm text-destructive">{error}</p>}
      {!loading && !error && rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No data yet.</p>}
      {tab === "leaderboard"
        ? rows.map((r, i) => {
            const pnlRaw = pick(r, "pnlUsd", "pnl", "pnl_usd", "realizedPnlUsd", "realized_pnl", "totalPnlUsd", "total_pnl", "stats.pnlUsd", "stats.pnl");
            const pnl = Number(pnlRaw);
            const vol = pick(r, "volumeUsd", "volume", "volume_usd", "stats.volumeUsd", "stats.volume");
            const trades = str(pick(r, "trades", "tradeCount", "trade_count", "numTrades", "num_trades", "stats.trades"));
            const tt = pick(r, "topTokens", "top_tokens", "tokens");
            const tokens = (Array.isArray(tt) ? tt : []).map((t) => (typeof t === "string" ? t : str(pick(t as Row, "symbol", "token.symbol", "name")))).filter(Boolean).slice(0, 4);
            return (
              <article key={i} className="glass-panel flex items-center gap-3 rounded-2xl border border-surface/80 p-3">
                <span className="w-7 text-center font-display text-sm font-bold text-primary">#{str(pick(r, "rank")) || i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{trader(r)}</p>
                  <p className="text-xs text-muted-foreground">Volume {vol !== undefined ? usd(vol) : "–"} · {trades || "–"} trade</p>
                  {tokens.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{tokens.map((s) => <Link key={s} to="/cashtag" search={{ s: s.toUpperCase() }} className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">${s}</Link>)}</div>}
                </div>
                <span className={`text-sm font-bold ${Number.isFinite(pnl) ? (pnl >= 0 ? "text-primary" : "text-destructive") : "text-muted-foreground"}`}>{Number.isFinite(pnl) ? usd(pnl) : "–"}</span>
              </article>
            );
          })
        : rows.map((r, i) => {
            const side = str(pick(r, "side", "direction", "type", "action")).toLowerCase();
            const text = str(pick(r, "thesis", "text", "content", "body", "message"));
            return (
              <article key={i} className="glass-panel rounded-2xl border border-surface/80 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{trader(r)}</span>
                  {side && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${side.includes("sell") ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>{side}</span>}
                  {token(r) && <Link to="/cashtag" search={{ s: token(r).toUpperCase() }} className="font-semibold text-primary hover:underline">${token(r)}</Link>}
                  <span className="ml-auto text-xs text-muted-foreground">{str(pick(r, "chain"))}</span>
                </div>
                {text && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{text}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{[pick(r, "value_usd", "amount_usd", "position_usd", "size_usd") !== undefined ? usd(pick(r, "value_usd", "amount_usd", "position_usd", "size_usd")) : "", when(pick(r, "created_at", "timestamp", "time"))].filter(Boolean).join(" · ")}</p>
                <button type="button" onClick={() => share(r, text, side)} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1 text-xs font-semibold text-primary"><Share2 className="size-3.5" />Share to feed</button>
              </article>
            );
          })}
    </>
  );
}
