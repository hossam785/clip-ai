/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "panel-bg": "#09090b",
        "card-bg": "#18181b",
        "border-brand": "#27272a",
        "primary-brand": "#8b5cf6",
        "primary-brand-hover": "#7c3aed",
        "text-main": "#f4f4f5",
        "text-muted": "#a1a1aa",
        zinc: {
          650: "#4b4b52",
          850: "#202024",
        },
        purple: {
          650: "#703fed",
        }
      },
    },
  },
  plugins: [],
}
