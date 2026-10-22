/*
 * SITE CONTENT LISTS
 * ------------------
 * This is the only file you need to edit to keep the site up to date.
 * While a list is empty, the matching page shows a "coming soon" message.
 * Add an entry and it appears automatically.
 *
 * Put image files in the matching folder under /images and use the path
 * shown in the examples. If a person has no photo yet, leave "photo"
 * out and their initials are shown instead.
 *
 * Links must start with https:// (anything else is ignored for safety).
 */

const TEAM = [
  // Example: copy this block, remove the // marks, and fill it in.
  // {
  //   name: "Jane Doe",
  //   role: "Team Captain",
  //   program: "Mechanical Engineering, 3rd year",
  //   photo: "images/team/jane-doe.jpg"
  // },
];

const SPONSORS = [
  // tier can be "Gold", "Silver", "Bronze", or "Supporter"
  // {
  //   name: "Example Company",
  //   tier: "Gold",
  //   logo: "images/sponsors/example.png",
  //   url: "https://example.com"
  // },
];

const GALLERY = [
  // {
  //   src: "images/gallery/first-weld.jpg",
  //   caption: "First weld on the frame"
  // },
];

// Build log posts, newest first. "image" is optional.
const POSTS = [
  {
    date: "2026-10-22",
    title: "Our website is live",
    text: "USask Baja SAE now has a home online. Follow along here as we recruit our founding members, find partners, and start designing our first car."
  },
  // {
  //   date: "2026-11-05",
  //   title: "First team meeting",
  //   text: "Short description of what happened.",
  //   image: "images/gallery/first-meeting.jpg"
  // },
];

// Build progress tracker on the home page. percent is 0-100.
const PROGRESS = [
  { area: "Team founded", percent: 100 },
  { area: "Recruitment", percent: 0 },
  { area: "Sponsorship", percent: 0 },
  { area: "Car design (CAD)", percent: 0 },
  { area: "Manufacturing", percent: 0 },
  { area: "Testing", percent: 0 }
];

// Countdown on the home page. Leave date as "" until the event is confirmed.
// Date format: "2027-05-13T08:00:00-06:00" (the -06:00 is Saskatchewan time).
const COMPETITION = {
  name: "Our first Baja SAE competition",
  location: "",
  date: ""
};

// Spec sheet on the home and car pages. Use null for values not decided yet ("TBD").
const SPECS = [
  { label: "Weight", value: null, unit: "lb" },
  { label: "Power", value: null, unit: "hp" },
  { label: "Top speed", value: null, unit: "mph" },
  { label: "Ground clearance", value: null, unit: "in" },
  { label: "Suspension travel", value: null, unit: "in" },
  { label: "Wheelbase", value: null, unit: "in" }
];

// Social links. Leave a value as "" to hide it.
const SOCIALS = {
  Discord: "https://discord.gg/B2W6udGJtF",
  Instagram: "",
  TikTok: "",
  LinkedIn: "",
  YouTube: ""
};

// 3D model on The Car page. Leave src as "" to show the concept car.
// When the team's CAD is ready, export it as a .glb file, put it in the
// /models folder, and set src, e.g. "models/car.glb".
const CAR_MODEL = {
  src: ""
};
