# USask Baja SAE Website

The official website of USask Baja SAE, the University of Saskatchewan's off-road racing team.

It's a static site (plain HTML, CSS, and JavaScript) with no build step, no dependencies, and no third-party requests.
To preview it, open `index.html` in a browser.

## Pages
| File | Page |
| --- | --- |
| `index.html` | Home |
| `about.html` | Mission, vision, principles, roadmap |
| `team.html` | Team members |
| `gallery.html` | Build photos |
| `sponsors.html` | Sponsors |
| `join.html` | Join, partnerships, contact |

## Adding team members, sponsors, or photos
Edit **`js/data.js`**. Each list starts empty, and an empty list shows a "coming soon" message on its page.
Copy the example entry, remove the `//`, and fill it in.
Put images in `images/team`, `images/sponsors`, or `images/gallery`.

To move the roadmap's "Now" marker, open `about.html` and put `class="current"` on a different step.

## Security
- **Content Security Policy:** only the site's own files may load. Inline scripts, inline styles, and outside resources are all blocked.
- **No third parties:** fonts (Inter and IBM Plex Mono, both under the SIL Open Font License) are self-hosted, so visitors aren't tracked.
- **No injected markup:** content from `data.js` is added with `textContent` and never as raw HTML. Image paths must sit under `images/`, and links must be `https://`.
- **Safe external links:** they use `rel="noopener noreferrer"`.
- **No forms, cookies, or stored data:** there is nothing on the site to attack.
- **`_headers`:** adds full security headers (HSTS, frame blocking, nosniff) when hosted on Netlify or Cloudflare Pages.

When you edit the site, keep all scripts in `.js` files and all styles in `css/style.css`. The CSP blocks inline code.

## Hosting
- **GitHub Pages:** go to Settings, then Pages, choose the `main` branch and the `/` (root) folder, then turn on "Enforce HTTPS".
- **Cloudflare Pages or Netlify:** connect the repo with no build command. The `_headers` file is applied automatically.
