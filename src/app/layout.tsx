import type { Metadata } from "next";
import { Inter, Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CAP Task Board",
  description:
    "CAP Task Board — Today Board, Master Task Log, Coming Up Workload, Scorecard, Clients & Pitches, Team, and Account Governance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f4f5f9] text-[#1e2330] relative">
        {children}
        <div
          className="fixed bottom-1 right-2 z-50 pointer-events-none select-none text-[8.5px] font-mono tracking-widest text-[#1f2d5a]/20 uppercase"
          aria-hidden="true"
          title="SA"
        >
          SA
        </div>
      </body>
    </html>
  );
}
