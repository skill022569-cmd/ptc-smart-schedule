import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Sarabun", "Noto Sans Thai", "sans-serif"] },
      colors: {
        // โทนเลือดหมู-ทอง ตามตราวิทยาลัยการอาชีพโพนทอง
        brand: { 50: "#fbf4f4", 100: "#f4e2e2", 200: "#e6c2c2", 400: "#b5484d", 700: "#7f131a", 800: "#6a1016", 900: "#4b0a0f" },
        gold: { 300: "#e8cf7a", 500: "#c9a227", 700: "#8f7016" },
      },
    },
  },
} satisfies Config;
