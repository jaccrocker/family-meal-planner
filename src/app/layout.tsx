import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { Nav } from "@/components/Nav";
import { PlannerProvider } from "@/components/PlannerProvider";
import "./globals.css";

const body = Figtree({ variable: "--font-body", subsets: ["latin"] });
const heading = Bricolage_Grotesque({ variable: "--font-heading", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Family Meal Planner",
  description: "Pick the week's meals; get a grocery list scaled to your household and ready for Instacart.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable} antialiased`}>
      <body className="min-h-screen font-sans">
        <PlannerProvider>
          <Nav />
          <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
        </PlannerProvider>
      </body>
    </html>
  );
}
