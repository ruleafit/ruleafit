export default function manifest() {
  return {
    name: "Ruleafit",
    short_name: "Ruleafit",
    description: "Sesiones sueltas de entrenamiento en Sevilla y Málaga. Sin cuota ni permanencia.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBFAF3",
    theme_color: "#B5E600",
    icons: [
      {
        src: "/ruleafit-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/ruleafit-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  };
}
