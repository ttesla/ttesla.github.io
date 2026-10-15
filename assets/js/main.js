const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Small helpers ----------

// Per visit: cleared when the tab closes
const storage = {
  get(key, fallback) {
    try {
      const value = sessionStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Private mode or blocked storage
    }
  },
};

let toastTimer = 0;

function toast(message) {
  const el = document.querySelector(".toast");
  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------- Mobile nav ----------

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

// ---------- Coins & cheats ----------

let audioCtx = null;

function playCoinSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;

    // Two-note square blip
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(988, now);
    osc.frequency.setValueAtTime(1319, now + 0.08);

    // Envelope
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch {
    // No audio, no problem
  }
}

function playFanfare() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;

    // Rising arpeggio
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      const start = now + i * 0.09;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.07, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (i === notes.length - 1 ? 0.6 : 0.12));

      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  } catch {
    // No audio, no problem
  }
}

function initCoins() {
  const button = document.querySelector(".coin");
  const countEl = document.querySelector(".coin-count");
  if (!button || !countEl) return;

  let credits = parseInt(storage.get("insertcoin.credits", "0"), 10) || 0;

  const render = () => {
    countEl.textContent = String(credits).padStart(2, "0");
  };

  const setCredits = (value) => {
    credits = Math.min(99, value);
    storage.set("insertcoin.credits", String(credits));
    render();
  };

  render();

  // Popup every 100 clicks per visit
  const popup = document.getElementById("credits-popup");
  let clicks = parseInt(storage.get("insertcoin.clicks", "0"), 10) || 0;

  popup?.addEventListener("click", (e) => {
    if (e.target === popup) popup.close();
  });

  // Insert coin
  button.addEventListener("click", () => {
    clicks++;
    storage.set("insertcoin.clicks", String(clicks));

    if (clicks >= 100 && popup) {
      clicks = 0;
      storage.set("insertcoin.clicks", "0");
      setCredits(0);
      playFanfare();
      popup.showModal();
      return;
    }

    setCredits(credits + 1);
    playCoinSound();

    button.classList.remove("bump");
    void button.offsetWidth;
    button.classList.add("bump");

    toast(credits === 1 ? "Player 1 ready!" : credits >= 99 ? "Credits maxed out" : `Credit ${String(credits).padStart(2, "0")}`);
  });

  // Konami code
  const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let step = 0;

  window.addEventListener("keydown", (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    step = key === code[step] ? step + 1 : key === code[0] ? 1 : 0;
    if (step < code.length) return;

    step = 0;
    setCredits(99);
    playCoinSound();
    document.documentElement.classList.toggle("cheat");
    toast("Cheat enabled: 99 credits");
  });
}

// ---------- Games filter ----------

function initFilters() {
  const buttons = document.querySelectorAll(".filter");
  const carts = document.querySelectorAll(".cart");
  if (!buttons.length) return;

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;

      buttons.forEach((b) => {
        const active = b === button;
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", String(active));
      });

      carts.forEach((cart) => {
        cart.hidden = filter !== "all" && cart.dataset.kind !== filter;
      });
    });
  });
}

// ---------- 404 countdown ----------

function initCountdown() {
  const el = document.querySelector(".countdown");
  if (!el) return;

  let n = 9;
  const timer = setInterval(() => {
    n -= 1;
    el.textContent = String(n);
    if (n > 0) return;

    clearInterval(timer);
    window.location.href = el.dataset.href;
  }, 1000);
}

// ---------- Canvas plumbing ----------

function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function runWhileVisible(canvas, frame) {
  let visible = true;
  let rafId = 0;
  const start = performance.now();

  const tick = (now) => {
    frame((now - start) / 1000);
    rafId = visible ? requestAnimationFrame(tick) : 0;
  };

  // Static frame for reduced motion
  if (reducedMotion) {
    frame(0);
    return;
  }

  // Pause when off screen
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !rafId) rafId = requestAnimationFrame(tick);
  }).observe(canvas);
}

// ---------- Synthwave hero ----------

