import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { CreateEvmWallet } from "@/components/CreateEvmWallet";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
// @ts-expect-error qrcode ships without types
import QRCode from "qrcode";
import { decodeFunctionResult, defineChain, encodeFunctionData, erc20Abi, formatUnits, isAddress, parseUnits } from "viem";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PRIVY_APP_ID } from "@/lib/privy.functions";
import { CHAINS } from "@/lib/verification";
import { TokenRow } from "@/components/TokenRow";
import { usd, usePrices } from "@/lib/prices";
import { SolanaPanel, SOL_RPC, SOL_WSS } from "@/components/SolanaWallet";
import { SwapDialog } from "@/components/SwapDialog";
import { lifiQuote, NATIVE_EVM } from "@/lib/swap";
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

const POPULAR: Record<string, Tok[]> = {
  base: [
    { sym: "VIRTUAL", address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", decimals: 18 },
    { sym: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    { sym: "cbBTC", address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", decimals: 8 },
    { sym: "AERO", address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", decimals: 18 },
    { sym: "DEGEN", address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", decimals: 18 },
    { sym: "BRETT", address: "0x532f27101965dd16442E59d40670FaF5eBB142E4", decimals: 18 },
    { sym: "TOSHI", address: "0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4", decimals: 18 },
  ],
  arbitrum: [{ sym: "ARB", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18 }, { sym: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 }],
  ethereum: [{ sym: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 }, { sym: "PEPE", address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", decimals: 18 }],
  bnb: [{ sym: "CAKE", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", decimals: 18 }],
};
const customKey = (net: string) => `mc_custom_tokens_${net}`;
function loadCustom(net: string): Tok[] { try { return JSON.parse(localStorage.getItem(customKey(net)) ?? "[]") as Tok[]; } catch { return []; } }

async function rpcRaw(url: string, to: string, data: string) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }) });
  return ((await r.json()) as { result?: `0x${string}` }).result ?? "0x";
}

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
  const [custom, setCustom] = useState<Tok[]>([]);
  useEffect(() => { setCustom(loadCustom(netKey)); }, [netKey]);
  const ALL: Tok[] = [{ sym: BASE.native, decimals: 18 }, ...BASE.tokens, ...custom, ...(POPULAR[netKey] ?? []).filter((p) => !custom.some((c) => c.address?.toLowerCase() === p.address?.toLowerCase()))];
  const ALL_KEY = ALL.map((t) => t.sym).join(",");
  const [bal, setBal] = useState<Record<string, number>>({});
  const prices = usePrices();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<null | "receive" | "send" | "swap">(null);
  const [qr, setQr] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [sym, setSym] = useState("ETH");
  const [sending, setSending] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [ca, setCa] = useState("");
  const [preview, setPreview] = useState<Tok | null>(null);
  const [checking, setChecking] = useState(false);
  const TOKENS: Tok[] = ALL.filter((t, i) => i <= BASE.tokens.length || custom.includes(t) || (bal[t.sym] ?? 0) > 0);
  useEffect(() => { setSym(BASE.native); setBal({}); }, [BASE.native, netKey]);

  const load = useCallback(async () => {
    const net = NETS.find((n) => n.key === netKey);
    if (!w || !net) return;
    setLoading(true);
    try {
      const out: Record<string, number> = {};
      for (const t of ALL) {
        const v = t.address
          ? await rpc(net.rpc, "eth_call", [{ to: t.address, data: encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [w.address as `0x${string}`] }) }, "latest"])
          : await rpc(net.rpc, "eth_getBalance", [w.address, "latest"]);
        out[t.sym] = Number(formatUnits(v, t.decimals));
      }
      setBal(out);
    } catch { toast.error("Failed to load balance."); } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, netKey, ALL_KEY]);

  async function checkCa(v: string) {
    setCa(v); setPreview(null);
    if (!isAddress(v)) return;
    setChecking(true);
    try {
      const sym = decodeFunctionResult({ abi: erc20Abi, functionName: "symbol", data: await rpcRaw(BASE.rpc, v, encodeFunctionData({ abi: erc20Abi, functionName: "symbol" })) });
      const dec = decodeFunctionResult({ abi: erc20Abi, functionName: "decimals", data: await rpcRaw(BASE.rpc, v, encodeFunctionData({ abi: erc20Abi, functionName: "decimals" })) });
      setPreview({ sym: String(sym), address: v as `0x${string}`, decimals: Number(dec) });
    } catch { toast.error(`Bukan token ERC20 di ${BASE.name}.`); } finally { setChecking(false); }
  }
  function addToken() {
    if (!preview) return;
    if (ALL.slice(0, BASE.tokens.length + 1 + custom.length).some((t) => t.sym === preview.sym || t.address?.toLowerCase() === preview.address?.toLowerCase())) { toast.error("Token is already in the list."); return; }
    const next = [...custom, preview];
    localStorage.setItem(customKey(netKey), JSON.stringify(next)); setCustom(next);
    setAddOpen(false); setCa(""); setPreview(null); toast.success(`${preview.sym} ditambahkan`);
  }
  function removeToken(addr?: string) {
    const next = custom.filter((c) => c.address !== addr);
    localStorage.setItem(customKey(netKey), JSON.stringify(next)); setCustom(next);
  }
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (w) void QRCode.toDataURL(w.address, { margin: 1, width: 240 }).then(setQr); }, [w]);

  const selector = (
    <select aria-label="Network" value={netKey} onChange={(e) => setNetKey(e.target.value)} className="rounded-full border-0 bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary outline-none">
      {NETS.map((n) => <option key={n.key} value={n.key}>{n.name}</option>)}
      <option value="solana">Solana</option>
    </select>
  );
  if (!ready || !wReady) return <p className="flex justify-center py-10"><Loader2 className="size-6 animate-spin" /></p>;
  if (!authenticated) return <Button className="w-full" onClick={login}>Connect Mindcaster wallet</Button>;
  if (netKey === "solana") return <SolanaPanel selector={selector} />;
  if (!w) return <CreateEvmWallet />;

  async function send(): Promise<void> {
    if (!w) return;
    if (!isAddress(to)) { toast.error("Invalid recipient address."); return; }
    const t = TOKENS.find((x) => x.sym === sym)!;
    let value: bigint;
    try { value = parseUnits(amount, t.decimals); } catch { { toast.error("Invalid amount."); return; } }
    if (value <= 0n) { toast.error("Invalid amount."); return; }
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
          <button onClick={() => { void navigator.clipboard.writeText(w.address); toast.success("Address copied"); }} className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground"><Copy className="size-3.5" />{short}</button>
        </div>
        <div className="mt-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total balance</p>
          <p className="mt-1 text-4xl font-bold">{usd(TOKENS.reduce((a, t) => a + (bal[t.sym] ?? 0) * (prices[t.sym]?.usd ?? 0), 0))}</p>
        </div>
        <ul className="mt-5 space-y-2">
          {TOKENS.map((t) => <div key={t.sym} onContextMenu={(e) => { if (custom.includes(t)) { e.preventDefault(); if (confirm(`Remove ${t.sym} from the list?`)) removeToken(t.address); } }}><TokenRow sym={t.sym} amount={bal[t.sym]} price={prices[t.sym]} network={custom.includes(t) ? `${BASE.name} · custom` : BASE.name} /></div>)}
          <li className="flex items-center justify-between rounded-2xl bg-surface/40 px-3 py-3 text-sm text-muted-foreground"><span className="font-semibold">$MIND</span><span className="text-[11px] font-bold">SOON</span></li>
        </ul>
        <button onClick={() => setAddOpen(true)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border/60 py-2.5 text-xs font-semibold text-muted-foreground hover:text-primary"><Plus className="size-3.5" />Add token (smart contract)</button>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Button variant="surface" onClick={() => setOpen("receive")}><ArrowDownLeft className="size-4" />Receive</Button>
          <Button variant="surface" onClick={() => setOpen("send")}><ArrowUpRight className="size-4" />Send</Button>
          <Button variant="surface" onClick={() => setOpen("swap")}><ArrowLeftRight className="size-4" />Swap</Button>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <button onClick={() => void load()} className="flex items-center gap-1"><RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</button>
          <a href={`${BASE.explorer}/address/${w.address}`} target="_blank" rel="noreferrer" className="flex items-center gap-1">{BASE.explorerName}<ExternalLink className="size-3.5" /></a>
        </div>
      </section>

      <SwapDialog open={open === "swap"} onClose={() => setOpen(null)} network={BASE.name} balances={bal}
        tokens={TOKENS.map((t) => ({ sym: t.sym, id: t.address ?? NATIVE_EVM, decimals: t.decimals }))}
        getQuote={(f, t, a) => lifiQuote(BASE.id, f, t, a, w.address)}
        execute={async (q, f, a) => {
          const raw = q.raw as { estimate: { approvalAddress?: string }; transactionRequest: { to: string; data: string; value?: string; gasLimit?: string } };
          await w.switchChain(BASE.id);
          const eth = await w.getEthereumProvider();
          if (f.id !== NATIVE_EVM && raw.estimate.approvalAddress) {
            const spender = raw.estimate.approvalAddress as `0x${string}`;
            const allowance = await rpc(BASE.rpc, "eth_call", [{ to: f.id, data: encodeFunctionData({ abi: erc20Abi, functionName: "allowance", args: [w.address as `0x${string}`, spender] }) }, "latest"]);
            if (allowance < a) {
              toast.message("Approve the token first, then confirm the swap.");
              await eth.request({ method: "eth_sendTransaction", params: [{ from: w.address, to: f.id, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, a] }) }] });
              await new Promise((r) => setTimeout(r, 4000));
            }
          }
          const tx = raw.transactionRequest;
          await eth.request({ method: "eth_sendTransaction", params: [{ from: w.address, to: tx.to, data: tx.data, value: tx.value, gas: tx.gasLimit }] });
          setTimeout(() => void load(), 6000);
        }} />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add token on {BASE.name}</DialogTitle></DialogHeader>
          <input value={ca} onChange={(e) => void checkCa(e.target.value.trim())} placeholder="Contract address 0x…" className="h-10 rounded-xl border border-border/60 bg-surface/75 px-3 font-mono text-sm outline-none focus:border-primary" />
          {checking && <p className="flex justify-center"><Loader2 className="size-4 animate-spin" /></p>}
          {preview && <p className="rounded-xl bg-surface/60 p-3 text-sm"><b>{preview.sym}</b> · {preview.decimals} desimal</p>}
          <p className="text-xs text-muted-foreground">Popular tokens with a balance appear automatically. Long-press/right-click a custom token to remove it.</p>
          <Button disabled={!preview} onClick={addToken}><Plus className="size-4" />Add to list</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "receive"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Receive di {BASE.name}</DialogTitle></DialogHeader>
          {qr && <img src={qr} alt="Wallet address QR" className="mx-auto size-56 rounded-xl bg-card p-2" />}
          <p className="break-all text-center font-mono text-xs">{w.address}</p>
          <p className="text-center text-xs text-muted-foreground">Only send {BASE.name} network assets to this address.</p>
          <Button onClick={() => { void navigator.clipboard.writeText(w.address); toast.success("Address copied"); }}><Copy className="size-4" />Copy address</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "send"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send di {BASE.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-2">{TOKENS.map((t) => <Button key={t.sym} size="sm" variant={sym === t.sym ? "default" : "surface"} onClick={() => setSym(t.sym)}>{t.sym}</Button>)}</div>
          <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="Recipient address 0x…" className="h-10 rounded-xl border border-border/60 bg-surface/75 px-3 font-mono text-sm outline-none focus:border-primary" />
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} inputMode="decimal" placeholder={`Amount (balance ${bal[sym] ?? 0})`} className="h-10 rounded-xl border border-border/60 bg-surface/75 px-3 text-sm outline-none focus:border-primary" />
          <p className="text-xs text-muted-foreground">You need a little {BASE.native} on {BASE.name} for network fees.</p>
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
