// Content is built with DOM methods and textContent (never innerHTML),
// so nothing in data.js can inject markup or scripts into the page.

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
    });
  }

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  setupThemeToggle();
  renderTeam();
  renderSponsors();
  renderGallery();
  renderPosts();
  renderSocials();
  renderProgress();
  renderSpecs();
  setupCountdown();
  setupQuiz();
  setupPlacement();
  setupReveal();
});

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Run fn once when the element scrolls into view (immediately if observers are unavailable).
function whenVisible(node, fn) {
  if (REDUCED_MOTION || !("IntersectionObserver" in window)) return fn();
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer.disconnect();
      fn();
    }
  }, { threshold: 0.3 });
  observer.observe(node);
}

// Dark/light toggle. Remembers the choice; otherwise follows the device.
function setupThemeToggle() {
  const button = document.querySelector(".theme-toggle");
  if (!button) return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
  const current = () => root.dataset.theme || (prefersDark.matches ? "dark" : "light");
  const label = () => button.setAttribute("aria-label", current() === "dark" ? "Switch to light mode" : "Switch to dark mode");

  button.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage unavailable: the choice lasts for this page only.
    }
    label();
  });
  prefersDark.addEventListener("change", label);
  label();
}

// Fade content in as it scrolls into view. Skipped for reduced-motion users,
// and content stays visible if this never runs.
function setupReveal() {
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const targets = document.querySelectorAll(
    ".hero-grid > *, .page-hero .container > *, main section:not(.hero):not(.page-hero) .container > :not(.grid):not(.roadmap):not(.list-grid), .cell, .roadmap li, .list-grid > *"
  );
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("in");
      observer.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -8% 0px" });

  targets.forEach((target) => {
    // Stagger siblings in grids and lists slightly
    const siblings = target.parentElement ? Array.from(target.parentElement.children) : [];
    const index = Math.min(siblings.indexOf(target), 5);
    if (index > 0) target.style.transitionDelay = `${index * 70}ms`;
    target.classList.add("reveal");
    observer.observe(target);
  });
}

// Element helper: el("div", { class: "x" }, child, "text", ...)
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value != null) node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