function initSynthwave() {
  const canvas = document.querySelector(".hero-canvas");
  if (!canvas) return;

  let view = fitCanvas(canvas);

  // Stars
  const stars = Array.from({ length: 140 }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: Math.random() < 0.15 ? 2 : 1,
    phase: Math.random() * Math.PI * 2,
  }));

  // Mountain silhouette
  const peaks = Array.from({ length: 28 }, (_, i) => ({
    x: i / 27,
    h: 0.25 + Math.random() * 0.75 * (0.5 + 0.5 * Math.sin(i * 0.9)),
  }));

  window.addEventListener("resize", () => {
    view = fitCanvas(canvas);
    if (reducedMotion) draw(0);
  });

  function draw(t) {
    const { ctx, w, h } = view;
    const horizon = Math.round(h * 0.66);
    ctx.clearRect(0, 0, w, h);

    // Stars
    for (const s of stars) {
      const alpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.5 + s.phase));
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(Math.round(s.x * w), Math.round(s.y * horizon * 0.9), s.size, s.size);
    }

    // Sun position
    const r = Math.min(w * 0.2, h * 0.3);
    const cx = w < 760 ? w * 0.5 : w * 0.76;
    const cy = horizon - r * 0.45;

    // Sun glow
    const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.8);
    glow.addColorStop(0, "rgba(255, 61, 139, 0.35)");
    glow.addColorStop(1, "rgba(255, 61, 139, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);

    // Sun stripes zone: visual middle down to the horizon
    const stripeTop = cy - r * 0.3;
    const stripeH = horizon - stripeTop;
    const bands = 6;
    const scroll = (t * 0.25) % 1;
    const bandY = (u) => stripeTop + u * (0.5 + 0.5 * Math.max(u, 0)) * stripeH;

    // Min gap: wider than the 3px CSS scanlines
    const minGap = 5;

    // Sun stripes clip: solid cap down to the newest band
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - r, cy - r, r * 2, bandY((scroll - 1) / bands) - (cy - r));
    let newGapTop = 0;
    let newGap = 0;
    for (let i = -1; i < bands; i++) {
      const u = (i + 1 + scroll) / bands;
      const top = bandY((i + scroll) / bands);
      const bottom = bandY(u);
      const maxGap = (bottom - top) * 0.6;
      const gap = Math.min(minGap + (maxGap - minGap) * Math.max(u, 0), maxGap);
      ctx.rect(cx - r, top, r * 2, bottom - top - gap);
      if (i === -1) {
        newGapTop = bottom - gap;
        newGap = gap;
      }
    }
    ctx.clip();

    // Sun body
    const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    sun.addColorStop(0, "#ffd23f");
    sun.addColorStop(0.55, "#ff7a5c");
    sun.addColorStop(1, "#ff3d8b");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Newest gap fades open instead of growing from a hairline
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - r, newGapTop, r * 2, newGap);
    ctx.clip();
    ctx.globalAlpha = 1 - scroll;
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Mountains
    ctx.fillStyle = "#1c0a3a";
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (const p of peaks) ctx.lineTo(p.x * w, horizon - p.h * h * 0.12);
    ctx.lineTo(w, horizon);
    ctx.closePath();
    ctx.fill();

    // Ground
    const ground = ctx.createLinearGradient(0, horizon, 0, h);
    ground.addColorStop(0, "#1a0633");
    ground.addColorStop(1, "#07031a");
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, w, h - horizon);

    // Grid style
    ctx.strokeStyle = "rgba(255, 61, 139, 0.75)";
    ctx.lineWidth = 1;
    ctx.shadowColor = "#ff3d8b";
    ctx.shadowBlur = 6;
    ctx.beginPath();

    // Horizontal grid lines
    const rows = 14;
    const phase = (t * 0.6) % 1;
    for (let i = 0; i < rows; i++) {
      const k = (i + phase) / rows;
      const y = horizon + (h - horizon) * k * k;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }

    // Vertical grid lines
    const cols = 22;
    for (let i = -cols; i <= cols; i++) {
      const xBottom = w / 2 + (i / cols) * w * 2.2;
      ctx.moveTo(w / 2 + (i / cols) * w * 0.12, horizon);
      ctx.lineTo(xBottom, h);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Horizon line
    ctx.fillStyle = "#3ef0ff";
    ctx.fillRect(0, horizon, w, 1);
  }

  runWhileVisible(canvas, draw);
}

// ---------- Sine scroller ----------

async function initScroller() {
  const canvas = document.querySelector(".scroller");
  if (!canvas) return;

  // Wait for the pixel font
  const fontSize = 20;
  const font = `${fontSize}px "Press Start 2P"`;
  try {
    await document.fonts.load(font);
  } catch {
    // Fallback font is fine
  }

  const text = canvas.dataset.text || "";
  let view = fitCanvas(canvas);
  window.addEventListener("resize", () => {
    view = fitCanvas(canvas);
  });

  // Speed & spacing
  const charW = fontSize + 6;
  const speed = 200;
  const textW = text.length * charW;

  // Wave & depth
  const waveAmpX = 50;
  const waveAmpY = 25;
  const depthAmp = 0.6;

  const glyphs = [];

  runWhileVisible(canvas, (t) => {
    const { ctx, w, h } = view;
    ctx.clearRect(0, 0, w, h);
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Scroll offset
    const offset = w - ((t * speed) % (textW + w));
    const first = Math.max(0, Math.floor((-offset - charW) / charW));
    const last = Math.min(text.length, Math.ceil((w - offset + charW) / charW));

    // Place glyphs
    glyphs.length = 0;
    for (let i = first; i < last; i++) {
      if (text[i] === " ") continue;

      const x = offset + i * charW;
      const z = 0.5 + Math.sin(x * 0.005 - t * 1.9);

      // Main wave: letters orbit in ellipses, like water
      // Special sin function by Ömer hehehe
      const waveX = Math.cos(t*5 + i*0.25) * waveAmpX;
      const waveY = Math.sin(t*1.9 + i*0.25) * waveAmpY;

      glyphs.push({
        ch: text[i],
        x: x + waveX,
        y: h / 2 + waveY,
        z,
        scale: 1 + z * depthAmp,
      });
    }

    // Far letters first, near ones on top
    glyphs.sort((a, b) => a.z - b.z);

    // Draw
    for (const g of glyphs) {
      const hue = (g.x * 0.35 + t * 140) % 360;
      const light = 52 + g.z * 18;

      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.scale(g.scale, g.scale);

      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillText(g.ch, 2, 2);
      ctx.fillStyle = `hsl(${hue}, 100%, ${light}%)`;
      ctx.fillText(g.ch, 0, 0);

      ctx.restore();
    }
  });
}

// ---------- Boot ----------

initNav();
initCoins();
initFilters();
initCountdown();
initSynthwave();
initScroller();
