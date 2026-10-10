import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { CreateEvmWallet } from "@/components/CreateEvmWallet";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
// @ts-expect-error qrcode ships without types
import QRCode from "qrcode";
import { defineChain, encodeFunctionData, erc20Abi, formatUnits, isAddress, parseUnits } from "viem";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PRIVY_APP_ID } from "@/lib/privy.functions";
import { CHAINS } from "@/lib/verification";
import { TokenRow } from "@/components/TokenRow";
import { usd, usePrices } from "@/lib/prices";
import { SolanaPanel, SOL_RPC, SOL_WSS } from "@/components/SolanaWallet";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

type Tok = { sym: string; address?: `0x${string}`; decimals: number };
type Net = { key: string; id: number; name: string; native: string; rpc: string; explorer: string; explorerName: string; swap: string; tokens: Tok[] };
const NETS: Net[] = [
  { key: "base", id: 8453, name: "Base", native: "ETH", rpc: CHAINS.base.rpc, explorer: CHAINS.base.explorer, explorerName: "BaseScan", swap: "https://app.uniswap.org/swap?chain=base",
    tokens: [{ sym: "USDC", ...CHAINS.base.tokens.USDC }, { sym: "USDT", ...CHAINS.base.tokens.USDT }] },
  { key: "robinhood", id: 4663, name: "Robinhood", native: "ETH", rpc: "https://rpc.mainnet.chain.robinhood.com", explorer: "https://robinhoodchain.blockscout.com", explorerName: "Blockscout", swap: "https://www.ponsfamily.com",
    tokens: [{ sym: "PONS", address: "0x39dbed3a2bd333467115de45665cc57f813c4571", decimals: 18 }] },
  { key: "ethereum", id: 1, name: "Ethereum", native: "ETH", rpc: "https://ethereum-rpc.publicnode.com", explorer: "https://etherscan.io", explorerName: "Etherscan", swap: "https://app.uniswap.org/swap?chain=mainnet",
    tokens: [{ sym: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 }, { sym: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 }] },
  { key: "bnb", id: 56, name: "BNB Chain", native: "BNB", rpc: CHAINS.bnb.rpc, explorer: CHAINS.bnb.explorer, explorerName: "BscScan", swap: "https://pancakeswap.finance/swap",
    tokens: [{ sym: "USDC", ...CHAINS.bnb.tokens.USDC }, { sym: "USDT", ...CHAINS.bnb.tokens.USDT }] },
  { key: "arbitrum", id: 42161, name: "Arbitrum", native: "ETH", rpc: "https://arb1.arbitrum.io/rpc", explorer: "https://arbiscan.io", explorerName: "Arbiscan", swap: "https://app.uniswap.org/swap?chain=arbitrum",
    tokens: [{ sym: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 }, { sym: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 }] },
];
const SUPPORTED = NETS.map((n) => defineChain({ id: n.id, name: n.name, nativeCurrency: { name: n.native, symbol: n.native, decimals: 18 }, rpcUrls: { default: { http: [n.rpc] } }, blockExplorers: { default: { name: n.explorerName, url: n.explorer } } }));

async function rpc(url: string, method: string, params: unknown[]) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = (await r.json()) as { result?: string };
  return BigInt(j.result && j.result !== "0x" ? j.result : "0x0");
}

