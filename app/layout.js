import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Menu from "../components/Menu";
import PieDePagina from "../components/PieDePagina";
import RegistrarServiceWorker from "../components/RegistrarServiceWorker";
import ManejadorApp from "../components/ManejadorApp";
import GestoAtras from "../components/GestoAtras";
import GestoRefrescar from "../components/GestoRefrescar";

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
      suppressHydrationWarning
    >
      <head>
        {/* Marca la página cuando se abre dentro de la app de iPhone (user agent
            "RuleafitApp", ver app-ios/capacitor.config.json), antes de pintar, para
            ocultar lo que solo tiene sentido en la web (clase .solo-web). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if(/RuleafitApp/.test(navigator.userAgent))document.documentElement.classList.add('app-nativa')",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <RegistrarServiceWorker />
        <ManejadorApp />
        <GestoAtras />
        <GestoRefrescar />
        <Menu />
        {children}
        <PieDePagina />
      </body>
    </html>
  );
}
