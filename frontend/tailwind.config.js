/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
    "./projects/**/*.{html,ts}",
    "./apps/**/*.{html,ts}",
    "./libs/**/*.{html,ts}",
  ],

  theme: {
    extend: {
      colors: {
        build: {
          /* ===============================
             Neutral
          =============================== */

          ink: "#14181C",
          field: "#ECEEEC",
          surface: "#FFFFFF",
          concrete: "#E4E6E1",
          line: "#DADDD9",

          steel: "#545E67",
          "steel-light": "#8A939C",

          /* ===============================
             Brand
          =============================== */

          blueprint: "#0E2A47",
          "blueprint-light": "#3A6EA5",
          "blueprint-dark": "#0A1F35",

          /* ===============================
             Accent
          =============================== */

          safety: "#F2A900",
          "safety-dark": "#C2790A",

          action: "#2563EB",
          "action-dark": "#1D4ED8",

          /* ===============================
             Status
          =============================== */

          success: "#2E9E5B",
          warning: "#D98C13",
          danger: "#D1453B",
          info: "#3A6EA5",
        },
      },

      fontFamily: {
        sans: [
          '"IBM Plex Sans"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],

        display: [
          '"Space Grotesk"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],

        mono: [
          '"IBM Plex Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },

      boxShadow: {
        card: "0 8px 24px -12px rgba(14,26,36,0.14)",
        cardHover: "0 16px 34px -16px rgba(14,26,36,0.24)",
        hero: "0 24px 60px -24px rgba(14,42,71,0.30)",
        navbar: "0 2px 10px rgba(20,24,28,.05)",
      },

      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },

      backgroundImage: {
        "blueprint-grid":
          "linear-gradient(rgba(58,110,165,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(58,110,165,0.14) 1px, transparent 1px)",
      },

      backgroundSize: {
        grid: "32px 32px",
      },

      transitionTimingFunction: {
        smooth: "cubic-bezier(.4,0,.2,1)",
      },
    },
  },

  plugins: [],
};