/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Monochrome palette
        ink: {
          50:  "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
          950: "#0a0a0a"
        }
      },
      borderRadius: {
        xl2: "1rem"
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.04) inset"
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      backgroundColor: {
        base: '#0a0a0a'
      },
      textColor: {
        base: '#f5f5f5'
      }
    }
  },
  plugins: []
};
