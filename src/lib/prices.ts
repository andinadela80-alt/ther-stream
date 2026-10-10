import { useEffect, useState } from "react";

export const TOKEN_META: Record<string, { id?: string; logo: string }> = {
  ETH: { id: "ethereum", logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  BNB: { id: "binancecoin", logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png" },
  USDC: { id: "usd-coin", logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
  USDT: { id: "tether", logo: "https://assets.coingecko.com/coins/images/325/small/Tether.png" },
  SOL: { id: "solana", logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
  PONS: { logo: "" },
};

export type Price = { usd: number; change: number };

export function usePrices() {
  const [prices, setPrices] = useState<Record<string, Price>>({});
  useEffect(() => {
    let alive = true;
    const ids = Object.values(TOKEN_META).map((m) => m.id).filter(Boolean).join(",");
    const run = async () => {
      try {
        const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
        const j = (await r.json()) as Record<string, { usd: number; usd_24h_change: number }>;
        const out: Record<string, Price> = {};
        for (const [sym, m] of Object.entries(TOKEN_META)) if (m.id && j[m.id]) out[sym] = { usd: j[m.id].usd, change: j[m.id].usd_24h_change ?? 0 };
        if (alive) setPrices(out);
      } catch { /* keep last prices */ }
    };
    void run();
    const t = setInterval(run, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return prices;
}

export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 4 : 2 });
