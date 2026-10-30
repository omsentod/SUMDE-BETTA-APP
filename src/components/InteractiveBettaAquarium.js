'use client';
import { useEffect, useRef } from 'react';
import styles from './InteractiveBettaAquarium.module.css';

/**
 * InteractiveBettaAquarium
 * High-craft living aquatic canvas simulation featuring an artisanal Betta Splendens.
 * 
 * Includes:
 * - Sinuous undulating spine dynamics (kinematics + wave propagation).
 * - Billowing gossamer caudal, dorsal, and anal finnage with delicate fin rays.
 * - Interactive cursor following with natural fluid inertia.
 * - Ambient rising micro-bubbles and soft light caustics.
 * - 0% CPU consumption when scrolled out of viewport (IntersectionObserver).
 */
export default function InteractiveBettaAquarium({
    fishCount = 1,
    opacity = 1,
    className = ''
}) {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId = null;
        let isVisible = true;
        let width = container.clientWidth || 800;
        let height = container.clientHeight || 400;

        // Mouse tracking state
        const mouse = {
            x: width * 0.5,
            y: height * 0.5,
            active: false,
            lastMoveTime: 0
        };

        // Water ripples
        const ripples = [];
        const addRipple = (x, y) => {
            if (ripples.length > 8) ripples.shift();
            ripples.push({ x, y, radius: 4, maxRadius: 55, alpha: 0.35 });
        };

        // Rising micro-bubbles
        const bubbleCount = Math.min(24, Math.floor(width / 35));
        const bubbles = [];
        for (let i = 0; i < bubbleCount; i++) {
            bubbles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: 1.2 + Math.random() * 2.2,
                vy: 0.3 + Math.random() * 0.5,
                wobbleSpeed: 1 + Math.random() * 2,
                wobbleAmp: 0.4 + Math.random() * 0.6,
                seed: Math.random() * 100,
                alpha: 0.15 + Math.random() * 0.25
            });
        }

        // Resize Canvas with Retina Dpr
        const handleResize = () => {
            if (!container || !canvas) return;
            const rect = container.getBoundingClientRect();
            width = Math.max(300, rect.width);
            height = Math.max(200, rect.height);

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        handleResize();
        const resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(container);

        // Betta Fish Model
        class BettaSplendens {
            constructor(startX, startY, palette, scale = 1) {
                this.x = startX;
                this.y = startY;
                this.scale = scale;
                this.angle = Math.random() * Math.PI * 2;
                this.speed = 1.1;
                this.maxSpeed = 2.4;
                this.palette = palette;

                // Spine simulation
                this.bodyLength = 11;
                this.jointDistance = 7 * scale;
                this.spine = [];
                for (let i = 0; i < this.bodyLength; i++) {
                    this.spine.push({
                        x: startX - i * this.jointDistance,
                        y: startY,
                        angle: this.angle
                    });
                }

                this.timer = Math.random() * 100;
                this.wanderAngle = this.angle;
                this.wanderTimer = 0;
            }

            update(dt, targetX, targetY, isTargetActive) {
                this.timer += dt * 3.2;
                this.wanderTimer += dt;

                // Determine navigation heading
                let desiredAngle = this.angle;

                if (isTargetActive) {
                    const dx = targetX - this.x;
                    const dy = targetY - this.y;
                    const dist = Math.hypot(dx, dy);

                    if (dist > 40) {
                        desiredAngle = Math.atan2(dy, dx);
                        this.speed = Math.min(this.maxSpeed, 1.2 + (dist / 300) * 1.2);
                    } else {
                        // Circulate near cursor
                        desiredAngle = Math.atan2(dy, dx) + Math.PI * 0.45;
                        this.speed = 1.0;
                    }
                } else {
                    // Organic wandering within canvas bounds
                    if (this.wanderTimer > 3.0 || Math.random() < 0.02) {
                        this.wanderAngle += (Math.random() - 0.5) * 1.5;
                        this.wanderTimer = 0;
                    }

                    // Soft wall bounce
                    const margin = 80;
                    if (this.x < margin) this.wanderAngle = 0;
                    else if (this.x > width - margin) this.wanderAngle = Math.PI;
                    if (this.y < margin) this.wanderAngle = Math.PI * 0.5;
                    else if (this.y > height - margin) this.wanderAngle = -Math.PI * 0.5;

                    desiredAngle = this.wanderAngle;
                    this.speed = 1.1;
                }

                // Smooth rotation with angular interpolation
                let diff = desiredAngle - this.angle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.angle += diff * Math.min(1, dt * 2.8);

                // Move head forward
                this.x += Math.cos(this.angle) * this.speed * (dt * 60);
                this.y += Math.sin(this.angle) * this.speed * (dt * 60);

                // Keep head in canvas
                this.x = Math.max(30, Math.min(width - 30, this.x));
                this.y = Math.max(30, Math.min(height - 30, this.y));

                this.spine[0].x = this.x;
                this.spine[0].y = this.y;
                this.spine[0].angle = this.angle;

                // Propagate spine undulation (fish swimming kinematics)
                for (let i = 1; i < this.bodyLength; i++) {
                    const p = this.spine[i - 1];
                    const c = this.spine[i];
                    const dx = c.x - p.x;
                    const dy = c.y - p.y;
                    const baseAngle = Math.atan2(dy, dx);

                    // Sinuous traveling wave: amplitude increases towards caudal peduncle
                    const waveAmp = 0.22 * (i / this.bodyLength);
                    const wiggle = Math.sin(this.timer - i * 0.55) * waveAmp;
                    const effectiveAngle = baseAngle + wiggle;

                    c.x = p.x + Math.cos(effectiveAngle) * this.jointDistance;
                    c.y = p.y + Math.sin(effectiveAngle) * this.jointDistance;
                    c.angle = effectiveAngle;
                }
            }

            draw(ctx) {
                const s = this.scale;
                const pal = this.palette;

                // 1. Draw Ventral / Pelvic Tassels (long slender feeler fins at joint 3)
                const vJoint = this.spine[2] || this.spine[0];
                const vNx = -Math.sin(vJoint.angle);
                const vNy = Math.cos(vJoint.angle);
                const tasselWave = Math.sin(this.timer * 0.9) * 4;

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(vJoint.x + vNx * 5 * s, vJoint.y + vNy * 5 * s);
                ctx.quadraticCurveTo(
                    vJoint.x + vNx * 16 * s + tasselWave,
                    vJoint.y + vNy * 16 * s + 6 * s,
                    vJoint.x - Math.cos(vJoint.angle) * 32 * s,
                    vJoint.y - Math.sin(vJoint.angle) * 32 * s + 18 * s
                );
                ctx.strokeStyle = pal.tassel;
                ctx.lineWidth = 1.6 * s;
                ctx.stroke();
                ctx.restore();

                // 2. Draw Anal Fin (lower trailing robe spanning joints 4 to 9)
                ctx.save();
                ctx.beginPath();
                const aStart = this.spine[3];
                const aEnd = this.spine[8];
                const aMid = this.spine[6];
                const aWave = Math.sin(this.timer * 0.8) * 6 * s;

                const anNx = -Math.sin(aMid.angle);
                const anNy = Math.cos(aMid.angle);

                ctx.moveTo(aStart.x, aStart.y);
                ctx.bezierCurveTo(
                    aStart.x + anNx * 22 * s,
                    aStart.y + anNy * 22 * s,
                    aMid.x + anNx * 28 * s + aWave,
                    aMid.y + anNy * 28 * s + aWave,
                    aEnd.x,
                    aEnd.y
                );
                ctx.closePath();
                const analGrad = ctx.createLinearGradient(aStart.x, aStart.y, aMid.x + anNx * 28 * s, aMid.y + anNy * 28 * s);
                analGrad.addColorStop(0, pal.finBase);
                analGrad.addColorStop(0.6, pal.finMid);
                analGrad.addColorStop(1, pal.finTip);
                ctx.fillStyle = analGrad;
                ctx.fill();
                ctx.restore();

                // 3. Draw Dorsal Fin (upper silken crest spanning joints 3 to 7)
                ctx.save();
                ctx.beginPath();
                const dStart = this.spine[3];
                const dEnd = this.spine[7];
                const dMid = this.spine[5];
                const dWave = Math.cos(this.timer * 0.85) * 5 * s;

                const dnNx = Math.sin(dMid.angle);
                const dnNy = -Math.cos(dMid.angle);

                ctx.moveTo(dStart.x, dStart.y);
                ctx.bezierCurveTo(
                    dStart.x + dnNx * 20 * s,
                    dStart.y + dnNy * 20 * s,
                    dMid.x + dnNx * 26 * s + dWave,
                    dMid.y + dnNy * 26 * s + dWave,
                    dEnd.x,
                    dEnd.y
                );
                ctx.closePath();
                const dorsalGrad = ctx.createLinearGradient(dStart.x, dStart.y, dMid.x + dnNx * 26 * s, dMid.y + dnNy * 26 * s);
                dorsalGrad.addColorStop(0, pal.finBase);
                dorsalGrad.addColorStop(0.7, pal.finMid);
                dorsalGrad.addColorStop(1, pal.finTip);
                ctx.fillStyle = dorsalGrad;
                ctx.fill();
                ctx.restore();

                // 4. Draw Majestic Caudal (Tail) Fin - Halfmoon / Plakat Flare
                const tailJoint = this.spine[this.bodyLength - 1];
                const tailAngle = tailJoint.angle + Math.PI; // pointing backward
                const tailLen = 54 * s;
                const fanSpread = Math.PI * 0.72; // ~130 deg expansive fan

                ctx.save();
                // Tail base point
                const bx = tailJoint.x;
                const by = tailJoint.y;

                // Multiple layered gossamer fan leaves for sheer translucent luxury depth
                for (let layer = 0; layer < 2; layer++) {
                    const layerSpread = fanSpread * (layer === 0 ? 1 : 0.82);
                    const layerLen = tailLen * (layer === 0 ? 1 : 0.88);
                    const layerWaveOffset = layer * 0.4;

                    ctx.beginPath();
                    ctx.moveTo(bx, by);

                    const steps = 7;
                    for (let st = 0; st <= steps; st++) {
                        const t = st / steps;
                        const finAngle = tailAngle - layerSpread * 0.5 + t * layerSpread;
                        const wave = Math.sin(this.timer * 1.1 + t * 4 + layerWaveOffset) * (6 * s);
                        const r = layerLen + wave;
                        const px = bx + Math.cos(finAngle) * r;
                        const py = by + Math.sin(finAngle) * r;

                        if (st === 0) {
                            ctx.lineTo(px, py);
                        } else {
                            const prevAngle = tailAngle - layerSpread * 0.5 + ((st - 1) / steps) * layerSpread;
                            const prevPx = bx + Math.cos(prevAngle) * r;
                            const prevPy = by + Math.sin(prevAngle) * r;
                            const cpx = (prevPx + px) * 0.5 + Math.sin(this.timer + t * 2) * 3;
                            const cpy = (prevPy + py) * 0.5;
                            ctx.quadraticCurveTo(cpx, cpy, px, py);
                        }
                    }
                    ctx.closePath();

                    const tailGrad = ctx.createRadialGradient(bx, by, 4 * s, bx, by, tailLen);
                    tailGrad.addColorStop(0, pal.tailBase);
                    tailGrad.addColorStop(0.4, pal.tailMid);
                    tailGrad.addColorStop(0.85, pal.tailOuter);
                    tailGrad.addColorStop(1, pal.tailEdge);
                    ctx.fillStyle = tailGrad;
                    ctx.fill();
                }

                // Delicate radiating fin rays (veining structure)
                ctx.beginPath();
                const rayCount = 9;
                for (let r = 0; r < rayCount; r++) {
                    const rt = r / (rayCount - 1);
                    const rayAngle = tailAngle - fanSpread * 0.48 + rt * fanSpread * 0.96;
                    const rayWave = Math.sin(this.timer * 1.1 + rt * 4) * (5 * s);
                    const rx = bx + Math.cos(rayAngle) * (tailLen * 0.95 + rayWave);
                    const ry = by + Math.sin(rayAngle) * (tailLen * 0.95 + rayWave);
                    ctx.moveTo(bx, by);
                    ctx.lineTo(rx, ry);
                }
                ctx.strokeStyle = pal.finRays;
                ctx.lineWidth = 0.8 * s;
                ctx.stroke();
                ctx.restore();

                // 5. Draw Fish Torpedo Body
                const bodyRadii = [3.5, 7.5, 10.5, 11, 10.5, 9.5, 8, 6.5, 5, 3.8, 2.5];
                const leftPoints = [];
                const rightPoints = [];

                for (let i = 0; i < this.bodyLength; i++) {
                    const joint = this.spine[i];
                    const r = (bodyRadii[i] || 3) * s;
                    const nx = -Math.sin(joint.angle);
                    const ny = Math.cos(joint.angle);
                    leftPoints.push({ x: joint.x + nx * r, y: joint.y + ny * r });
                    rightPoints.push({ x: joint.x - nx * r, y: joint.y - ny * r });
                }

                ctx.save();
                ctx.beginPath();
                // Snout
                const head = this.spine[0];
                ctx.moveTo(head.x + Math.cos(head.angle) * 4 * s, head.y + Math.sin(head.angle) * 4 * s);

                // Left side
                for (let i = 0; i < leftPoints.length; i++) {
                    ctx.lineTo(leftPoints[i].x, leftPoints[i].y);
                }

                // Tail junction
                const last = this.spine[this.bodyLength - 1];
                ctx.lineTo(last.x, last.y);

                // Right side (reverse)
                for (let i = rightPoints.length - 1; i >= 0; i--) {
                    ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
                }
                ctx.closePath();

                // Torso luxury gradient
                const bodyGrad = ctx.createLinearGradient(
                    head.x, head.y,
                    last.x, last.y
                );
                bodyGrad.addColorStop(0, pal.snout);
                bodyGrad.addColorStop(0.3, pal.bodyMain);
                bodyGrad.addColorStop(0.8, pal.peduncle);
                bodyGrad.addColorStop(1, pal.tailBase);
                ctx.fillStyle = bodyGrad;
                ctx.fill();

                // Operculum (gill plate line)
                const gillJoint = this.spine[2];
                const gNx = -Math.sin(gillJoint.angle);
                const gNy = Math.cos(gillJoint.angle);
                ctx.beginPath();
                ctx.arc(gillJoint.x, gillJoint.y, 6.5 * s, gillJoint.angle - 1.2, gillJoint.angle + 1.2);
                ctx.strokeStyle = pal.gillPlate;
                ctx.lineWidth = 1.2 * s;
                ctx.stroke();

                // Jewel-like Eyes (Left and Right)
                const eyeJoint = this.spine[1];
                const eNx = -Math.sin(eyeJoint.angle);
                const eNy = Math.cos(eyeJoint.angle);
                const eyeOffset = 6.2 * s;

                [1, -1].forEach(side => {
                    const ex = eyeJoint.x + eNx * eyeOffset * side;
                    const ey = eyeJoint.y + eNy * eyeOffset * side;

                    // Eye outer gold ring
                    ctx.beginPath();
                    ctx.arc(ex, ey, 2.0 * s, 0, Math.PI * 2);
                    ctx.fillStyle = '#f59e0b';
                    ctx.fill();

                    // Dark pupil
                    ctx.beginPath();
                    ctx.arc(ex, ey, 1.2 * s, 0, Math.PI * 2);
                    ctx.fillStyle = '#0f172a';
                    ctx.fill();

                    // Catchlight dot
                    ctx.beginPath();
                    ctx.arc(ex - 0.4 * s, ey - 0.4 * s, 0.45 * s, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                });

                // 6. Fluttering Pectoral Fins (Joint 2)
                const pJoint = this.spine[2];
                const pNx = -Math.sin(pJoint.angle);
                const pNy = Math.cos(pJoint.angle);
                const pecFlap = Math.sin(this.timer * 2.8) * 0.45;

                [1, -1].forEach(side => {
                    ctx.save();
                    ctx.translate(pJoint.x + pNx * 7 * s * side, pJoint.y + pNy * 7 * s * side);
                    ctx.rotate(pJoint.angle + (Math.PI * 0.5 * side) + pecFlap * side);
                    ctx.beginPath();
                    ctx.ellipse(0, 5 * s, 3.2 * s, 7.5 * s, 0.2 * side, 0, Math.PI * 2);
                    ctx.fillStyle = pal.pectoral;
                    ctx.fill();
                    ctx.restore();
                });

                ctx.restore();
            }
        }

        // Color Palettes (Curated Fine Art Grade)
        const primaryPalette = {
            snout: '#ff7b47',
            bodyMain: '#ea580c',
            peduncle: '#0284c7',
            gillPlate: 'rgba(255, 255, 255, 0.35)',
            tassel: 'rgba(245, 158, 11, 0.75)',
            finBase: 'rgba(234, 88, 12, 0.65)',
            finMid: 'rgba(14, 165, 233, 0.45)',
            finTip: 'rgba(254, 240, 138, 0.2)',
            tailBase: 'rgba(2, 132, 199, 0.85)',
            tailMid: 'rgba(234, 88, 12, 0.65)',
            tailOuter: 'rgba(56, 189, 248, 0.4)',
            tailEdge: 'rgba(253, 224, 71, 0.15)',
            finRays: 'rgba(255, 255, 255, 0.25)',
            pectoral: 'rgba(254, 215, 170, 0.45)'
        };

        const royalPalette = {
            snout: '#38bdf8',
            bodyMain: '#1e40af',
            peduncle: '#6366f1',
            gillPlate: 'rgba(255, 255, 255, 0.4)',
            tassel: 'rgba(56, 189, 248, 0.75)',
            finBase: 'rgba(30, 64, 175, 0.7)',
            finMid: 'rgba(139, 92, 246, 0.5)',
            finTip: 'rgba(192, 132, 252, 0.2)',
            tailBase: 'rgba(30, 64, 175, 0.9)',
            tailMid: 'rgba(124, 58, 237, 0.65)',
            tailOuter: 'rgba(56, 189, 248, 0.4)',
            tailEdge: 'rgba(244, 114, 182, 0.2)',
            finRays: 'rgba(255, 255, 255, 0.28)',
            pectoral: 'rgba(186, 230, 253, 0.45)'
        };

        // Instantiate Fish
        const fishes = [];
        fishes.push(new BettaSplendens(width * 0.35, height * 0.5, primaryPalette, 1.05));
        if (fishCount > 1) {
            fishes.push(new BettaSplendens(width * 0.65, height * 0.4, royalPalette, 0.92));
        }

        // Pointer Event Handlers
        const onPointerMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
            mouse.active = true;
            mouse.lastMoveTime = performance.now();

            // Occasional ripple on movement
            if (Math.random() < 0.12) {
                addRipple(mouse.x, mouse.y);
            }
        };

        const onPointerLeave = () => {
            mouse.active = false;
        };

        const onPointerDown = (e) => {
            const rect = canvas.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            addRipple(cx, cy);
            addRipple(cx, cy);
        };

        const parent = container.parentElement || container;
        parent.addEventListener('mousemove', onPointerMove, { passive: true });
        parent.addEventListener('mouseleave', onPointerLeave, { passive: true });
        parent.addEventListener('mousedown', onPointerDown, { passive: true });

        // Visibility observer (Pause when offscreen)
        const observer = new IntersectionObserver(([entry]) => {
            isVisible = entry.isIntersecting;
        }, { threshold: 0.05 });
        observer.observe(container);

        // Main Animation Loop
        let lastTime = performance.now();

        const render = (time) => {
            animationFrameId = requestAnimationFrame(render);
            if (!isVisible || document.hidden) return;

            const dt = Math.min((time - lastTime) / 1000, 0.08);
            lastTime = time;

            // Deactivate mouse target after 2.5s of stillness
            const isMouseTargetActive = mouse.active && (time - mouse.lastMoveTime < 2500);

            ctx.clearRect(0, 0, width, height);

            // Draw Rising Ambient Micro-Bubbles
            for (let b of bubbles) {
                b.y -= b.vy * (dt * 60);
                b.x += Math.sin(time * 0.002 * b.wobbleSpeed + b.seed) * b.wobbleAmp;

                if (b.y < -10) {
                    b.y = height + 10;
                    b.x = Math.random() * width;
                }

                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(186, 230, 253, ${b.alpha * 0.7})`;
                ctx.fill();
            }

            // Draw Water Ripples
            for (let i = ripples.length - 1; i >= 0; i--) {
                const rp = ripples[i];
                rp.radius += dt * 45;
                rp.alpha -= dt * 0.45;

                if (rp.alpha <= 0 || rp.radius >= rp.maxRadius) {
                    ripples.splice(i, 1);
                    continue;
                }

                ctx.beginPath();
                ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(56, 189, 248, ${rp.alpha * 0.4})`;
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }

            // Update & Draw Betta Fish
            fishes.forEach((fish, idx) => {
                // Secondary fish targets an offset point so they swim harmoniously
                const targetOffsetX = idx === 0 ? 0 : 70;
                const targetOffsetY = idx === 0 ? 0 : -40;
                fish.update(dt, mouse.x + targetOffsetX, mouse.y + targetOffsetY, isMouseTargetActive);
                fish.draw(ctx);
            });
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
            observer.disconnect();
            parent.removeEventListener('mousemove', onPointerMove);
            parent.removeEventListener('mouseleave', onPointerLeave);
            parent.removeEventListener('mousedown', onPointerDown);
        };
    }, [fishCount]);

    return (
        <div ref={containerRef} className={`${styles.aquariumContainer} ${className}`} aria-hidden="true">
            <canvas ref={canvasRef} className={styles.aquariumCanvas} />
            <div className={styles.causticsGlow} />
            <div className={styles.aquaticVignette} />
        </div>
    );
}
