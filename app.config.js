// Extends app.json. WEB_BASE_URL lets the web build live under a sub-path,
// e.g. GitHub Pages: WEB_BASE_URL=/Hisam-portfilio npx expo export --platform web
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.WEB_BASE_URL ? { baseUrl: process.env.WEB_BASE_URL } : {}),
  },
});
