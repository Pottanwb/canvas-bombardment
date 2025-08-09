import { useEffect, useRef } from "react";

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
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

    const canonicalLink = document.createElement("link");
    canonicalLink.setAttribute("rel", "canonical");
    canonicalLink.setAttribute("href", window.location.href);
    document.head.appendChild(canonicalLink);

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

    type Vec = { x: number; y: number };

    const mouse: Vec = { x: width / 2, y: height / 2 };
    let lastMouse: Vec = { x: mouse.x, y: mouse.y };
    let firstClickHandled = false;
    let stopTimer: number | null = null;

    const missile = {
      pos: { x: width / 2, y: height / 2 },
      vel: { x: 0, y: 0 },
      speed: 0.15,
    };

    type Explosion = {
      x: number;
      y: number;
      r: number; // collision/shockwave radius
      maxR: number;
      alive: boolean;
      createdAt: number;
      kind: 'nuclear';
      lifeMs: number;
    };
    const explosions: Explosion[] = [];

    type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number };
    const particles: Particle[] = [];

    const groundY = () => Math.min(height - 40, height * 0.9);

    type Actor = {
      x: number;
      y: number;
      w: number;
      h: number;
      alive: boolean;
      animTime: number;
    };

    const boy: Actor = { x: -80, y: groundY() - 40, w: 28, h: 46, alive: false, animTime: 0 };
    const bomber: Actor = { x: -200, y: groundY() - 200, w: 110, h: 34, alive: false, animTime: 0 };

    let score = 0;
    let startTime = performance.now();
    let lastTime = startTime;

    // Glitch effect
    let glitchActive = false;
    let glitchStart = 0;
    const glitchDuration = 800; // ms
    let reloadQueued = false;

    const spawnExplosion = (x: number, y: number) => {
      explosions.push({ x, y, r: 0, maxR: 140, alive: true, createdAt: performance.now(), kind: 'nuclear', lifeMs: 1200 });
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
      if (!firstClickHandled) {
        firstClickHandled = true; // first click arms the missile-follow loop
      }
      // Always spawn explosion on click (also covers the first click)
      spawnExplosion(x, y);
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
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, "#050914");
      g.addColorStop(1, "#0b1325");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

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
      const angle = Math.atan2(dir.y, dir.x);

      // Smoke/fire particles from exhaust
      for (let i = 0; i < 2; i++) {
        particles.push({
          x: missile.pos.x - Math.cos(angle) * 16,
          y: missile.pos.y - Math.sin(angle) * 16,
          vx: (Math.random() - 0.5) * 0.4 - Math.cos(angle) * 0.3,
          vy: (Math.random() - 0.5) * 0.4 - Math.sin(angle) * 0.3,
          life: 0,
          maxLife: 600 + Math.random() * 400,
          size: 2 + Math.random() * 2,
        });
      }

      ctx.save();
      ctx.translate(missile.pos.x, missile.pos.y);
      ctx.rotate(angle);

      // Body gradient
      const grad = ctx.createLinearGradient(-16, 0, 18, 0);
      grad.addColorStop(0, "#9aa4b2");
      grad.addColorStop(0.5, "#c9d2de");
      grad.addColorStop(1, "#8f9aaa");
      ctx.fillStyle = grad;

      // Main fuselage
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(10, -5);
      ctx.lineTo(-12, -5);
      ctx.lineTo(-12, 5);
      ctx.lineTo(10, 5);
      ctx.closePath();
      ctx.fill();

      // Nose cone
      ctx.fillStyle = "#b8c2d0";
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.quadraticCurveTo(20, 0, 12, 6);
      ctx.lineTo(12, -6);
      ctx.closePath();
      ctx.fill();

      // Fins
      ctx.fillStyle = "#7b8595";
      ctx.beginPath();
      ctx.moveTo(-10, -5);
      ctx.lineTo(-16, -10);
      ctx.lineTo(-6, -5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-10, 5);
      ctx.lineTo(-16, 10);
      ctx.lineTo(-6, 5);
      ctx.closePath();
      ctx.fill();

      // Exhaust flame
      const flame = 6 + 4 * Math.sin(performance.now() / 50);
      const flameGrad = ctx.createLinearGradient(-12 - flame, 0, -12, 0);
      flameGrad.addColorStop(0, "rgba(255,120,0,0.0)");
      flameGrad.addColorStop(0.5, "rgba(255,160,0,0.7)");
      flameGrad.addColorStop(1, "rgba(255,230,120,0.9)");
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-12 - flame, -3);
      ctx.lineTo(-12 - flame, 3);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    const drawParticles = (dt: number) => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // slight upward drift
        p.vy -= 0.0003 * dt;
        const a = clamp(1 - p.life / p.maxLife, 0, 1);
        ctx.fillStyle = `rgba(200,200,210,${0.25 * a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * 0.5), 0, Math.PI * 2);
        ctx.fill();
        if (p.life >= p.maxLife) particles.splice(i, 1);
      }
    };

    const drawNuclearExplosion = (ex: Explosion) => {
      const elapsed = performance.now() - ex.createdAt;
      const t = clamp(elapsed / ex.lifeMs, 0, 1);
      // flash
      const flash = Math.max(0, 1 - elapsed / 120);
      if (flash > 0) {
        const rg = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, 200 + 200 * flash);
        rg.addColorStop(0, `rgba(255,255,255,${0.9 * flash})`);
        rg.addColorStop(1, `rgba(255,255,255,0)`);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, 220 + 220 * flash, 0, Math.PI * 2);
        ctx.fill();
      }

      // shockwave radius for collisions
      ex.r = ex.maxR * (0.2 + 0.8 * t);

      // rising mushroom parameters
      const rise = 40 + 100 * t; // top rises over life
      const capR = 20 + ex.maxR * 0.6 * Math.pow(t, 0.6);
      const stemW = 20 + 40 * Math.pow(t, 0.5);
      const stemH = 20 + rise;

      // stem
      const stemGrad = ctx.createLinearGradient(ex.x, ex.y, ex.x, ex.y - stemH);
      stemGrad.addColorStop(0, "rgba(200,90,20,0.35)");
      stemGrad.addColorStop(1, "rgba(240,180,80,0.1)");
      ctx.fillStyle = stemGrad;
      ctx.beginPath();
      ctx.moveTo(ex.x - stemW / 2, ex.y);
      ctx.quadraticCurveTo(ex.x - stemW * 0.35, ex.y - stemH * 0.5, ex.x - stemW * 0.25, ex.y - stemH);
      ctx.lineTo(ex.x + stemW * 0.25, ex.y - stemH);
      ctx.quadraticCurveTo(ex.x + stemW * 0.35, ex.y - stemH * 0.5, ex.x + stemW / 2, ex.y);
      ctx.closePath();
      ctx.fill();

      // cap cloud
      const capY = ex.y - stemH - capR * 0.2;
      const cloud = ctx.createRadialGradient(ex.x, capY, capR * 0.1, ex.x, capY, capR);
      cloud.addColorStop(0, "rgba(255,200,120,0.6)");
      cloud.addColorStop(0.5, "rgba(255,150,60,0.35)");
      cloud.addColorStop(1, "rgba(120,80,60,0.05)");
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.arc(ex.x, capY, capR, 0, Math.PI * 2);
      ctx.fill();

      // shockwave ring
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - t)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
    };

    const drawBoy = (a: Actor, dt: number) => {
      if (!a.alive) return;
      a.animTime += dt;
      const t = a.animTime / 1000;
      // running cycle
      const leg = Math.sin(t * Math.PI * 3.0);
      const arm = Math.sin(t * Math.PI * 3.0 + Math.PI);

      ctx.save();
      ctx.translate(a.x, a.y);

      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(0, 4, a.w * 0.6, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // torso
      ctx.fillStyle = "#3b82f6"; // shirt
      ctx.beginPath();
      ctx.roundRect(-a.w * 0.45, -a.h + 16, a.w * 0.9, a.h - 10, 6);
      ctx.fill();

      // head
      ctx.fillStyle = "#f1c27d";
      ctx.beginPath();
      ctx.arc(0, -a.h - 6, 9, 0, Math.PI * 2);
      ctx.fill();
      // hair
      ctx.fillStyle = "#3f3f46";
      ctx.beginPath();
      ctx.arc(0, -a.h - 9, 9, Math.PI, 0);
      ctx.fill();

      // arms
      ctx.strokeStyle = "#f1c27d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-6, -a.h + 24);
      ctx.lineTo(-6 - arm * 8, -a.h + 36);
      ctx.moveTo(6, -a.h + 24);
      ctx.lineTo(6 + arm * 8, -a.h + 36);
      ctx.stroke();

      // legs
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-4, -8);
      ctx.lineTo(-4 - leg * 10, 8);
      ctx.moveTo(4, -8);
      ctx.lineTo(4 + leg * 10, 8);
      ctx.stroke();

      // shoes
      ctx.fillStyle = "#111827";
      ctx.fillRect(-4 - leg * 10 - 4, 8, 8, 3);
      ctx.fillRect(4 + leg * 10 - 4, 8, 8, 3);

      ctx.restore();
    };

    const drawBomber = (a: Actor, dt: number) => {
      if (!a.alive) return;
      a.animTime += dt;
      const bob = Math.sin(a.animTime / 300) * 2;

      ctx.save();
      ctx.translate(a.x, a.y + bob);
      // body
      const bodyGrad = ctx.createLinearGradient(-a.w / 2, 0, a.w / 2, 0);
      bodyGrad.addColorStop(0, "#6b7280");
      bodyGrad.addColorStop(1, "#9ca3af");
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-a.w / 2, 0);
      ctx.quadraticCurveTo(0, -a.h, a.w / 2, 0);
      ctx.quadraticCurveTo(0, a.h * 0.25, -a.w / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // cockpit tint
      ctx.fillStyle = "rgba(180,220,255,0.25)";
      ctx.beginPath();
      ctx.ellipse(0, -a.h * 0.35, a.w * 0.18, a.h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const circleHit = (ex: Explosion, cx: number, cy: number, radius: number) => {
      const dx = ex.x - cx;
      const dy = ex.y - cy;
      const dist = Math.hypot(dx, dy);
      return dist <= ex.r + radius;
    };

    const update = (dt: number) => {
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
          boy.y = groundY() - 8;
        }
        if (!bomber.alive) {
          bomber.alive = true;
          bomber.x = -200;
          bomber.y = groundY() - 200;
        }
      }

      if (boy.alive) {
        boy.x += 0.12 * dt; // ~120 px/s
        if (boy.x - boy.w / 2 > width + 40) {
          boy.x = -80;
        }
      }

      if (bomber.alive && boy.alive) {
        const targetX = boy.x - 160;
        const targetY = boy.y - 180;
        bomber.x += (targetX - bomber.x) * 0.03;
        bomber.y += (targetY - bomber.y) * 0.03;
      } else if (bomber.alive) {
        bomber.x += 0.08 * dt;
        if (bomber.x - bomber.w / 2 > width + 60) bomber.x = -120;
      }

      // collisions
      for (const ex of explosions) {
        if (!ex.alive) continue;
        if (bomber.alive && circleHit(ex, bomber.x, bomber.y, 40)) {
          // count once per explosion by marking dead soon after life
          // (score increments naturally many times; clamp it here)
          // We can simply set alive=false right away to avoid multi-hit
        }
        if (bomber.alive && circleHit(ex, bomber.x, bomber.y, 40)) {
          score += 1;
        }
        if (boy.alive && circleHit(ex, boy.x, boy.y - boy.h / 2, 28)) {
          boy.alive = false;
          glitchActive = true;
          glitchStart = performance.now();
          if (!reloadQueued) {
            reloadQueued = true;
            setTimeout(() => window.location.reload(), glitchDuration + 150);
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
        ctx.fillStyle = `rgba(${100 + Math.random() * 155},${100 + Math.random() * 155},255,${0.12 + Math.random() * 0.18})`;
        ctx.fillRect(0 + xOff, y, width, h);
      }
      ctx.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.25})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        for (let j = 0; j < 5; j++) ctx.lineTo(Math.random() * width, Math.random() * height);
        ctx.stroke();
      }
    };

    const loop = (time: number) => {
      if (!running) return;
      const dt = time - lastTime;
      lastTime = time;

      drawBackground();

      update(dt);

      // draw order
      for (const ex of explosions) if (ex.alive) drawNuclearExplosion(ex);
      drawMissile();
      drawParticles(dt);
      drawBoy(boy, dt);
      drawBomber(bomber, dt);
      drawScore();

      // cleanup explosions by life
      for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        if (performance.now() - ex.createdAt > ex.lifeMs) {
          ex.alive = false;
          explosions.splice(i, 1);
        }
      }

      if (glitchActive) {
        drawGlitch();
      }

      if (!firstClickHandled) {
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = "600 22px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Click anywhere to trigger a nuclear blast", width / 2, height / 2);
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
