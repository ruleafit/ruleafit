/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next dev` escribía solo un bloque de instrucciones para asistentes de IA en
  // AGENTS.md y CLAUDE.md. Ya está en CLAUDE.md, así que se desactiva para que no
  // reaparezcan archivos sin subir cada vez que se arranca el servidor.
  agentRules: false,
};

export default nextConfig;
