/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#0a0a0b',
                surface: '#18181b',
                surfaceHover: '#27272a',
                primary: '#3b82f6',
                primaryHover: '#2563eb',
                accent: '#8b5cf6',
                accentHover: '#7c3aed',
                danger: '#ef4444',
                success: '#22c55e',
                warning: '#f59e0b',
                text: '#f4f4f5',
                textMuted: '#a1a1aa'
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['Fira Code', 'monospace']
            }
        },
    },
    plugins: [],
}
