/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        brand: {
          from: '#DD98AF',
          to: '#C87F97',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          sunken: 'rgb(var(--color-surface-sunken) / <alpha-value>)',
          hover: 'rgb(var(--color-surface-hover) / <alpha-value>)',
          glass: 'var(--color-surface-glass)',
        },
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        scrim: 'var(--color-scrim)',
        text: {
          DEFAULT: 'rgb(var(--color-text) / <alpha-value>)',
          strong: 'rgb(var(--color-text-strong) / <alpha-value>)',
          muted: 'var(--color-text-muted)',
          placeholder: 'var(--color-text-placeholder)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          subtle: 'rgb(var(--color-border-subtle) / <alpha-value>)',
          card: 'var(--color-border-card)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          strong: 'rgb(var(--color-accent-strong) / <alpha-value>)',
          hover: 'rgb(var(--color-accent-hover) / <alpha-value>)',
          text: 'rgb(var(--color-accent-text) / <alpha-value>)',
        },
        'on-accent': 'rgb(var(--color-on-accent) / <alpha-value>)',
        'focus-ring': 'rgb(var(--color-focus-ring) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        rating: 'rgb(var(--color-rating) / <alpha-value>)',
      },
      borderRadius: {
        card: '1.5rem',
      },
      boxShadow: {
        cta: '0 20px 25px -5px rgba(221, 152, 175, 0.3), 0 8px 10px -6px rgba(221, 152, 175, 0.3)',
        'cta-hover': '0 25px 50px -12px rgba(221, 152, 175, 0.4)',
      },
      fontSize: {
        display: ['2rem', { lineHeight: '2.25rem', fontWeight: '800', letterSpacing: '-0.025em' }],
        h1: ['1.5rem', { lineHeight: '2rem', fontWeight: '800', letterSpacing: '-0.025em' }],
        h2: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '700' }],
        body: ['1rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        small: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(12px)' },
        },
        pageIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pageOut: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(10px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease-out',
        'fade-out': 'fadeOut 300ms ease-in',
        'slide-up': 'slideUp 400ms ease-out',
        'slide-down': 'slideDown 400ms ease-in',
        'page-in': 'pageIn 400ms ease-out',
        'page-out': 'pageOut 400ms ease-in',
        'float': 'float 5s ease-in-out infinite',
        'shimmer': 'shimmer 1.2s linear infinite',
      },
    },
  },
  plugins: [],
};
