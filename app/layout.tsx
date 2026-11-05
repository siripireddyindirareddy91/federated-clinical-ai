import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MediFed AI · Collaborative intelligence, private by design",
  description:
    "A synthetic-data research platform for federated learning, multi-agent orchestration, and explainable model evaluation.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