// Only allow local image paths (images/...) and https:// links.
function safeImage(path) {
  return typeof path === "string" && /^images\/[\w\-./]+$/.test(path) && !path.includes("..") ? path : null;
}
function safeLink(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function emptyState(title, message, href, label) {
  return el("div", { class: "empty-state" },
    el("span", { class: "eyebrow" }, "Coming soon"),
    el("h3", null, title),
    el("p", null, message),
    el("div", { class: "actions" }, el("a", { class: "btn btn-primary", href }, label))
  );
}

function renderTeam() {
  const root = document.getElementById("team-list");
  if (!root) return;
  if (!TEAM.length) {
    root.append(emptyState(
      "Our roster is being assembled",
      "We're just getting started and building the team right now. Want to be one of our founding members?",
      "join.html",
      "Join the team"
    ));
    return;
  }
  const grid = el("div", { class: "list-grid" });
  for (const person of TEAM) {
    const photo = safeImage(person.photo);
    grid.append(el("article", { class: "person" },
      photo
        ? el("img", { src: photo, alt: person.name || "", loading: "lazy" })
        : el("div", { class: "avatar", "aria-hidden": "true" }, initials(person.name)),
      el("h3", null, person.name || ""),
      el("div", { class: "role" }, person.role || ""),
      person.program ? el("p", null, person.program) : null
    ));
  }
  root.append(grid);
}

function renderSponsors() {
  const root = document.getElementById("sponsor-list");
  if (!root) return;
  if (!SPONSORS.length) {
    root.append(emptyState(
      "Become a founding sponsor",
      "We're looking for our first partners. Every contribution goes directly into building the car and bringing students to competition.",
      "join.html#sponsor",
      "Partner with us"
    ));
    return;
  }
  for (const tier of ["Gold", "Silver", "Bronze", "Supporter"]) {
    const list = SPONSORS.filter((s) => (s.tier || "Supporter") === tier);
    if (!list.length) continue;
    const grid = el("div", { class: "list-grid" });
    for (const sponsor of list) {
      const logo = safeImage(sponsor.logo);
      const link = safeLink(sponsor.url);
      const inner = logo ? el("img", { src: logo, alt: sponsor.name || "" }) : el("span", null, sponsor.name || "");
      grid.append(link
        ? el("a", { class: "sponsor", href: link, target: "_blank", rel: "noopener noreferrer" }, inner)
        : el("div", { class: "sponsor" }, inner));
    }
    root.append(el("div", { class: "tier" }, el("span", { class: "eyebrow" }, `${tier} Partners`), grid));
  }
}

function renderGallery() {
  const root = document.getElementById("gallery-list");
  if (!root) return;
  const photos = GALLERY.filter((g) => safeImage(g.src));
  if (!photos.length) {
    root.append(emptyState(
      "The build begins soon",
      "Once work on the car gets underway, we'll document it here, from the first weld to race day.",
      "about.html",
      "Read our mission"
    ));
    return;
  }
  const grid = el("div", { class: "list-grid" });
  for (const photo of photos) {
    grid.append(el("figure", { class: "gallery-item" },
      el("img", { src: safeImage(photo.src), alt: photo.caption || "", loading: "lazy" }),
      photo.caption ? el("figcaption", null, photo.caption) : null
    ));
  }
  root.append(grid);
}

function formatDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(d) ? iso : d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function renderPosts() {
  const root = document.getElementById("post-list");
  if (!root) return;
  if (!POSTS.length) {
    root.append(emptyState("The first entry is coming", "We'll document the build here as it happens.", "join.html", "Join the team"));
    return;
  }
  const list = el("ol", { class: "posts" });
  for (const post of POSTS) {
    const image = safeImage(post.image);
    list.append(el("li", { class: "post" },
      el("time", { datetime: post.date || "" }, formatDate(post.date || "")),
      el("div", null,
        el("h3", null, post.title || ""),
        el("p", null, post.text || ""),
        image ? el("img", { src: image, alt: post.title || "", loading: "lazy" }) : null
      )
    ));
  }
  root.append(list);
}

function renderSocials() {
  const links = Object.entries(SOCIALS)
    .map(([name, url]) => [name, safeLink(url)])
    .filter(([, url]) => url);
  document.querySelectorAll("[data-socials]").forEach((root) => {
    for (const [name, url] of links) {
      root.append(el("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, name));
    }
  });
}

function renderProgress() {
  const root = document.getElementById("progress-list");
  if (!root) return;
  for (const item of PROGRESS) {
    const pct = Math.max(0, Math.min(100, Number(item.percent) || 0));
    const fill = el("div", { class: "progress-fill" });
    root.append(el("li", null,
      el("div", { class: "progress-head" }, el("span", null, item.area || ""), el("span", { class: "pct" }, `${pct}%`)),
      el("div", { class: "progress-track", role: "progressbar", "aria-label": item.area || "", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct) }, fill)
    ));
    whenVisible(root, () => { fill.style.transform = `scaleX(${pct / 100})`; });
  }
}

function renderSpecs() {
  document.querySelectorAll("[data-specs]").forEach((root) => {
    for (const spec of SPECS) {
      const known = typeof spec.value === "number" && isFinite(spec.value);
      const value = el("span", { class: known ? "value" : "value tbd" }, known ? "0" : "TBD");
      root.append(el("div", { class: "spec" },
        el("span", { class: "label" }, spec.label || ""),
        value,
        known && spec.unit ? el("span", { class: "unit" }, spec.unit) : null
      ));
      if (known) whenVisible(root, () => countUp(value, spec.value));
    }
  });
}

function countUp(node, target) {
  const decimals = Number.isInteger(target) ? 0 : 1;
  if (REDUCED_MOTION) { node.textContent = target.toFixed(decimals); return; }
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / 1400);
    node.textContent = (target * (1 - Math.pow(1 - t, 3))).toFixed(decimals);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function setupCountdown() {
  const root = document.getElementById("countdown");
  if (!root) return;
  root.querySelector("h3").textContent = COMPETITION.name || "Competition";
  root.querySelector(".where").textContent = COMPETITION.location || "Location to be announced";
  const cells = root.querySelectorAll(".count-cell .n");
  const note = root.querySelector(".note");
  const target = COMPETITION.date ? new Date(COMPETITION.date) : null;
  if (!target || isNaN(target)) {
    note.textContent = "The date will be posted once our first event is confirmed.";
    return;
  }
  note.textContent = target.toLocaleString("en-CA", { dateStyle: "long", timeStyle: "short" });
  const update = () => {
    const ms = target - Date.now();
    if (ms <= 0) {
      cells.forEach((c) => { c.textContent = "00"; });
      note.textContent = "It's race day.";
      return clearInterval(timer);
    }
    const parts = [Math.floor(ms / 864e5), Math.floor(ms / 36e5) % 24, Math.floor(ms / 6e4) % 60, Math.floor(ms / 1e3) % 60];
    parts.forEach((n, i) => { cells[i].textContent = String(n).padStart(2, "0"); });
  };
  const timer = setInterval(update, 1000);
  update();
}

// Sub-team quiz on the Join page
const SUBTEAMS = {
  frame: { name: "Frame & Chassis", text: "You'd design and fabricate the roll cage that keeps the driver safe: tube layout, analysis, cutting, notching, and welding." },
  suspension: { name: "Suspension & Steering", text: "You'd make the car fast over rough ground: geometry, shocks, A-arms, and how the car turns and handles." },
  drivetrain: { name: "Drivetrain", text: "You'd get power from the engine to the wheels: the CVT, gearbox, axles, and making it all survive the endurance race." },
  business: { name: "Business & Media", text: "You'd keep the team running: sponsorships, finances, social media, design, and presenting to industry judges." }
};
const QUIZ = [
  { q: "Which of these sounds most fun?", a: [
    ["Welding and fabricating metal", "frame"],
    ["Tuning how a car handles bumps", "suspension"],
    ["Engines, gears, and raw power", "drivetrain"],
    ["Pitching ideas, design, and social media", "business"]
  ] },
  { q: "Pick the class you'd enjoy most.", a: [
    ["Strength of materials", "frame"],
    ["Dynamics and vibrations", "suspension"],
    ["Machine design", "drivetrain"],
    ["Marketing or finance", "business"]
  ] },
  { q: "On race day, where are you?", a: [
    ["Checking every weld before tech inspection", "frame"],
    ["Adjusting the shocks between runs", "suspension"],
    ["Fixing the CVT in the pits", "drivetrain"],
    ["Talking with judges and sponsors", "business"]
  ] }
];

function setupQuiz() {
  const root = document.getElementById("quiz");
  if (!root) return;
  let step = 0;
  let scores = {};

  const render = () => {
    root.replaceChildren();
    const bar = el("span");
    bar.style.transform = `scaleX(${step / QUIZ.length})`;
    root.append(el("div", { class: "quiz-bar" }, bar));

    if (step < QUIZ.length) {
      const question = QUIZ[step];
      const options = el("div", { class: "quiz-options", role: "group", "aria-label": question.q });
      for (const [label, team] of question.a) {
        const button = el("button", { class: "quiz-option", type: "button" }, label);
        button.addEventListener("click", () => {
          scores[team] = (scores[team] || 0) + 1;
          step += 1;
          render();
          root.querySelector("button")?.focus();
        });
        options.append(button);
      }
      root.append(el("span", { class: "quiz-step" }, `Question ${step + 1} of ${QUIZ.length}`), el("h3", null, question.q), options);
      return;
    }

    const best = Object.keys(SUBTEAMS).reduce((a, b) => ((scores[b] || 0) > (scores[a] || 0) ? b : a));
    const restart = el("button", { class: "quiz-restart", type: "button" }, "Retake the quiz");
    restart.addEventListener("click", () => { step = 0; scores = {}; render(); });
    const discord = safeLink(SOCIALS.Discord);
    root.append(el("div", { class: "quiz-result", "aria-live": "polite" },
      el("span", { class: "quiz-step" }, "Your match"),
      el("h3", null, SUBTEAMS[best].name),
      el("p", null, SUBTEAMS[best].text),
      el("div", { class: "actions" },
        discord ? el("a", { class: "btn btn-primary", href: discord, target: "_blank", rel: "noopener noreferrer" }, "Join our Discord") : null,
        restart
      )
    ));
  };
  render();
}

// Sponsor logo placement diagram: highlight a tier's zone on the car
function setupPlacement() {
  const root = document.getElementById("placement");
  if (!root) return;
  const buttons = root.querySelectorAll(".tier-btn");
  const zones = root.querySelectorAll(".zone");
  const activate = (tier) => {
    buttons.forEach((b) => {
      b.classList.toggle("active", b.dataset.tier === tier);
      b.setAttribute("aria-pressed", String(b.dataset.tier === tier));
    });
    zones.forEach((z) => z.classList.toggle("active", z.dataset.tier === tier));
  };
  buttons.forEach((b) => {
    ["mouseenter", "focus", "click"].forEach((evt) => b.addEventListener(evt, () => activate(b.dataset.tier)));
  });
  zones.forEach((z) => {
    ["mouseenter", "click"].forEach((evt) => z.addEventListener(evt, () => activate(z.dataset.tier)));
  });
  activate("Gold");
}
