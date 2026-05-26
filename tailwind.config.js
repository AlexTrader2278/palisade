/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#eef2f8",
        ink: "#132036",
        soft: "#ffffff",
        muted: "#6c768d",
        accent: "#2c5cff",
        accent2: "#7c3aed",
        line: "#d7deec",
      },
      boxShadow: {
        neu: "12px 12px 28px #c1c9d8, -12px -12px 28px #ffffff",
        neuSm: "6px 6px 16px #c1c9d8, -6px -6px 16px #ffffff",
        inset: "inset 8px 8px 18px #c4cce0, inset -8px -8px 18px #ffffff",
      },
    },
  },
  plugins: [],
};
