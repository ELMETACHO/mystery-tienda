import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { SITE_URL } from "./lib/siteUrl";
import ChatWidget from "./components/ChatWidget";
import "./globals.css";

// Google Tag Manager — contenedor único (septiembre 2026). Las 3 tags de
// medición (Meta Pixel, TikTok Pixel, Google Ads) se configuran DENTRO del
// panel web de GTM, no acá — ver CLAUDE.md para los triggers exactos
// (begin_checkout/purchase, empujados al dataLayer desde app/lib/gtm.js).
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Mystery — Cuadros personalizados";
const DESCRIPTION = "Cuadros personalizados en vinilo sobre madera. Tu foto en la pared.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Mystery",
    images: [
      {
        url: "/images/Logo/logo-og.png",
        width: 1200,
        height: 630,
        alt: "Mystery Cuadros — Personaliza tu cuadro",
      },
    ],
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/images/Logo/logo-og.png"],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Mystery Cuadros",
  url: SITE_URL,
  logo: `${SITE_URL}/images/Logo/logo-navbar.png`,
  description: DESCRIPTION,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
        <ChatWidget />
        <Analytics />
        {GTM_ID && (
          <Script id="gtm-container" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
        )}
      </body>
    </html>
  );
}
