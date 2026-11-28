# kadekilleen.github.io

My personal site. Plain HTML, CSS, and JavaScript. No framework, no build step. GitHub Pages serves it straight from the root of this repo, so pushing to `main` deploys it.

## Viewing locally

```
python3 -m http.server 8877
```

Then open http://localhost:8877.

Cache busting is manual: when `style.css` or a script changes, bump the `?v=N` query string on every page that references it.

## Structure

| Path | What it is |
|---|---|
| `index.html` | Home page: a line-drawn temple rising out of an interactive sea |
| `about.html` | Bio, experience, education |
| `projects.html` | List of research projects, each linking to its own page |
| `projects/` | One page per project. To add one, copy `projects/_template.html` and follow the steps at its top |
| `contact.html` | Email and links |
| `style.css` | All styles, one file |
| `main.js` | Shared behaviour: nav toggle, scroll reveals, line-art draw-in, live UTC clock |
| `home.js` | The home hero canvas (plain 2D canvas, no libraries, pauses off screen) |
| `war-globe.js` | Lightweight canvas globe on the Modern War page. The orange markers plot real cost-exchange events from the research |
| `assets/` | Images (headshot, project figures) |
| `favicon.svg`, `robots.txt`, `sitemap.xml` | Root files that have to live in root |
