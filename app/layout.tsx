import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

const SITE_DESCRIPTION =
  "An endless paper grid for biblical literacy: Logos + Rhema, Prayer, " +
  "and Discipleship dots, with curated cross-references, an interlinear " +
  "Strong's reader, and live rooms for invited guests.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Bibliteracy — daily Scripture, kept on one page",
    template: "%s · Bibliteracy",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Bibliteracy",
  keywords: [
    "Bible",
    "Bible study",
    "interlinear",
    "Strong's numbers",
    "cross references",
    "Treasury of Scripture Knowledge",
    "discipleship",
    "prayer",
    "Logos",
    "Rhema",
    "TaNaK",
    "Hebrew",
    "Greek",
    "KJV",
  ],
  authors: [{ name: "Bibliteracy" }],
  creator: "Bibliteracy",
  publisher: "Bibliteracy",
  openGraph: {
    type: "website",
    siteName: "Bibliteracy",
    title: "Bibliteracy — daily Scripture, kept on one page",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bibliteracy",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  category: "religion",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f7f3ea",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-full overflow-hidden antialiased">{children}</body>
    </html>
  );
}
