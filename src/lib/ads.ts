import bannerMind from "@/assets/banner-buy-mind-pons.png.asset.json";
import bannerOgNft from "@/assets/banner-og-nft.png.asset.json";

export type Ad = { text: string; image?: string; cta?: string; href?: string; external?: boolean; aads?: boolean };

// Edit this list to change sponsored posts shown in the Home feed.
export const ADS: Ad[] = [
  { text: "$MIND is live on PONS on Robinhood Chain 🚀 The social & signal layer of the Robinhood ecosystem.\nCA: 0x7d249d242a02e19a10b367a2fa9407cb03bee1ac", image: bannerMind.url, cta: "Buy $MIND on PONS", href: "https://www.ponsfamily.com/launchpad/0x7d249d242a02e19a10b367a2fa9407cb03bee1ac", external: true },
  { text: "Discover crypto projects from our partners 👇", aads: true },
  { text: "Get your blue check ✅ Verify your Mindcaster account and stand out in the feed.", image: bannerOgNft.url, cta: "Verify account", href: "/verify" },
];

export const AD_EVERY = 5;
