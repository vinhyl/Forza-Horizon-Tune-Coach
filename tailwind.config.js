export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                asphalt: "#20252b",
                signal: "#e25335",
                mint: "#2f9f88",
                paper: "#f8f6f0",
                line: "#dad6cc",
            },
            boxShadow: {
                panel: "0 16px 40px rgba(32, 37, 43, 0.12)",
            },
        },
    },
    plugins: [],
};
