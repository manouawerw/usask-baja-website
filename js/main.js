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
  setupReveal();
});

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
