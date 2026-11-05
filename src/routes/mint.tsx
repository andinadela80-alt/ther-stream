import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, ImageOff, Loader2, RefreshCw, ShieldCheck, ShieldX, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GENESIS_VARIANTS, GENESIS_SUPPLY } from "@/lib/nft/genesis-metadata";
import { GENESIS_CONTRACT, AGENT_REGISTRY } from "@/lib/nft/mint-rules";
import { createPublicClient, http, parseAbi } from "viem";
import { bsc } from "viem/chains";
import commonArtwork from "@/assets/genesis-common.png.asset.json";
import uncommonArtwork from "@/assets/genesis-uncommon.png.asset.json";
import epicArtwork from "@/assets/genesis-epic.png.asset.json";
import legendaryArtwork from "@/assets/genesis-legendary.png.asset.json";

// Agent ID registry (SPACE ID) on BNB Chain.
const MINT_CONTRACT = GENESIS_CONTRACT;

const BSC_RPC = "https://bsc-dataseed1.binance.org";
const mintClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC, { timeout: 12000 }) });
const counterAbi = parseAbi(["function totalMinted() view returns (uint256)"]);
const CONTRACT_URL = `https://bscscan.com/address/${MINT_CONTRACT}`;

const TIERS = [
  { name: "Common", share: "50%", count: 500, color: "Green", cls: "border-rarity-common", variant: 0 },
  { name: "Uncommon", share: "30%", count: 300, color: "Blue", cls: "border-rarity-uncommon", variant: 2 },
  { name: "Epic", share: "15%", count: 150, color: "Purple", cls: "border-rarity-epic", variant: 1 },
  { name: "Legendary", share: "5%", count: 50, color: "Gold", cls: "border-rarity-legendary", variant: 3 },
];

const ORIGINAL_ARTWORK = [commonArtwork.url, epicArtwork.url, uncommonArtwork.url, legendaryArtwork.url];
const IMAGE_GATEWAYS = ["https://gateway.pinata.cloud/ipfs/", "https://ipfs.io/ipfs/"];
function NftPreview({ variant, name }: { variant: number; name: string }) {
  const [gateway, setGateway] = useState(0);
  const cid = GENESIS_VARIANTS[variant]?.image.replace("ipfs://", "");
  const sources = [ORIGINAL_ARTWORK[variant], ...IMAGE_GATEWAYS.map((base) => `${base}${cid}`)];
  return <div className="aspect-square w-full overflow-hidden bg-muted">
    {cid && gateway < sources.length ? (
      <img src={sources[gateway]} alt={`Mindcaster Genesis Pass — ${name}`} className="h-full w-full object-contain" decoding="async" onError={() => setGateway((current) => current + 1)} />
    ) : <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-muted-foreground"><ImageOff className="size-6" /><span>Artwork temporarily unavailable</span><Button variant="ghost" size="sm" onClick={() => setGateway(0)}><RefreshCw className="size-3" /> Retry</Button></div>}
  </div>;
}

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
  const [minted, setMinted] = useState<number | null>(null);
  const [counterLoading, setCounterLoading] = useState(true);
  const [counterError, setCounterError] = useState(false);

  async function refreshCounter() {
    setCounterLoading(true);
    try {
      const value = await mintClient.readContract({ address: MINT_CONTRACT, abi: counterAbi, functionName: "totalMinted" });
      setMinted(Number(value));
      setCounterError(false);
    } catch { setCounterError(true); }
    finally { setCounterLoading(false); }
  }

  useEffect(() => {
    void refreshCounter();
    const timer = window.setInterval(() => { void refreshCounter(); }, 30000);
    return () => window.clearInterval(timer);
  }, []);

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
          <p className="text-xs uppercase text-muted-foreground">BNB Chain · Genesis Event</p>
          <h1 className="text-3xl font-bold sm:text-4xl">Mindcaster Genesis Pass</h1>
          <p className="text-muted-foreground">1,000 founding member NFTs. Exclusive to Binance Agent ID (.ai) holders. No Mindcaster account required.</p>
        </header>

        <section className="space-y-3 border-y border-border py-5" aria-label="Mint progress">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-semibold tabular-nums" aria-live="polite">{minted === null ? "—" : minted.toLocaleString("en-US")} / {GENESIS_SUPPLY.toLocaleString("en-US")} <span className="text-sm font-normal text-muted-foreground">Minted</span></p>
            <Button variant="ghost" size="icon" aria-label="Refresh mint count" title="Refresh mint count" disabled={counterLoading} onClick={() => void refreshCounter()}><RefreshCw className={`size-4 ${counterLoading ? "animate-spin" : ""}`} /></Button>
          </div>
          <progress className="mint-progress h-2 w-full overflow-hidden rounded-full" max={GENESIS_SUPPLY} value={minted ?? 0} aria-label="Genesis Pass minted" />
          {counterError && <p className="text-xs text-muted-foreground">{minted === null ? "Live count is unavailable. Please retry." : "Could not refresh. Showing the last available count."}</p>}
          <a href={CONTRACT_URL} target="_blank" rel="noreferrer" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-link"><span className="inline-flex items-center gap-1">Contract on BscScan <ExternalLink className="size-3" /></span><span className="break-all font-mono">{MINT_CONTRACT}</span></a>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Genesis Pass rarities">
          {TIERS.map((t) => (
            <article key={t.name} className={`overflow-hidden rounded-lg border bg-card ${t.cls}`}>
              <NftPreview variant={t.variant} name={t.name} />
              <div className="space-y-1 p-3"><h2 className="text-sm font-semibold">{t.name}</h2><p className="text-xs text-muted-foreground">{t.count} · {t.share} · {t.color}</p></div>
            </article>
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
