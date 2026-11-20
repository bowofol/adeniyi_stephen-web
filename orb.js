/*
 * Hero orb — a single-pass WebGL fragment shader (no libraries).
 *
 * The sphere is ray-traced analytically: Fresnel reflections of a procedural
 * "studio" environment, refraction with slight chromatic dispersion, and a
 * slowly drifting champagne-gold volume inside the glass. Pointer movement
 * orbits the camera so the reflections shift with the cursor.
 *
 * If WebGL is unavailable the CSS fallback orb (.orb-fallback) stays visible.
 */
(() => {
  "use strict";

  const canvas = document.querySelector("[data-orb-canvas]");
  if (!canvas) return;
  const orb = canvas.closest("[data-orb]");
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let gl;
  try {
    gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
  } catch (e) {
    gl = null;
  }
  if (!gl) return;

  const VERT = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;

    uniform vec2  uRes;
    uniform float uTime;
    uniform vec2  uPointer;

    const vec3 GOLD  = vec3(0.839, 0.710, 0.427);
    const vec3 IVORY = vec3(0.941, 0.941, 0.910);

    mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
    mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
            mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
        mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
            mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
        f.z);
    }

    float fbm(vec3 p) {
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 3; i++) {
        s += a * noise(p);
        p = p * 2.03 + vec3(1.7, 9.2, 3.1);
        a *= 0.5;
      }
      return s;
    }

    // Procedural studio: graphite surroundings, an ivory key softbox,
    // a champagne strip light and a warm floor bounce.
    vec3 env(vec3 d) {
      vec3 col = mix(vec3(0.035), vec3(0.10, 0.095, 0.09), smoothstep(-0.9, 0.9, d.y));
      vec3 key = normalize(vec3(-0.55, 0.62, 0.55));
      float k = dot(d, key);
      col += IVORY * (1.7 * smoothstep(0.88, 0.975, k) + 0.12 * smoothstep(0.4, 1.0, k));
      float strip = smoothstep(0.16, 0.02, abs(d.x - 0.78)) * smoothstep(-0.7, 0.1, d.y) * smoothstep(-0.5, 0.2, d.z);
      col += GOLD * 1.25 * strip;
      vec3 rim = normalize(vec3(0.2, -0.15, -1.0));
      col += GOLD * 0.9 * smoothstep(0.8, 0.98, dot(d, rim));
      col += GOLD * 0.22 * smoothstep(-0.15, -0.95, d.y);
      col += GOLD * 0.3 * smoothstep(0.025, 0.0, abs(d.y + 0.06));
      return col;
    }

    // Gold nebula suspended inside the glass
    vec3 interior(vec3 p0, vec3 rd, float len, float t) {
      vec3 acc = vec3(0.0);
      const int STEPS = 8;
      float dt = len / float(STEPS);
      mat3 spin = rotY(t * 0.11) * rotX(0.35);
      for (int i = 0; i < STEPS; i++) {
        vec3 p = spin * (p0 + rd * (float(i) + 0.5) * dt);
        float r = length(p);
        vec3 q = p * 1.55 + vec3(0.0, t * 0.09, t * 0.04);
        float warp = noise(q * 1.4 - vec3(t * 0.06));
        float n = fbm(q + warp * 1.3);
        float shell = 1.0 - smoothstep(0.5, 0.98, r);
        float dens = smoothstep(0.5, 0.78, n) * shell;
        float fil = smoothstep(0.03, 0.0, abs(n - 0.56)) * (1.0 - r * 0.6);
        float core = exp(-r * r * 6.0);
        acc += (GOLD * (dens * 0.75 + fil * 1.6) + mix(GOLD, IVORY, 0.55) * core * 0.45) * dt;
      }
      return acc;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);

      float t = uTime;
      vec2 drift = vec2(sin(t * 0.21) * 0.08, cos(t * 0.17) * 0.05);
      mat3 cam = rotY(uPointer.x * 0.45 + drift.x) * rotX(-uPointer.y * 0.3 + drift.y);

      vec3 ro = cam * vec3(0.0, 0.0, 3.4);
      vec3 rd = cam * normalize(vec3(uv, -2.4));

      float b = dot(ro, rd);
      float dist2 = dot(ro, ro) - b * b;
      float h = 1.0 - dist2;

      // Edge antialiasing width in h-units (≈ one pixel)
      float px = 2.0 / min(uRes.x, uRes.y) * 3.0;
      float sphereA = smoothstep(0.0, px, h);

      // Soft champagne halo around the glass
      float d = sqrt(max(dist2, 0.0));
      float edgeFade = 1.0 - smoothstep(0.78, 0.98, length(uv));
      float halo = exp(-max(d - 1.0, 0.0) * 8.0) * 0.38 * edgeFade;
      vec3 haloCol = GOLD * halo;

      vec3 col = vec3(0.0);
      if (h > 0.0) {
        float t0 = -b - sqrt(h);
        vec3 p = ro + rd * t0;
        vec3 n = normalize(p);
        float cosi = max(dot(n, -rd), 0.0);
        float fres = 0.04 + 0.96 * pow(1.0 - cosi, 4.0);

        vec3 refl = env(reflect(rd, n));

        vec3 rdIn = refract(rd, n, 1.0 / 1.46);
        float len = max(-2.0 * dot(p, rdIn), 0.0);
        vec3 pe = p + rdIn * len;
        vec3 ne = -normalize(pe);

        vec3 oR = refract(rdIn, ne, 1.43);
        vec3 oG = refract(rdIn, ne, 1.46);
        vec3 oB = refract(rdIn, ne, 1.50);
        if (dot(oG, oG) < 0.001) {
          oG = reflect(rdIn, ne);
          oR = oG;
          oB = oG;
        }
        vec3 trans = vec3(env(oR).r, env(oG).g, env(oB).b);
        trans *= mix(vec3(1.0), GOLD * 1.15, 0.35) * 0.9;

        vec3 inner = interior(p, rdIn, len, t);

        col = trans + inner;
        col = mix(col, refl, fres);

        // Sharp specular glints
        vec3 r = reflect(rd, n);
        col += IVORY * pow(max(dot(r, normalize(vec3(-0.55, 0.62, 0.55))), 0.0), 220.0) * 2.4;
        col += GOLD * pow(max(dot(r, normalize(vec3(0.7, 0.25, 0.6))), 0.0), 90.0) * 0.9;

        // Gold rim light and a caustic glow pooling at the base
        col += GOLD * pow(1.0 - cosi, 6.0) * 0.55;
        float caustic = smoothstep(0.45, 1.0, dot(n, normalize(vec3(0.25, -0.85, 0.45))));
        col += GOLD * caustic * 0.28 * (1.0 - fres);
      }

      col = 1.0 - exp(-col * 1.35);                    // gentle tone map
      col += (hash(vec3(gl_FragCoord.xy, floor(t * 24.0))) - 0.5) * 0.018; // fine grain

      vec3 outCol = col * sphereA + haloCol * (1.0 - sphereA);
      float outA = sphereA + halo * 0.85 * (1.0 - sphereA);
      gl_FragColor = vec4(outCol, outA);
    }
  `;

  function compile(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  let program, uRes, uTime, uPointer;

  function init() {
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    uRes = gl.getUniformLocation(program, "uRes");
    uTime = gl.getUniformLocation(program, "uTime");
    uPointer = gl.getUniformLocation(program, "uPointer");
    gl.clearColor(0, 0, 0, 0);
    return true;
  }

  if (!init()) return;

  /* ---------- Sizing (with adaptive resolution) ---------- */
  let quality = 1;
  const maxDpr = () => Math.min(window.devicePixelRatio || 1, 1.6) * quality;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = maxDpr();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  /* ---------- Pointer ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      const r = canvas.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const span = Math.max(window.innerWidth, window.innerHeight) * 0.5;
      pointer.tx = Math.max(-1, Math.min(1, (e.clientX - cx) / span));
      pointer.ty = Math.max(-1, Math.min(1, (e.clientY - cy) / span));
    },
    { passive: true }
  );
  document.documentElement.addEventListener("pointerleave", () => {
    pointer.tx = 0;
    pointer.ty = 0;
  });

  /* ---------- Render loop ---------- */
  let raf = 0;
  let running = false;
  let inView = true;
  const start = performance.now();
  let frames = 0;
  let sampleStart = 0;
  let shown = false;

  function draw(timeSec) {
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, timeSec);
    gl.uniform2f(uPointer, pointer.x, -pointer.y);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!shown) {
      shown = true;
      orb.classList.add("is-webgl");
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    orb.style.setProperty("--px", pointer.x.toFixed(3));
    orb.style.setProperty("--py", pointer.y.toFixed(3));

    draw((now - start) / 1000);

    // Adaptive quality: if frames are slow, render at a lower resolution
    if (!sampleStart) sampleStart = now;
    frames++;
    if (frames === 90) {
      const avg = (now - sampleStart) / frames;
      if (avg > 24 && quality > 0.55) quality *= 0.8;
      frames = 0;
      sampleStart = now;
    }
  }

  function play() {
    if (running || motionQuery.matches || !inView || document.hidden) return;
    running = true;
    sampleStart = 0;
    frames = 0;
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function renderStill() {
    pointer.x = pointer.y = 0;
    orb.style.setProperty("--px", "0");
    orb.style.setProperty("--py", "0");
    draw(14.0);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      if (inView) play();
      else pause();
    }).observe(canvas);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
    else play();
  });

  motionQuery.addEventListener("change", () => {
    if (motionQuery.matches) {
      pause();
      renderStill();
    } else {
      play();
    }
  });

  window.addEventListener(
    "resize",
    () => {
      if (!running) renderStill();
    },
    { passive: true }
  );

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    pause();
    orb.classList.remove("is-webgl");
  });
  canvas.addEventListener("webglcontextrestored", () => {
    shown = false;
    if (init()) {
      if (motionQuery.matches) renderStill();
      else play();
    }
  });

  if (motionQuery.matches) renderStill();
  else play();
})();
