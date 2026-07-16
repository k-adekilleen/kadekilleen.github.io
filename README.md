# kadekilleen.github.io

My personal site. Plain HTML, CSS, and JavaScript. No framework, no build step. GitHub Pages serves it straight from the root of this repo, so pushing to `main` deploys it.

## Viewing locally

```
python3 -m http.server 8877
```

Then open http://localhost:8877.

Cache busting is manual: when `style.css`, `main.js`, or `globe.js` change, bump the `?v=N` query string on every page that references them.

## Structure

| Path | What it is |
|---|---|
| `index.html` | Home page with the interactive globe |
| `about.html` | Bio, experience, education |
| `projects.html` | Research and things I've built |
| `contact.html` | Email and links |
| `style.css` | All styles, one file |
| `main.js` | Nav toggle and the copy-email button |
| `globe.js` | Three.js globe. The red markers plot real cost-exchange events from my research |
| `assets/` | Images (headshot, project figures) |
| `favicon.svg`, `robots.txt`, `sitemap.xml` | Root files that have to live in root |
