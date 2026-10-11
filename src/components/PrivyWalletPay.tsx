import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { CreateEvmWallet } from "@/components/CreateEvmWallet";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PRIVY_APP_ID } from "@/lib/privy.functions";

export type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

type Props = { label: string; step: string | null; onPay: (eth: Eth, address: string) => void };

function Inner({ label, step, onPay }: Props) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets, ready: wReady } = useWallets();
  const embedded = wallets.find((w) => w.walletClientType === "privy");

  if (!ready || !wReady) return <Button className="w-full" disabled><Loader2 className="size-4 animate-spin" />Loading wallet…</Button>;
  if (!authenticated) return <Button className="w-full" variant="surface" onClick={login}>Connect Mindcaster wallet</Button>;
  if (!embedded) return <CreateEvmWallet />;

  return (
    <>
      <p className="break-all text-center text-xs text-muted-foreground">Your wallet: <span className="font-mono">{embedded.address}</span></p>
      <Button className="w-full" disabled={!!step} onClick={async () => onPay((await embedded.getEthereumProvider()) as Eth, embedded.address)}>
        {step ? <><Loader2 className="size-4 animate-spin" />{step}</> : label}
      </Button>
    </>
  );
}

export default function PrivyWalletPay(props: Props) {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={{ loginMethods: ["email", "google"], embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } } }}>
      <Inner {...props} />
    </PrivyProvider>
  );
}
