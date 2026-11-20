/* Adeniyi Stephen — portfolio interactions (no dependencies) */
(() => {
  "use strict";

  document.documentElement.classList.add("js");

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = () => motionQuery.matches;

  /* ---------- Split hero headline into animated words ---------- */
  function splitWords(root) {
    let index = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(" "));
              return;
            }
            const word = document.createElement("span");
            word.className = "word";
            const inner = document.createElement("span");
            inner.style.setProperty("--i", index++);
            inner.textContent = part;
            word.appendChild(inner);
            frag.appendChild(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };
    walk(root);
  }

  document.querySelectorAll("[data-split]").forEach((el) => {
    splitWords(el);
    // Trigger on next frame so the transition runs
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-visible")));
  });

  /* ---------- Mobile navigation ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  const toggleLabel = toggle && toggle.querySelector(".nav-toggle-label");
  const mobileNav = window.matchMedia("(max-width: 860px)");

  function setNav(open, { returnFocus = false } = {}) {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", String(open));
    if (toggleLabel) toggleLabel.textContent = open ? "Close" : "Menu";
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
    if (open) {
      const first = nav.querySelector("a");
      if (first) first.focus({ preventScroll: true });
    } else if (returnFocus) {
      toggle.focus({ preventScroll: true });
    }
  }

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      setNav(toggle.getAttribute("aria-expanded") !== "true");
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) setNav(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        setNav(false, { returnFocus: true });
      }
      // Keep keyboard focus inside the open mobile menu
      if (event.key === "Tab" && nav.classList.contains("is-open")) {
        const focusables = [toggle, ...nav.querySelectorAll("a")];
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    mobileNav.addEventListener("change", (e) => {
      if (!e.matches) setNav(false);
    });
  }

  /* ---------- Header state + scroll progress ---------- */
  const header = document.querySelector("[data-header]");
  const progress = document.querySelector("[data-progress]");
  const processWrap = document.querySelector("[data-process]");
  const processSteps = processWrap ? [...processWrap.querySelectorAll(".process-steps li")] : [];
  const parallaxEls = [...document.querySelectorAll("[data-parallax]")];
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;

    if (header) header.classList.toggle("is-scrolled", y > 12);
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;

    // Process timeline fills as the section moves through the viewport
    if (processWrap) {
      const rect = processWrap.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(Math.max((vh * 0.85 - rect.top) / (vh * 0.6), 0), 1);
      processWrap.style.setProperty("--p", p.toFixed(3));
      processSteps.forEach((step, i) => {
        step.classList.toggle("is-reached", p >= i / processSteps.length + 0.02);
      });
    }

    // Subtle parallax on project screenshots
    if (!reducedMotion()) {
      const vh = window.innerHeight;
      parallaxEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const offset = (r.top + r.height / 2 - vh / 2) / vh; // -1 … 1
        el.style.transform = `translate3d(0, ${(offset * -18).toFixed(1)}px, 0)`;
      });
    }

    ticking = false;
  }

  function requestScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  }

  window.addEventListener("scroll", requestScroll, { passive: true });
  window.addEventListener("resize", requestScroll, { passive: true });
  onScroll();

  /* ---------- Reveal on scroll ---------- */
  const revealItems = document.querySelectorAll(".reveal");
  if (reducedMotion() || !("IntersectionObserver" in window)) {
    revealItems.forEach((el) => el.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    revealItems.forEach((el) => revealObserver.observe(el));
  }

  /* ---------- Active navigation link ---------- */
  const navLinks = [...document.querySelectorAll("[data-nav-link]")];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    const visible = new Map();
    const activeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => visible.set(e.target.id, e.isIntersecting));
        const current = sections.find((s) => visible.get(s.id));
        navLinks.forEach((link) => {
          const isActive = current && link.getAttribute("href") === `#${current.id}`;
          link.classList.toggle("is-active", Boolean(isActive));
          if (isActive) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => activeObserver.observe(s));
  }

  /* ---------- Copy email ---------- */
  const copyBtn = document.querySelector("[data-copy]");
  if (copyBtn) {
    const label = copyBtn.querySelector("[data-copy-label]");
    const status = document.querySelector("[data-copy-status]");
    let resetTimer;

    copyBtn.addEventListener("click", async () => {
      const text = copyBtn.getAttribute("data-copy");
      let ok = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          ok = true;
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand("copy");
          ta.remove();
        }
      } catch (err) {
        ok = false;
      }
      const message = ok ? "Copied" : "Press Ctrl+C to copy";
      if (label) label.textContent = message;
      if (status) status.textContent = ok ? "Email address copied to clipboard" : "Copy failed";
      copyBtn.classList.toggle("is-copied", ok);
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        if (label) label.textContent = "Copy email";
        copyBtn.classList.remove("is-copied");
      }, 2400);
    });
  }

  /* ---------- Footer year ---------- */
  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
})();
