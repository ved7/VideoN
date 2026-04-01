import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          background: "#F5F5F7",
          primary: "#007AFF",
          text: "#1D1D1F",
          muted: "#6E6E73",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;

