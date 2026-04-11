# Kade Killeen — Personal Website

A minimal portfolio and blog site built with plain HTML, CSS, and JavaScript.

## Deploying to GitHub Pages

1. Create a new repository on GitHub (e.g., `yourusername.github.io` for a user site, or any name for a project site).

2. Initialize and push this project:
   ```bash
   cd /path/to/this/folder
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/yourusername.github.io.git
   git push -u origin main
   ```

3. In your GitHub repo, go to **Settings → Pages**.

4. Under **Source**, select **Deploy from a branch**, choose `main` and `/ (root)`, then click **Save**.

5. Your site will be live at `https://yourusername.github.io` within a few minutes.

## Local Development

Open `index.html` in a browser, or use any local server:

```bash
# Python
python3 -m http.server 8000

# Node (npx, no install needed)
npx serve .
```

## File Structure

```
index.html      — Home page
about.html      — About page
projects.html   — Projects page
contact.html    — Contact page
style.css       — All styles
main.js         — Mobile nav toggle
resume.pdf      — Resume (add your own file)
```

## Customization

- **Colors & fonts**: Edit the CSS custom properties in `:root` at the top of `style.css`.
- **Add a project card**: Copy an `<article class="project-card">` block in `projects.html` and update the content.
- **Resume**: Replace `resume.pdf` with your actual resume file. The nav link already points to it.
- **Placeholder URLs**: Search for `yourusername` and `your@email.com` across all HTML files and replace with your real links.
