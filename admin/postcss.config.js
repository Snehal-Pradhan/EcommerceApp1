// Tailwind v4 ships its own PostCSS plugin. The old v3 setup (tailwindcss +
// autoprefixer as postcss plugins) is removed in v4 and silently does nothing.
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
