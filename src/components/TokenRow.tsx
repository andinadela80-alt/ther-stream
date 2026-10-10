import { TOKEN_META, usd, type Price } from "@/lib/prices";

export function TokenRow({ sym, amount, price, network }: { sym: string; amount?: number; price?: Price; network: string }) {
  const logo = TOKEN_META[sym]?.logo;
  const value = amount !== undefined && price ? amount * price.usd : undefined;
  const up = (price?.change ?? 0) >= 0;
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface/60 px-3 py-3">
      {logo ? <img src={logo} alt={sym} className="size-9 rounded-full bg-card" loading="lazy" /> : <span className="grid size-9 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">{sym.slice(0, 2)}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{sym}</p>
        <p className="text-xs text-muted-foreground">
          {price ? <>{usd(price.usd)} <span className={up ? "text-primary" : "text-destructive"}>{up ? "▲" : "▼"} {Math.abs(price.change).toFixed(2)}%</span></> : network}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm">{amount === undefined ? "—" : amount.toLocaleString("en-US", { maximumFractionDigits: 6 })}</p>
        <p className="text-xs text-muted-foreground">{value !== undefined ? usd(value) : ""}</p>
      </div>
    </li>
  );
}
