import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Menu from "../components/Menu";
import PieDePagina from "../components/PieDePagina";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Openfit",
  description: "Entrena cuando quieras, sin cuotas ni permanencia.",
};

export const viewport = {
  themeColor: "#B5E600",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Menu />
        {children}
        <PieDePagina />
      </body>
    </html>
  );
}
