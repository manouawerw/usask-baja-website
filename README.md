# USask Baja SAE Website

The official website of USask Baja SAE, the University of Saskatchewan's off-road racing team.

It's a static site (plain HTML, CSS, and JavaScript) with no build step, no dependencies, and no third-party requests.
To preview it, open `index.html` in a browser.

## Pages
| File | Page |
| --- | --- |
| `index.html` | Home: build tracker, countdown, spec sheet |
| `car.html` | Interactive 3D model of the car |
| `about.html` | Mission, vision, principles, roadmap |
| `team.html` | Team members |
| `log.html` | Build log posts |
| `gallery.html` | Build photos |
| `sponsors.html` | Sponsors |
| `join.html` | Join, sub-team quiz, partnerships, contact |

## Updating content
Almost everything is in **`js/data.js`**. Each list has examples to copy:

| List | What it controls |
| --- | --- |
| `TEAM` | Team page |
| `SPONSORS` | Sponsors page |
| `GALLERY` | Gallery page |
| `POSTS` | Build log (newest first) |
| `PROGRESS` | Build tracker bars on the home page (0–100) |
| `COMPETITION` | Countdown on the home page (leave `date` empty until it's confirmed) |
| `SPECS` | Spec sheet (`null` shows "TBD") |
| `SOCIALS` | Social links in the footer and on the home page (empty values are hidden) |
| `CAR_MODEL` | Which 3D model The Car page shows |

Empty lists show a "coming soon" message. Put images in `images/team`, `images/sponsors`, or `images/gallery`.

## The 3D car
`car.html` shows a concept buggy built in code (`js/car.js`). It has clickable hotspots, a drive mode (wheels spin and the suspension soaks up terrain), a bump test, an exploded view, an X-ray mode, and frame colour swatches.
To show your real CAD instead:
1. Export the model as a **`.glb`** file. SolidWorks, Fusion 360, Onshape, and Blender all support glTF/GLB export, through an add-in if needed. Aim for under 10 MB.
2. Put it in the `models/` folder.
3. In `js/data.js`, set `CAR_MODEL.src` to `"models/your-file.glb"`.

The model is centred and scaled automatically. To move a hotspot, edit its `anchor` in the `PARTS` list at the top of `js/car.js`.
The 3D library ([three.js](https://threejs.org), MIT license) is stored in `assets/vendor/three/`, so the site still loads nothing from outside.

To move the roadmap's "Now" marker, open `about.html` and put `class="current"` on a different step.

## Dark mode and motion
- The site follows the visitor's device setting for light or dark. The header button switches it and remembers the choice.
- Colours are set as variables at the top of `css/style.css`: light first, then the dark-mode overrides.
- Smooth scrolling and the fade-in as sections scroll into view switch off automatically for visitors whose device asks for reduced motion.

## Security
- **Content Security Policy:** only the site's own files may load. Inline scripts, inline styles, and outside resources are all blocked.
- **No third parties:** fonts (Inter and IBM Plex Mono, under the SIL Open Font License) and the 3D library are self-hosted, so visitors aren't tracked.
- **No injected markup:** content from `data.js` is added with `textContent` and never as raw HTML. Image paths must sit under `images/`, and links must be `https://`.
- **Safe external links:** they use `rel="noopener noreferrer"`.
- **No forms, cookies, or stored data:** there is nothing on the site to attack.
- **`_headers`:** adds full security headers (HSTS, frame blocking, nosniff) when hosted on Netlify or Cloudflare Pages.

When you edit the site, keep all scripts in `.js` files and all styles in `css/style.css`. The CSP blocks inline code.

## Hosting
- **GitHub Pages:** go to Settings, then Pages, choose the `main` branch and the `/` (root) folder, then turn on "Enforce HTTPS".
- **Cloudflare Pages or Netlify:** connect the repo with no build command. The `_headers` file is applied automatically.
