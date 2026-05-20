/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				primary: {
					DEFAULT: "#f59e0b",
					hover: "#d97706",
					muted: "rgba(245, 158, 11, 0.15)",
				},
			},
			keyframes: {
				"bell-swing": {
					"0%, 100%": { transform: "rotate(0deg)" },
					"18%": { transform: "rotate(16deg)" },
					"36%": { transform: "rotate(-14deg)" },
					"54%": { transform: "rotate(10deg)" },
					"72%": { transform: "rotate(-6deg)" },
					"90%": { transform: "rotate(3deg)" },
				},
				"loading-msg-in": {
					"0%": { opacity: "0", transform: "translateY(8px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
			},
			animation: {
				"spin-slow": "spin 20s linear infinite",
				"bell-swing": "bell-swing 2.4s ease-in-out infinite",
				"loading-msg-in": "loading-msg-in 0.45s ease-out forwards",
			},
		},
	},
	plugins: [],
};
