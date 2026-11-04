import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShieldCheck, ShieldX, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

// Agent ID registry (SPACE ID) on BNB Chain.
const AGENT_REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F" as const;
// Set once the Genesis Pass contract is deployed on BNB Chain.
const MINT_CONTRACT: `0x${string}` = "0xe73f162e0728e62ee1ebc50da1e79333acd1e8bc";

const BSC_RPC = "https://bsc-dataseed1.binance.org";

const TIERS = [
  { name: "Common", share: "50%", count: 500, color: "Green", cls: "from-emerald-500/30 to-emerald-900/10 border-emerald-400/40" },
  { name: "Uncommon", share: "30%", count: 300, color: "Blue", cls: "from-sky-500/30 to-sky-900/10 border-sky-400/40" },
  { name: "Epic", share: "15%", count: 150, color: "Purple", cls: "from-fuchsia-500/30 to-fuchsia-900/10 border-fuchsia-400/40" },
  { name: "Legendary", share: "5%", count: 50, color: "Gold", cls: "from-amber-400/30 to-amber-900/10 border-amber-300/40" },
];

export const Route = createFileRoute("/mint")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Mint Mindcaster Genesis Pass — BNB Chain" },
      { name: "description", content: "Mint the Mindcaster Genesis Pass on BNB Chain. 1,000 founding member NFTs, open to Binance Agent ID (.ai) holders." },
      { property: "og:title", content: "Mint Mindcaster Genesis Pass" },
      { property: "og:description", content: "1,000 founding member NFTs on BNB Chain for Agent ID (.ai) holders. No Mindcaster account needed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MintPage,
});

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
const eth = () => (window as unknown as { ethereum?: Eth }).ethereum;

async function rpc(method: string, params: unknown[]) {
  const r = await fetch(BSC_RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result as string;
}

function MintPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [agent, setAgent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);

  async function connect() {
    setError(null);
    const p = eth();
    if (!p) { setError("No wallet found. Open this page in Binance Wallet, MetaMask, Trust Wallet or OKX Wallet."); return; }
    setBusy(true);
    try {
      const [acc] = (await p.request({ method: "eth_requestAccounts" })) as string[];
      if (!acc) throw new Error("No account selected.");
      try { await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] }); } catch { /* user can switch manually */ }
      setAddress(acc);
      const data = "0x70a08231" + acc.slice(2).toLowerCase().padStart(64, "0");
      const bal = await rpc("eth_call", [{ to: AGENT_REGISTRY, data }, "latest"]);
      setAgent(BigInt(bal) > 0n);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect wallet.");
    } finally { setBusy(false); }
  }

  async function mint() {
    const p = eth();
    if (!p || !address || !MINT_CONTRACT) return;
    setBusy(true); setError(null);
    try {
      // mint() selector, Early Access price 0.00021 BNB
      const hash = (await p.request({ method: "eth_sendTransaction", params: [{ from: address, to: MINT_CONTRACT, data: "0x1249c58b", value: "0x" + (210000000000000n).toString(16) }] })) as string;
      setTx(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mint failed.");
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">BNB Chain · Genesis Event</p>
          <h1 className="text-4xl font-bold">Mindcaster Genesis Pass</h1>
          <p className="text-muted-foreground">1,000 founding member NFTs. Exclusive to Binance Agent ID (.ai) holders. No Mindcaster account required.</p>
        </header>

        <section className="grid grid-cols-2 gap-3">
          {TIERS.map((t) => (
            <div key={t.name} className={`rounded-xl border bg-gradient-to-br p-4 ${t.cls}`}>
              <p className="text-lg font-semibold">{t.name}</p>
              <p className="text-sm text-muted-foreground">{t.count} · {t.share} · {t.color}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-2 text-sm">
          <div className="flex justify-between"><span>Early Access (#1–500)</span><span className="font-semibold">0.00021 BNB</span></div>
          <div className="flex justify-between"><span>Standard Mint (#501–1000)</span><span className="font-semibold">0.0014 BNB</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Limit</span><span>1 per wallet</span></div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          {!address ? (
            <Button className="w-full" size="lg" onClick={connect} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Wallet />} Connect Wallet
            </Button>
          ) : (
            <>
              <p className="text-sm text-muted-foreground break-all">Connected: {address}</p>
              {agent ? (
                <p className="flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="size-4" /> Agent ID (.ai) verified</p>
              ) : (
                <p className="flex items-center gap-2 text-sm font-medium text-destructive"><ShieldX className="size-4" /> Requires a Binance Agent ID (.ai). <a className="underline" href="https://space.id" target="_blank" rel="noreferrer">Get one</a></p>
              )}
              <Button className="w-full" size="lg" onClick={mint} disabled={busy || !agent || !MINT_CONTRACT}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                {!MINT_CONTRACT ? "Mint opens soon" : "Mint Genesis Pass"}
              </Button>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {tx && (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Congratulations, Founding Member! Welcome to Mindcaster.</p>
              <a className="underline" href={`https://bscscan.com/tx/${tx}`} target="_blank" rel="noreferrer">View on BscScan</a>
              <div><Link to="/" className="underline">Enter Mindcaster &amp; join the feed</Link></div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
