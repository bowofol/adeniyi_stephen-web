document.documentElement.classList.add("js");

const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const header = document.querySelector("[data-header]");
const revealItems = document.querySelectorAll(".reveal");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function closeNavigation() {
  if (!toggle || !nav) return;
  toggle.setAttribute("aria-expanded", "false");
  nav.classList.remove("is-open");
  document.body.classList.remove("nav-open");
}

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    nav.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("nav-open", !isOpen);
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeNavigation();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNavigation();
  });
}

function updateHeader() {
  if (header) header.classList.toggle("has-shadow", window.scrollY > 8);
}

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

if (reducedMotion || !("IntersectionObserver" in window)) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  revealItems.forEach((item) => observer.observe(item));
}
