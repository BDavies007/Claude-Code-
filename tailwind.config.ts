import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core surface palette — deep space / war-room dark
        base: {
          900: "#05070d",
          800: "#0a0e17",
          700: "#0f1420",
          600: "#161c2b",
          500: "#1d2435",
        },
        // Brand accents — neon green, teal, electric blue
        neon: {
          DEFAULT: "#39ff8b",
          soft: "#5cffa6",
          dim: "#1f7a4d",
        },
        teal: {
          DEFAULT: "#1fe0c8",
          soft: "#5cf2e0",
          dim: "#127a6e",
        },
        electric: {
          DEFAULT: "#3da9ff",
          soft: "#7cc6ff",
          dim: "#1b5e9e",
        },
        // Semantic
        danger: "#ff4d6d",
        warn: "#ffb454",
        good: "#39ff8b",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(57,255,139,0.35)",
        "glow-teal": "0 0 24px -4px rgba(31,224,200,0.35)",
        "glow-blue": "0 0 24px -4px rgba(61,169,255,0.35)",
        panel: "0 8px 40px -12px rgba(0,0,0,0.7)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(61,169,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(61,169,255,0.05) 1px, transparent 1px)",
        "radial-fade":
          "radial-gradient(circle at 50% 0%, rgba(31,224,200,0.10), transparent 60%)",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "flow-dash": {
          to: { strokeDashoffset: "-20" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        "flow-dash": "flow-dash 1s linear infinite",
        shimmer: "shimmer 2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
