export default function manifest() {
  return {
    name: "Ruleafit",
    short_name: "Ruleafit",
    description: "Sesiones sueltas de entrenamiento. Sin cuota ni permanencia.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es",
    dir: "ltr",
    categories: ["health", "fitness", "sports"],
    background_color: "#FBFAF3",
    theme_color: "#B5E600",
    icons: [
      { src: "/ruleafit-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/ruleafit-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // El logo está dentro de la zona segura central, así que el mismo dibujo vale
      // como icono adaptable de Android (maskable).
      { src: "/ruleafit-icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/ruleafit-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ],
    shortcuts: [
      { name: "Buscar sesiones", short_name: "Sesiones", url: "/clases" },
      { name: "Mis reservas", short_name: "Reservas", url: "/mis-reservas" },
      { name: "Publicar sesión", short_name: "Publicar", url: "/publicar" }
    ]
  };
}
