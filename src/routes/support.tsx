import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  Copyright,
  FileText,
  Flag,
  Loader2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/support")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Support & About — Mindcaster" },
      { name: "description", content: "Mindcaster support, safety, community guidelines, and policies." },
      { property: "og:title", content: "Support & About — Mindcaster" },
      { property: "og:description", content: "Find help, safety guidance, and Mindcaster policies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell title="Support">{(user) => <SupportPage userId={user.id} />}</AppShell>,
});

type Panel = "report" | "help" | "safety" | "community" | "terms" | "privacy" | "ip" | null;

const INFO: Record<Exclude<Panel, "report" | null>, { title: string; description: string; body: ReactNode }> = {
  help: {
    title: "Help Center",
    description: "Quick answers for using Mindcaster.",
    body: (
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="post"><AccordionTrigger>How do I create a post?</AccordionTrigger><AccordionContent className="text-muted-foreground">Write your idea on Home, add a photo if you like, then tap Post. Each post is limited to 500 characters.</AccordionContent></AccordionItem>
        <AccordionItem value="wallet"><AccordionTrigger>How do I get a wallet?</AccordionTrigger><AccordionContent className="text-muted-foreground">A wallet is created automatically when you sign in. You can see its address on your Profile. Mindcaster never asks for your seed phrase.</AccordionContent></AccordionItem>
        <AccordionItem value="verify"><AccordionTrigger>How do I get the blue check?</AccordionTrigger><AccordionContent className="text-muted-foreground">Open Verify account from the Home menu, choose a plan and network, then complete the payment from your wallet.</AccordionContent></AccordionItem>
        <AccordionItem value="story"><AccordionTrigger>How long do stories last?</AccordionTrigger><AccordionContent className="text-muted-foreground">Photo or video stories last 24 hours and can be deleted earlier by their owner.</AccordionContent></AccordionItem>
      </Accordion>
    ),
  },
  safety: {
    title: "Safety Center",
    description: "Protect your account and digital assets.",
    body: <InfoBody items={["Never share your password, private key, or seed phrase.", "Check the wallet address, network, token, and amount before approving a transaction.", "Only use Mindcaster from the official address and beware of links asking for secret data.", "Report suspicious accounts, posts, or activity using the report feature."]} />,
  },
  community: {
    title: "Community Guidelines",
    description: "A healthy onchain space starts with us.",
    body: <InfoBody items={["Respect other users and differing opinions.", "No harassment, threats, spam, scams, or manipulation.", "Do not share other people's personal data without permission.", "Content must follow the law and respect the rights of others."]} />,
  },
  terms: {
    title: "Terms of Service",
    description: "The key terms for using Mindcaster.",
    body: <InfoBody items={["You are responsible for your content, account, and wallet activity.", "Mindcaster may restrict content or accounts that break the community guidelines.", "Onchain information is not financial advice; transaction decisions remain your responsibility.", "The service may change to improve security and user experience."]} />,
  },
  privacy: {
    title: "Privacy Policy",
    description: "How Mindcaster handles your information.",
    body: <InfoBody items={["Account data is used to provide sign-in, profiles, social interactions, and support.", "Bookmarks, messages, reports, and personal data are protected so only authorized people can access them.", "Wallet addresses and blockchain activity are public once recorded on the network.", "Mindcaster never sells your password, private key, or secret wallet data."]} />,
  },
  ip: {
    title: "Intellectual Property Policy",
    description: "Respecting creative work and digital ownership.",
    body: <InfoBody items={["Only upload content you own or have the right to use.", "Credit other people's work when its license requires it.", "Rights holders can report suspected violations through Report a Problem.", "Mindcaster may restrict content proven to infringe copyright or trademarks."]} />,
  },
};

function InfoBody({ items }: { items: string[] }) {
  return <ul className="space-y-3 text-sm leading-relaxed text-foreground/80">{items.map((item) => <li key={item} className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{item}</li>)}</ul>;
}

