import { useEffect, useRef } from "react";

/**
 * Original abstract "locking in / focus" visual: particles drift along
 * orbital paths and converge toward a glowing central core, layered over a
 * soft amber gradient mesh. No stock photography — fully generative.
 */
export default function FocusVisual() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let t = 0;

    // Amber / warm palette drawn from the app theme.
    const AMBER = [232, 165, 71];
    const AMBER_SOFT = [214, 140, 60];

    const COUNT = 64;
    let particles = [];

    const seed = () => {
      particles = Array.from({ length: COUNT }, () => {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.32 + Math.random() * 0.6; // fraction of half-size
        return {
          angle,
          radius,
          baseRadius: radius,
          speed: 0.0008 + Math.random() * 0.0016,
          size: 0.6 + Math.random() * 1.8,
          pulse: Math.random() * Math.PI * 2,
        };
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const half = Math.min(width, height) / 2;

      // Central glowing core.
      const corePulse = 0.5 + 0.5 * Math.sin(t * 0.02);
      const coreR = half * (0.16 + corePulse * 0.03);
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.6);
      coreGrad.addColorStop(0, `rgba(${AMBER[0]},${AMBER[1]},${AMBER[2]},0.55)`);
      coreGrad.addColorStop(0.5, `rgba(${AMBER[0]},${AMBER[1]},${AMBER[2]},0.12)`);
      coreGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // Concentric focus rings.
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const rr = half * (0.28 * i);
        ctx.strokeStyle = `rgba(${AMBER_SOFT[0]},${AMBER_SOFT[1]},${AMBER_SOFT[2]},${0.09 / i})`;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Particles orbit inward, converging toward the core.
      for (const p of particles) {
        p.angle += p.speed * (1 + (1 - p.radius));
        // Slow breathing convergence toward center and back out.
        const converge = 0.5 + 0.5 * Math.sin(t * 0.004 + p.pulse);
        p.radius = p.baseRadius * (0.5 + converge * 0.5);

        const r = p.radius * half;
        const x = cx + Math.cos(p.angle) * r;
        const y = cy + Math.sin(p.angle) * r * 0.82; // slight vertical squash

        // Line pulling toward the core.
        const alphaLine = 0.16 * (1 - p.radius);
        ctx.strokeStyle = `rgba(${AMBER[0]},${AMBER[1]},${AMBER[2]},${alphaLine})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(cx, cy);
        ctx.stroke();

        const twinkle = 0.5 + 0.5 * Math.sin(t * 0.03 + p.pulse);
        ctx.fillStyle = `rgba(${AMBER[0]},${AMBER[1]},${AMBER[2]},${0.35 + twinkle * 0.45})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduce) raf = requestAnimationFrame(draw);
    };

    seed();
    resize();
    draw();

    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw();
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="focus-visual" aria-hidden="true">
      <div className="focus-visual-mesh" />
      <canvas ref={canvasRef} className="focus-visual-canvas" />
      <div className="focus-visual-grain" />
    </div>
  );
}
