import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted rather than next/font/google, since this build environment's
// network access doesn't include fonts.googleapis.com. Fetched the actual
// font files from GitHub's official google/fonts mirror instead (an allowed
// domain) -- same real files, same OFL license, just loaded locally rather
// than fetched from Google's own CDN at build time. Caveat's file is a
// variable font (contains its full weight range in one file), so no
// discrete `weight` is declared for it.
const caveat = localFont({ src: "./fonts/Caveat-Variable.ttf", variable: "--font-caveat", weight: "400 700" });
const patrickHand = localFont({ src: "./fonts/PatrickHand-Regular.ttf", variable: "--font-patrick-hand", weight: "400" });
const architectsDaughter = localFont({ src: "./fonts/ArchitectsDaughter-Regular.ttf", variable: "--font-architects-daughter", weight: "400" });

export const metadata: Metadata = {
  title: "Expensior!",
  description: "Track expenses, savings and indulgence",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full ${caveat.variable} ${patrickHand.variable} ${architectsDaughter.variable}`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