function Inner() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets, ready: wReady } = useWallets();
  const w = wallets.find((x) => x.walletClientType === "privy");
  const [netKey, setNetKey] = useState("base");
  const BASE = (NETS.find((n) => n.key === netKey) ?? NETS[0]) as (typeof NETS)[number];
  const TOKENS: Tok[] = [{ sym: BASE.native, decimals: 18 }, ...BASE.tokens];
  const [bal, setBal] = useState<Record<string, number>>({});
  const prices = usePrices();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<null | "receive" | "send">(null);
  const [qr, setQr] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [sym, setSym] = useState("ETH");
  const [sending, setSending] = useState(false);
  useEffect(() => { setSym(BASE.native); setBal({}); }, [BASE.native, netKey]);

  const load = useCallback(async () => {
    const net = NETS.find((n) => n.key === netKey);
    if (!w || !net) return;
    setLoading(true);
    try {
      const out: Record<string, number> = {};
      for (const t of [{ sym: net.native, decimals: 18 } as Tok, ...net.tokens]) {
        const v = t.address
          ? await rpc(net.rpc, "eth_call", [{ to: t.address, data: encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [w.address as `0x${string}`] }) }, "latest"])
          : await rpc(net.rpc, "eth_getBalance", [w.address, "latest"]);
        out[t.sym] = Number(formatUnits(v, t.decimals));
      }
      setBal(out);
    } catch { toast.error("Gagal memuat saldo."); } finally { setLoading(false); }
  }, [w, netKey]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (w) void QRCode.toDataURL(w.address, { margin: 1, width: 240 }).then(setQr); }, [w]);

  const selector = (
    <select aria-label="Jaringan" value={netKey} onChange={(e) => setNetKey(e.target.value)} className="rounded-full border-0 bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary outline-none">
      {NETS.map((n) => <option key={n.key} value={n.key}>{n.name}</option>)}
      <option value="solana">Solana</option>
    </select>
  );
  if (!ready || !wReady) return <p className="flex justify-center py-10"><Loader2 className="size-6 animate-spin" /></p>;
  if (!authenticated) return <Button className="w-full" onClick={login}>Hubungkan dompet Mindcaster</Button>;
  if (netKey === "solana") return <SolanaPanel selector={selector} />;
  if (!w) return <CreateEvmWallet />;

  async function send(): Promise<void> {
    if (!w) return;
    if (!isAddress(to)) { toast.error("Alamat tujuan tidak valid."); return; }
    const t = TOKENS.find((x) => x.sym === sym)!;
    let value: bigint;
    try { value = parseUnits(amount, t.decimals); } catch { { toast.error("Nominal tidak valid."); return; } }
    if (value <= 0n) { toast.error("Nominal tidak valid."); return; }
    setSending(true);
    try {
      await w.switchChain(BASE.id);
      const eth = await w.getEthereumProvider();
      const tx = t.address
        ? { from: w.address, to: t.address, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, value] }) }
        : { from: w.address, to, value: `0x${value.toString(16)}` };
      const hash = (await eth.request({ method: "eth_sendTransaction", params: [tx] })) as string;
      toast.success("Terkirim!", { action: { label: "Lihat", onClick: () => window.open(`${BASE.explorer}/tx/${hash}`, "_blank") } });
      setOpen(null); setTo(""); setAmount(""); setTimeout(() => void load(), 4000);
    } catch (e) { toast.error((e as Error).message.slice(0, 140)); } finally { setSending(false); }
  }

  const short = `${w.address.slice(0, 6)}…${w.address.slice(-4)}`;
  return (
    <>
      <section className="glass-panel rounded-[24px] border border-surface/80 p-5">
        <div className="flex items-center justify-between">
          {selector}
          <button onClick={() => { void navigator.clipboard.writeText(w.address); toast.success("Alamat disalin"); }} className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground"><Copy className="size-3.5" />{short}</button>
        </div>
        <div className="mt-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total saldo</p>
          <p className="mt-1 text-4xl font-bold">{usd(TOKENS.reduce((a, t) => a + (bal[t.sym] ?? 0) * (prices[t.sym]?.usd ?? 0), 0))}</p>
        </div>
        <ul className="mt-5 space-y-2">
          {TOKENS.map((t) => <TokenRow key={t.sym} sym={t.sym} amount={bal[t.sym]} price={prices[t.sym]} network={BASE.name} />)}
          <li className="flex items-center justify-between rounded-2xl bg-surface/40 px-3 py-3 text-sm text-muted-foreground"><span className="font-semibold">$MIND</span><span className="text-[11px] font-bold">SOON</span></li>
        </ul>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Button variant="surface" onClick={() => setOpen("receive")}><ArrowDownLeft className="size-4" />Receive</Button>
          <Button variant="surface" onClick={() => setOpen("send")}><ArrowUpRight className="size-4" />Send</Button>
          <Button variant="surface" asChild><a href={BASE.swap} target="_blank" rel="noreferrer"><ArrowLeftRight className="size-4" />Swap</a></Button>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <button onClick={() => void load()} className="flex items-center gap-1"><RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</button>
          <a href={`${BASE.explorer}/address/${w.address}`} target="_blank" rel="noreferrer" className="flex items-center gap-1">{BASE.explorerName}<ExternalLink className="size-3.5" /></a>
        </div>
      </section>

      <Dialog open={open === "receive"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Receive di {BASE.name}</DialogTitle></DialogHeader>
          {qr && <img src={qr} alt="QR alamat dompet" className="mx-auto size-56 rounded-xl bg-card p-2" />}
          <p className="break-all text-center font-mono text-xs">{w.address}</p>
          <p className="text-center text-xs text-muted-foreground">Kirim hanya aset jaringan {BASE.name} ke alamat ini.</p>
          <Button onClick={() => { void navigator.clipboard.writeText(w.address); toast.success("Alamat disalin"); }}><Copy className="size-4" />Salin alamat</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "send"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send di {BASE.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-2">{TOKENS.map((t) => <Button key={t.sym} size="sm" variant={sym === t.sym ? "default" : "surface"} onClick={() => setSym(t.sym)}>{t.sym}</Button>)}</div>
          <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="Alamat tujuan 0x…" className="h-10 rounded-xl border border-border/60 bg-surface/75 px-3 font-mono text-sm outline-none focus:border-primary" />
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} inputMode="decimal" placeholder={`Nominal (saldo ${bal[sym] ?? 0})`} className="h-10 rounded-xl border border-border/60 bg-surface/75 px-3 text-sm outline-none focus:border-primary" />
          <p className="text-xs text-muted-foreground">Butuh sedikit {BASE.native} di {BASE.name} untuk biaya jaringan.</p>
          <Button disabled={sending || !to || !amount} onClick={() => void send()}>{sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}Kirim {sym}</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function PrivyWallet() {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={{ loginMethods: ["email", "google"], defaultChain: SUPPORTED[0] as never, supportedChains: SUPPORTED as never,
      embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" }, solana: { createOnLogin: "users-without-wallets" } },
      externalWallets: { solana: { connectors: toSolanaWalletConnectors() } },
      solana: { rpcs: { "solana:mainnet": { rpc: createSolanaRpc(SOL_RPC), rpcSubscriptions: createSolanaRpcSubscriptions(SOL_WSS), blockExplorerUrl: "https://solscan.io" } } } }}>
      <Inner />
    </PrivyProvider>
  );
}
