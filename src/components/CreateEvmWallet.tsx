import { useCreateWallet } from "@privy-io/react-auth";
import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CreateEvmWallet() {
  const { createWallet } = useCreateWallet();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3 text-center">
      <p className="text-sm text-muted-foreground">This account has no Mindcaster wallet yet. Activate it in one tap.</p>
      <Button className="w-full" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await createWallet(); toast.success("Wallet activated!"); }
        catch (e) { toast.error((e as Error).message.slice(0, 140)); }
        finally { setBusy(false); }
      }}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}Activate Mindcaster Wallet</Button>
    </div>
  );
}