function SupportPage({ userId }: { userId: string }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [category, setCategory] = useState("bug");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const supportItems = [
    { id: "report" as const, icon: Flag, title: "Report a Problem", note: "Bugs, account, or transactions" },
    { id: "help" as const, icon: CircleHelp, title: "Help Center", note: "Answers and how-to guides" },
    { id: "safety" as const, icon: ShieldCheck, title: "Safety Center", note: "Keep your account and wallet safe" },
  ];
  const aboutItems = [
    { id: "community" as const, icon: UsersRound, title: "Community Guidelines" },
    { id: "terms" as const, icon: BookOpen, title: "Terms of Service" },
    { id: "privacy" as const, icon: FileText, title: "Privacy Policy" },
    { id: "ip" as const, icon: Copyright, title: "Intellectual Property Policy" },
  ];

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("support_reports").insert({ user_id: userId, category, subject: subject.trim(), description: description.trim() });
    setBusy(false);
    if (error) { toast.error("Could not send the report. Please try again."); return; }
    setSubject(""); setDescription(""); setCategory("bug"); setPanel(null);
    toast.success("Report sent.");
  }

  const selected = panel && panel !== "report" ? INFO[panel] : null;

  return (
    <>
      <section aria-labelledby="about-mindcaster" className="rounded-2xl border border-border/70 bg-surface/80 p-5">
        <p className="text-[11px] font-bold uppercase text-muted-foreground">About Mindcaster</p>
        <h2 id="about-mindcaster" className="mt-1 text-lg font-bold text-foreground">Where Ideas Become Onchain</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/80">Mindcaster is a decentralized (Web3) social platform that connects crypto community discussion directly with onchain data. Combining modern microblogging with the power of the Web3 ecosystem, Mindcaster lets you:</p>
        <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-foreground/80">
          <li className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" /><span><b className="text-foreground">Share Ideas & Stories:</b> post thoughts, join feed discussions, and share photos/videos through 24-hour Stories.</span></li>
          <li className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" /><span><b className="text-foreground">Market Signals & Alpha (FOMO Hub):</b> track real-time buy/sell signals, curated trader theses, and a weekly PnL leaderboard.</span></li>
          <li className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" /><span><b className="text-foreground">Onchain Identity & Verification:</b> get a built-in crypto wallet and earn the blue check and OG Badge via payment on Base, Polygon, and BNB Chain.</span></li>
        </ul>
      </section>

      <section aria-labelledby="support-heading">
        <p id="support-heading" className="mb-2 px-2 text-[11px] font-bold uppercase text-muted-foreground">Support</p>
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface/80">
          {supportItems.map(({ id, icon: Icon, title, note }, index) => (
            <Button key={id} type="button" variant="ghost" onClick={() => setPanel(id)} className={`h-auto w-full justify-start rounded-none px-4 py-3.5 text-left ${index ? "border-t border-border/70" : ""}`}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-link"><Icon className="size-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{title}</span><span className="block truncate text-xs font-normal text-muted-foreground">{note}</span></span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          ))}
        </div>
      </section>

      <section aria-labelledby="about-heading">
        <p id="about-heading" className="mb-2 px-2 text-[11px] font-bold uppercase text-muted-foreground">About</p>
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface/80">
          {aboutItems.map(({ id, icon: Icon, title }, index) => (
            <Button key={id} type="button" variant="ghost" onClick={() => setPanel(id)} className={`h-auto w-full justify-start rounded-none px-4 py-4 text-left ${index ? "border-t border-border/70" : ""}`}>
              <Icon className="size-5 shrink-0 text-link" /><span className="flex-1 text-sm font-semibold text-foreground">{title}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          ))}
        </div>
      </section>

      <p className="py-2 text-center text-[11px] text-muted-foreground">Mindcaster · Where Ideas Become Onchain</p>

      <Dialog open={panel === "report"} onOpenChange={(open) => !open && setPanel(null)}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
          <form onSubmit={submitReport} className="space-y-4">
            <DialogHeader><DialogTitle>Report a Problem</DialogTitle><DialogDescription>Tell us what went wrong. Reports are only visible to you and the Mindcaster team.</DialogDescription></DialogHeader>
            <label className="block text-xs font-semibold text-foreground/70">Issue type<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"><option value="bug">App bug</option><option value="account">Account</option><option value="transaction">Transaction</option><option value="other">Other</option></select></label>
            <label className="block text-xs font-semibold text-foreground/70">Title<input required minLength={3} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" placeholder="Short summary" /></label>
            <label className="block text-xs font-semibold text-foreground/70">Detail<textarea required minLength={10} maxLength={2000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" placeholder="What happened and when?" /></label>
            <DialogFooter className="flex-row justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}Send report</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setPanel(null)}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
          {selected && <><DialogHeader><DialogTitle>{selected.title}</DialogTitle><DialogDescription>{selected.description}</DialogDescription></DialogHeader>{selected.body}</>}
        </DialogContent>
      </Dialog>
    </>
  );
}