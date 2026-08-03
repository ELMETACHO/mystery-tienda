import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import DevTools from "./DevTools";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Mystery — Cuadros personalizados",
  description: "Cuadros personalizados en vinilo sobre madera. Tu foto en la pared.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <DevTools />
        {children}
      </body>
    </html>
  );
}
