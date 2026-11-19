import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { fontFamily: { sans: ["Sarabun", "Noto Sans Thai", "sans-serif"] } } },
} satisfies Config;
