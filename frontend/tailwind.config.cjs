/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        sekolah: {
          primary: '#1d4ed8',
          secondary: '#16a34a',
          accent: '#0f766e',
          neutral: '#1f2937',
          'base-100': '#f8fafc',
          info: '#0284c7',
          success: '#16a34a',
          warning: '#f97316',
          error: '#dc2626'
        }
      },
      {
        'soft-sky': {
          primary: '#7aa2f7',
          secondary: '#8bd5ca',
          accent: '#f2b5d4',
          neutral: '#3b4252',
          'base-100': '#f7f8fc',
          info: '#8fbce6',
          success: '#8ccf9f',
          warning: '#f5c38e',
          error: '#e38e8e'
        }
      },
      {
        'soft-olive': {
          primary: '#7da173',
          secondary: '#a8c4a2',
          accent: '#e4c1a1',
          neutral: '#3a3a3a',
          'base-100': '#f8f6f1',
          info: '#93b5b5',
          success: '#84b58c',
          warning: '#e6c28b',
          error: '#d98b8b'
        }
      },
      {
        'soft-sand': {
          primary: '#c28f5c',
          secondary: '#e2c9a1',
          accent: '#cdb4db',
          neutral: '#3b342c',
          'base-100': '#fbf6ef',
          info: '#a7c1d9',
          success: '#9bc3a2',
          warning: '#e4b384',
          error: '#d9827b'
        }
      },
      {
        'soft-rose': {
          primary: '#e3a0a9',
          secondary: '#f3c7a6',
          accent: '#a8d1e7',
          neutral: '#463b3b',
          'base-100': '#fff6f7',
          info: '#b7d5f5',
          success: '#a6d5ba',
          warning: '#f0c08f',
          error: '#e08b8b'
        }
      },
      {
        'soft-lavender': {
          primary: '#a9a7d6',
          secondary: '#c7d6b6',
          accent: '#f2c4c4',
          neutral: '#3b3a46',
          'base-100': '#f7f6fb',
          info: '#b7c7e5',
          success: '#a7c8b7',
          warning: '#e9c18a',
          error: '#d98c8c'
        }
      }
    ]
  }
};
