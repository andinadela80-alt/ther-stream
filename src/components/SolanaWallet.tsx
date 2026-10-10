import { useCallback, useEffect, useState } from "react";
import { useCreateWallet, useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";
import { address, appendTransactionMessageInstruction, compileTransaction, createNoopSigner, createSolanaRpc, createTransactionMessage, getTransactionEncoder, isAddress, lamports, pipe, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash } from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
// @ts-expect-error qrcode ships without types
import QRCode from "qrcode";
import { toast } from "sonner";

import { TokenRow } from "@/components/TokenRow";
import { usd, usePrices } from "@/lib/prices";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const SOL_RPC = "https://solana-rpc.publicnode.com";
export const SOL_WSS = "wss://solana-rpc.publicnode.com";
const USDC_MINT = "EPjFWJd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const rpc = createSolanaRpc(SOL_RPC);

export function SolanaPanel({ selector }: { selector: React.ReactNode }) {
  const { wallets, ready } = useWallets();
  const { createWallet } = useCreateWallet();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const w = wallets.find((x) => x.standardWallet?.name === "Privy") ?? wallets[0];
  const [bal, setBal] = useState<{ SOL?: number; USDC?: number }>({});
  const prices = usePrices();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<null | "receive" | "send">(null);
  const [qr, setQr] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!w) return;
    setLoading(true);
    try {
      const { value } = await rpc.getBalance(address(w.address)).send();
      let usdc = 0;
      try {
        const { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } = await import("@solana-program/token");
        const [ata] = await findAssociatedTokenPda({ owner: address(w.address), mint: address(USDC_MINT), tokenProgram: TOKEN_PROGRAM_ADDRESS });
        const info = await rpc.getAccountInfo(ata, { encoding: "jsonParsed" }).send();
        const d = info.value?.data as { parsed?: { info?: { tokenAmount?: { uiAmount?: number } } } } | undefined;
        usdc = Number(d?.parsed?.info?.tokenAmount?.uiAmount ?? 0);
      } catch { usdc = 0; }
      setBal({ SOL: Number(value) / 1e9, USDC: usdc });
    } catch { toast.error("Gagal memuat saldo Solana."); } finally { setLoading(false); }
  }, [w]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (w) void QRCode.toDataURL(w.address, { margin: 1, width: 240 }).then(setQr); }, [w]);

  if (!ready) return <p className="flex justify-center py-10"><Loader2 className="size-6 animate-spin" /></p>;
  if (!w) return (
    <section className="glass-panel space-y-4 rounded-[24px] border border-surface/80 p-5">
      {selector}
      <p className="text-sm text-muted-foreground">Kamu belum punya dompet Solana. Buat sekarang, gratis.</p>
      <Button className="w-full" disabled={creating} onClick={async () => { setCreating(true); try { await createWallet(); toast.success("Dompet Solana dibuat"); } catch (e) { toast.error((e as Error).message.slice(0, 140)); } finally { setCreating(false); } }}>
        {creating && <Loader2 className="size-4 animate-spin" />}Buat dompet Solana
      </Button>
    </section>
  );

  async function send() {
    if (!w) return;
    if (!isAddress(to)) { toast.error("Alamat Solana tidak valid."); return; }
    const n = Number(amount);
    if (!(n > 0)) { toast.error("Nominal tidak valid."); return; }
    setSending(true);
    try {
      const { value: bh } = await rpc.getLatestBlockhash().send();
      const signer = createNoopSigner(address(w.address));
      const msg = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayer(signer.address, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
        (m) => appendTransactionMessageInstruction(getTransferSolInstruction({ source: signer, destination: address(to), amount: lamports(BigInt(Math.round(n * 1e9))) }), m),
      );
      const bytes = new Uint8Array(getTransactionEncoder().encode(compileTransaction(msg)));
      await signAndSendTransaction({ transaction: bytes, wallet: w, chain: "solana:mainnet" });
      toast.success("SOL terkirim!");
      setOpen(null); setTo(""); setAmount(""); setTimeout(() => void load(), 4000);
    } catch (e) { toast.error((e as Error).message.slice(0, 140)); } finally { setSending(false); }
  }

  const short = `${w.address.slice(0, 4)}…${w.address.slice(-4)}`;
  const copy = () => { void navigator.clipboard.writeText(w.address); toast.success("Alamat disalin"); };
  return (
    <>
      <section className="glass-panel rounded-[24px] border border-surface/80 p-5">
        <div className="flex items-center justify-between">
          {selector}
          <button onClick={copy} className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground"><Copy className="size-3.5" />{short}</button>
        </div>
        <div className="mt-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total saldo</p>
          <p className="mt-1 text-4xl font-bold">{usd((bal.SOL ?? 0) * (prices["SOL"]?.usd ?? 0) + (bal.USDC ?? 0) * (prices["USDC"]?.usd ?? 1))}</p>
        </div>
        <ul className="mt-5 space-y-2">
          {(["SOL", "USDC"] as const).map((s) => <TokenRow key={s} sym={s} amount={bal[s]} price={prices[s]} network="Solana" />)}
        </ul>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Button variant="surface" onClick={() => setOpen("receive")}><ArrowDownLeft className="size-4" />Receive</Button>
          <Button variant="surface" onClick={() => setOpen("send")}><ArrowUpRight className="size-4" />Send</Button>
          <Button variant="surface" asChild><a href="https://jup.ag" target="_blank" rel="noreferrer"><ArrowLeftRight className="size-4" />Swap</a></Button>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <button onClick={() => void load()} className="flex items-center gap-1"><RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</button>
          <a href={`https://solscan.io/account/${w.address}`} target="_blank" rel="noreferrer" className="flex items-center gap-1">Solscan<ExternalLink className="size-3.5" /></a>
        </div>
      </section>

      <Dialog open={open === "receive"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Receive di Solana</DialogTitle></DialogHeader>
          {qr && <img src={qr} alt="QR alamat Solana" className="mx-auto size-56 rounded-xl bg-card p-2" />}
          <p className="break-all text-center font-mono text-xs">{w.address}</p>
          <p className="text-center text-xs text-muted-foreground">Kirim hanya aset jaringan Solana ke alamat ini.</p>
          <Button onClick={copy}><Copy className="size-4" />Salin alamat</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "send"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send SOL</DialogTitle></DialogHeader>
          <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="Alamat Solana tujuan" className="w-full rounded-xl bg-surface px-3 py-2.5 font-mono text-xs outline-none" />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={`Nominal SOL (saldo ${bal.SOL ?? "—"})`} className="w-full rounded-xl bg-surface px-3 py-2.5 text-sm outline-none" />
          <Button disabled={sending} onClick={() => void send()}>{sending && <Loader2 className="size-4 animate-spin" />}Kirim</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
