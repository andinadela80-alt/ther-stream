import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";

const PrivyWallet = lazy(() => (import.meta.env.SSR ? Promise.resolve({ default: () => null }) : import("@/components/PrivyWallet")) as Promise<typeof import("@/components/PrivyWallet")>);

export const Route = createFileRoute("/wallet")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Wallet — Mindcaster" },
      { name: "description", content: "Your Mindcaster wallet on Base: check balances, receive, send and swap tokens." },
      { property: "og:title", content: "Wallet — Mindcaster" },
      { property: "og:description", content: "Check balances, receive, send and swap tokens with your Mindcaster wallet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const spin = <p className="flex justify-center py-10"><Loader2 className="size-6 animate-spin" /></p>;
  return <AppShell title="Wallet">{() => (mounted ? <Suspense fallback={spin}><PrivyWallet /></Suspense> : spin)}</AppShell>;
}
