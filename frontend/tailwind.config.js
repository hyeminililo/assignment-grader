/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f2933",
        line: "#d7dee8",
        panel: "#f7f9fc",
        accent: "#2563eb"
      }
    }
  },
  plugins: []
};
