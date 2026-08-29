import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Menu from "../components/Menu";
import PieDePagina from "../components/PieDePagina";
import RegistrarServiceWorker from "../components/RegistrarServiceWorker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://www.ruleafit.com"),
  title: "Ruleafit",
  description: "Entrena cuando quieras, sin cuotas ni permanencia.",
  verification: {
    google: "yiCqj7T2AtZAHRaU1Tv6joiiE7sFaqyuchPKjjwt0yk",
  },
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
        <RegistrarServiceWorker />
        <Menu />
        {children}
        <PieDePagina />
      </body>
    </html>
  );
}
