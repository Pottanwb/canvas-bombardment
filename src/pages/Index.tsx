import { useEffect, useRef } from "react";

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // SEO basics
    const prevTitle = document.title;
    document.title = "Canvas Bombardment – Interactive Canvas Game";

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
      return el;
    };

    const metaDesc = setMeta(
      "description",
      "Interactive canvas game: click to explode, guide a missile, avoid the boy, tag the bomber, and rack up points with smooth animations."
    );

    // Canonical
    const canonicalLink = document.createElement("link");
    canonicalLink.setAttribute("rel", "canonical");
    canonicalLink.setAttribute("href", window.location.href);
    document.head.appendChild(canonicalLink);

    // JSON-LD structured data (VideoGame)
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "VideoGame",
      name: "Canvas Bombardment",
      description:
        "A simple interactive canvas game with missiles, explosions, a running boy, and a stealth bomber. Earn points by tagging the bomber.",
      applicationCategory: "Game",
      gamePlatform: "Web"
    });
    document.head.appendChild(ld);

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let width = 0;
    let height = 0;
    let dpr = Math.max(1, window.devicePixelRatio || 1);

    const resize = () => {
      dpr = Math.max(1, window.devicePixelRatio || 1);
      width = Math.floor(window.innerWidth);
      height = Math.floor(window.innerHeight);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    // Game state
    type Vec = { x: number; y: number };

    const mouse: Vec = { x: width / 2, y: height / 2 };
    let lastMouse: Vec = { x: mouse.x, y: mouse.y };
    let firstClickHandled = false;
    let stopTimer: number | null = null;

    const missile = {
      pos: { x: width / 2, y: height / 2 },
      vel: { x: 0, y: 0 },
      speed: 0.15, // smoothing factor
    };

    type Explosion = {
      x: number;
      y: number;
      r: number; // current radius
      maxR: number;
      alive: boolean;
      createdAt: number;
      hitBomber?: boolean;
      hitBoy?: boolean;
    };
    const explosions: Explosion[] = [];

    // Entities
    const groundY = () => Math.min(height - 40, height * 0.9);

    type Actor = {
      x: number;
      y: number;
      w: number;
      h: number;
      alive: boolean;
      animTime: number;
    };

    const boy: Actor = { x: -80, y: groundY() - 40, w: 28, h: 40, alive: false, animTime: 0 };
    const bomber: Actor = { x: -200, y: groundY() - 200, w: 100, h: 30, alive: false, animTime: 0 };

    let score = 0;
    let startTime = performance.now();
    let lastTime = startTime;

    // Glitch effect
    let glitchActive = false;
    let glitchStart = 0;
    const glitchDuration = 800; // ms
    let reloadQueued = false;

    const spawnExplosion = (x: number, y: number) => {
      explosions.push({ x, y, r: 0, maxR: 70, alive: true, createdAt: performance.now() });
    };

    const onFirstClick = (x: number, y: number) => {
      if (!firstClickHandled) {
        firstClickHandled = true;
        spawnExplosion(x, y);
      }
    };

    const onMouseMove = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left);
      const y = (clientY - rect.top);
      mouse.x = x;
      mouse.y = y;

      if (stopTimer) window.clearTimeout(stopTimer);
      if (firstClickHandled) {
        stopTimer = window.setTimeout(() => {
          spawnExplosion(mouse.x, mouse.y);
        }, 240);
      }
    };

    const onClick = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left);
      const y = (clientY - rect.top);
      onFirstClick(x, y);
    };

    const handlePointerMove = (e: PointerEvent) => onMouseMove(e.clientX, e.clientY);
    const handleMouseMove = (e: MouseEvent) => onMouseMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) onMouseMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleClick = (e: MouseEvent) => onClick(e.clientX, e.clientY);
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) onClick(e.touches[0].clientX, e.touches[0].clientY);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("click", handleClick, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });

    const len = (v: Vec) => Math.hypot(v.x, v.y);
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

    const drawBackground = () => {
      // Subtle gradient background
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, "#0b1020");
      g.addColorStop(1, "#111827");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      // Ground
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, groundY(), width, height - groundY());
    };

    const drawScore = () => {
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Score: ${score}`, 12, 10);
      ctx.restore();
    };

    const drawMissile = () => {
      if (!firstClickHandled) return;
      const dir = { x: mouse.x - missile.pos.x, y: mouse.y - missile.pos.y };
      const L = Math.max(0.0001, len(dir));
      const angle = Math.atan2(dir.y, dir.x);

      // body
      ctx.save();
      ctx.translate(missile.pos.x, missile.pos.y);
      ctx.rotate(angle);
      ctx.fillStyle = "#cbd5e1";
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, -6);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-12, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // flame
      const flame = 6 + 4 * Math.sin(performance.now() / 60);
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-12 - flame, -3);
      ctx.lineTo(-12 - flame, 3);
      ctx.closePath();
      ctx.fillStyle = "#f97316";
      ctx.fill();
      ctx.restore();
    };

    const drawExplosion = (ex: Explosion) => {
      const t = clamp((performance.now() - ex.createdAt) / 450, 0, 1);
      ex.r = ex.maxR * t;
      if (t >= 1) ex.alive = false;

      const alpha = 1 - t;
      // outer glow
      const g = ctx.createRadialGradient(ex.x, ex.y, ex.r * 0.1, ex.x, ex.y, ex.r);
      g.addColorStop(0, `rgba(255,200,80,${0.6 * alpha})`);
      g.addColorStop(1, `rgba(255,60,0,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
      ctx.fill();

      // shockwave ring
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.r * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    };

    const drawBoy = (a: Actor, dt: number) => {
      if (!a.alive) return;
      a.animTime += dt;
      // simple running: legs alternate every 120ms
      const phase = Math.floor((a.animTime / 120) % 2);

      ctx.save();
      ctx.translate(a.x, a.y);
      // body
      ctx.fillStyle = "#22d3ee";
      ctx.fillRect(-a.w / 2, -a.h, a.w, a.h);
      // head
      ctx.beginPath();
      ctx.arc(0, -a.h - 8, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#fde68a";
      ctx.fill();
      // legs
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (phase === 0) {
        ctx.moveTo(-6, 0);
        ctx.lineTo(-12, 12);
        ctx.moveTo(6, 0);
        ctx.lineTo(14, 10);
      } else {
        ctx.moveTo(-6, 0);
        ctx.lineTo(-14, 10);
        ctx.moveTo(6, 0);
        ctx.lineTo(12, 12);
      }
      ctx.stroke();
      ctx.restore();
    };

    const drawBomber = (a: Actor, dt: number) => {
      if (!a.alive) return;
      a.animTime += dt;
      // slight bobbing
      const bob = Math.sin(a.animTime / 300) * 2;

      ctx.save();
      ctx.translate(a.x, a.y + bob);
      ctx.fillStyle = "#64748b";
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // stealth-like silhouette
      ctx.moveTo(-a.w / 2, 0);
      ctx.quadraticCurveTo(0, -a.h, a.w / 2, 0);
      ctx.quadraticCurveTo(0, a.h * 0.2, -a.w / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    const circleHit = (ex: Explosion, cx: number, cy: number, radius: number) => {
      const dx = ex.x - cx;
      const dy = ex.y - cy;
      const dist = Math.hypot(dx, dy);
      return dist <= ex.r + radius;
    };

    const update = (dt: number) => {
      // missile follow
      if (firstClickHandled) {
        missile.pos.x += (mouse.x - missile.pos.x) * missile.speed;
        missile.pos.y += (mouse.y - missile.pos.y) * missile.speed;
        missile.vel.x = missile.pos.x - lastMouse.x;
        missile.vel.y = missile.pos.y - lastMouse.y;
        lastMouse.x = missile.pos.x;
        lastMouse.y = missile.pos.y;
      }

      // spawn boy & bomber after 30s
      const t = performance.now() - startTime;
      if (t > 30000) {
        if (!boy.alive) {
          boy.alive = true;
          boy.x = -80;
          boy.y = groundY() - 8; // feet on ground
        }
        if (!bomber.alive) {
          bomber.alive = true;
          bomber.x = -200;
          bomber.y = groundY() - 200;
        }
      }

      // move boy
      if (boy.alive) {
        boy.x += 0.12 * dt; // px/ms -> ~7.2 px/s hundred? actually 0.12 px per ms ~ 120 px/s
        if (boy.x - boy.w / 2 > width + 40) {
          // reset loop
          boy.x = -80;
        }
      }

      // bomber follows slightly behind/above boy
      if (bomber.alive && boy.alive) {
        const targetX = boy.x - 160;
        const targetY = boy.y - 180;
        bomber.x += (targetX - bomber.x) * 0.03;
        bomber.y += (targetY - bomber.y) * 0.03;
      } else if (bomber.alive) {
        // idle flight to the right
        bomber.x += 0.08 * dt;
        if (bomber.x - bomber.w / 2 > width + 60) bomber.x = -120;
      }

      // explosions update & collisions
      for (const ex of explosions) {
        if (!ex.alive) continue;
        // Check bomber hit (count once per explosion)
        if (bomber.alive && !ex.hitBomber && circleHit(ex, bomber.x, bomber.y, 40)) {
          ex.hitBomber = true;
          score += 1;
        }
        // Check boy hit -> crash
        if (boy.alive && !ex.hitBoy && circleHit(ex, boy.x, boy.y - boy.h / 2, 28)) {
          ex.hitBoy = true;
          boy.alive = false;
          // trigger glitch + reload
          glitchActive = true;
          glitchStart = performance.now();
          if (!reloadQueued) {
            reloadQueued = true;
            setTimeout(() => {
              window.location.reload();
            }, glitchDuration + 150);
          }
        }
      }
    };

    const drawGlitch = () => {
      const elapsed = performance.now() - glitchStart;
      const p = clamp(elapsed / glitchDuration, 0, 1);
      const slices = 20;
      for (let i = 0; i < slices; i++) {
        const y = Math.random() * height;
        const h = 4 + Math.random() * 14;
        const xOff = (Math.random() - 0.5) * 30 * (1 + p);
        ctx.fillStyle = `rgba(${100 + Math.random() * 155},${100 + Math.random() * 155},${255},${0.12 + Math.random() * 0.18})`;
        ctx.fillRect(0 + xOff, y, width, h);
      }

      // crack lines
      ctx.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.25})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        for (let j = 0; j < 5; j++) {
          ctx.lineTo(Math.random() * width, Math.random() * height);
        }
        ctx.stroke();
      }
    };

    const loop = (time: number) => {
      if (!running) return;
      const dt = time - lastTime;
      lastTime = time;

      drawBackground();
      update(dt);

      // draw
      drawMissile();
      for (const ex of explosions) if (ex.alive) drawExplosion(ex);
      drawBoy(boy, dt);
      drawBomber(bomber, dt);
      drawScore();

      if (glitchActive) {
        drawGlitch();
        if (performance.now() - glitchStart > glitchDuration) glitchActive = false; // allow reload timer to handle reset
      }

      // cleanup explosions
      for (let i = explosions.length - 1; i >= 0; i--) if (!explosions[i].alive) explosions.splice(i, 1);

      // CTA before first click
      if (!firstClickHandled) {
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "600 22px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Click anywhere to trigger an explosion", width / 2, height / 2);
        ctx.restore();
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame((t) => {
      lastTime = t;
      loop(t);
    });

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      if (stopTimer) clearTimeout(stopTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchstart", handleTouchStart);

      // cleanup SEO nodes
      document.title = prevTitle;
      metaDesc && metaDesc.parentElement?.removeChild(metaDesc);
      canonicalLink && canonicalLink.parentElement?.removeChild(canonicalLink);
      ld && ld.parentElement?.removeChild(ld);
    };
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="sr-only">
        <h1>Canvas Bombardment – Interactive Canvas Game</h1>
      </header>
      <canvas ref={canvasRef} className="block w-full h-[100svh]" />
    </main>
  );
};

export default Index;
