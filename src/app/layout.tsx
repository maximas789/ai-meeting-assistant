import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AI Meeting Assistant",
    template: "%s | AI Meeting Assistant",
  },
  description:
    "A local-first AI voice assistant for team meetings. Always listening, never leaking, instantly helpful.",
  keywords: [
    "AI",
    "Meeting Assistant",
    "Voice AI",
    "Local AI",
    "Ollama",
    "Speech to Text",
    "RAG",
    "Privacy",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "AI Meeting Assistant",
    title: "AI Meeting Assistant",
    description:
      "A local-first AI voice assistant for team meetings. Always listening, never leaking, instantly helpful.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Meeting Assistant",
    description:
      "A local-first AI voice assistant for team meetings. Always listening, never leaking, instantly helpful.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

// JSON-LD structured data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AI Meeting Assistant",
  description:
    "A local-first AI voice assistant for team meetings. Always listening, never leaking, instantly helpful.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SiteHeader />
          <main id="main-content">{children}</main>
          <SiteFooter />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
