import { useEffect, useState } from "react";
import { ArrowDownUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type SwapToken = { sym: string; id: string; decimals: number };
export type Quote = { out: number; via: string; raw: unknown };

type Props = {
  open: boolean;
  onClose: () => void;
  network: string;
  tokens: SwapToken[];
  balances: Record<string, number | undefined>;
  getQuote: (from: SwapToken, to: SwapToken, amount: bigint) => Promise<Quote>;
  execute: (q: Quote, from: SwapToken, amount: bigint) => Promise<void>;
};

function toUnits(v: string, d: number): bigint {
  const [i = "0", f = ""] = v.trim().split(".");
  return BigInt(i || "0") * 10n ** BigInt(d) + BigInt((f + "0".repeat(d)).slice(0, d) || "0");
}

export function SwapDialog({ open, onClose, network, tokens, balances, getQuote, execute }: Props) {
  const [fromSym, setFrom] = useState(tokens[0]?.sym ?? "");
  const [toSym, setTo] = useState(tokens[1]?.sym ?? "");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const from = tokens.find((t) => t.sym === fromSym);
  const to = tokens.find((t) => t.sym === toSym);

  useEffect(() => { setFrom(tokens[0]?.sym ?? ""); setTo(tokens[1]?.sym ?? ""); setAmount(""); }, [network]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setQuote(null); setErr("");
    if (!from || !to || from.sym === to.sym || !(Number(amount) > 0)) return;
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try { const q = await getQuote(from, to, toUnits(amount, from.decimals)); if (alive) setQuote(q); }
      catch (e) { if (alive) setErr((e as Error).message.slice(0, 120) || "No swap route found."); }
      finally { if (alive) setLoading(false); }
    }, 600);
    return () => { alive = false; clearTimeout(t); };
  }, [fromSym, toSym, amount]); // eslint-disable-line react-hooks/exhaustive-deps

  async function go() {
    if (!quote || !from) return;
    setBusy(true);
    try { await execute(quote, from, toUnits(amount, from.decimals)); toast.success("Swap submitted!"); setAmount(""); onClose(); }
    catch (e) { toast.error((e as Error).message.slice(0, 140)); }
    finally { setBusy(false); }
  }

  const sel = "rounded-xl bg-card px-2 py-2 text-sm font-bold outline-none";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Swap on {network}</DialogTitle></DialogHeader>
        <div className="rounded-2xl bg-surface p-3">
          <div className="flex justify-between text-[11px] text-muted-foreground"><span>From</span>
            <button onClick={() => setAmount(String(balances[fromSym] ?? 0))}>Balance {balances[fromSym]?.toFixed(4) ?? "—"}</button></div>
          <div className="mt-1 flex gap-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} inputMode="decimal" placeholder="0.0" className="w-full bg-transparent text-2xl font-bold outline-none" />
            <select aria-label="Source token" value={fromSym} onChange={(e) => setFrom(e.target.value)} className={sel}>{tokens.map((t) => <option key={t.sym}>{t.sym}</option>)}</select>
          </div>
        </div>
        <button aria-label="Switch direction" onClick={() => { setFrom(toSym); setTo(fromSym); }} className="mx-auto -my-2 rounded-full bg-primary/15 p-2 text-primary"><ArrowDownUp className="size-4" /></button>
        <div className="rounded-2xl bg-surface p-3">
          <div className="text-[11px] text-muted-foreground">To (est.)</div>
          <div className="mt-1 flex gap-2">
            <p className="w-full text-2xl font-bold">{loading ? <Loader2 className="size-5 animate-spin" /> : quote ? quote.out.toFixed(6) : "0.0"}</p>
            <select aria-label="Destination token" value={toSym} onChange={(e) => setTo(e.target.value)} className={sel}>{tokens.map((t) => <option key={t.sym}>{t.sym}</option>)}</select>
          </div>
        </div>
        {quote && <p className="text-xs text-muted-foreground">Best route via <b>{quote.via}</b> · slippage 0.5%</p>}
        {err && <p className="text-xs text-destructive">{err}</p>}
        <Button disabled={!quote || busy} onClick={() => void go()}>{busy && <Loader2 className="size-4 animate-spin" />}Swap now</Button>
      </DialogContent>
    </Dialog>
  );
}
