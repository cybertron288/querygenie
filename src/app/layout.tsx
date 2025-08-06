import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// Font configurations
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

// Metadata for SEO
export const metadata: Metadata = {
  title: {
    default: "QueryGenie - AI-Powered Database Assistant",
    template: "%s | QueryGenie",
  },
  description:
    "AI-powered database assistant for teams. Generate SQL queries, document schemas, visualize ERDs, and collaborate with your team.",
  keywords: [
    "database",
    "sql",
    "ai",
    "query builder",
    "schema documentation",
    "erd",
    "team collaboration",
  ],
  authors: [{ name: "QueryGenie Team" }],
  creator: "QueryGenie",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://querygenie.com",
    siteName: "QueryGenie",
    title: "QueryGenie - AI-Powered Database Assistant",
    description:
      "Generate SQL queries, document schemas, and collaborate with your team using AI.",
    images: [
      {
        url: "https://querygenie.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "QueryGenie",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QueryGenie - AI-Powered Database Assistant",
    description:
      "Generate SQL queries, document schemas, and collaborate with your team using AI.",
    images: ["https://querygenie.com/og-image.png"],
    creator: "@querygenie",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

// Viewport configuration
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}