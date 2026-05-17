"use client";
import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

type ParticlesProps = {
  id?: string;
  className?: string;
  background?: string;
  particleSize?: number;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  particleColor?: string;
  particleDensity?: number;
};

export const SparklesCore = (props: ParticlesProps) => {
  const {
    id,
    className,
    background,
    minSize = 1,
    maxSize = 3,
    speed = 4,
    particleColor = "#ffffff",
    particleDensity = 120,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      opacitySpeed: number;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.size = Math.random() * (maxSize - minSize) + minSize;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.opacity = Math.random();
        this.opacitySpeed = Math.random() * 0.02 * (Math.random() > 0.5 ? 1 : -1);
      }

      update() {
        this.x += this.speedX * (speed / 2);
        this.y += this.speedY * (speed / 2);

        if (this.x > canvas!.width) this.x = 0;
        if (this.x < 0) this.x = canvas!.width;
        if (this.y > canvas!.height) this.y = 0;
        if (this.y < 0) this.y = canvas!.height;

        this.opacity += this.opacitySpeed;
        if (this.opacity <= 0 || this.opacity >= 1) {
            this.opacitySpeed *= -1;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = particleColor || "#ffffff";
        ctx.globalAlpha = Math.max(0, Math.min(1, this.opacity));
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const init = () => {
        particles = [];
        // Use density as a raw count for simplicity in this replacement
        // Adjust for typical density prop usage (e.g. 1200 passed in demo is a lot, so we scale it down slightly if needed, or use as is)
        // For the compare component context (small area), strict density might be too high, but let's assume 'particleDensity' is count here for the canvas implementation
        const count = particleDensity || 100;
        
        for (let i = 0; i < count; i++) {
            particles.push(new Particle());
        }
    };

    const animate = () => {
      if (!canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });

      animationId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
        if (canvas && canvas.parentElement) {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
            init();
        }
    };

    // Initial setup
    handleResize();
    
    // Observer for resize
    const resizeObserver = new ResizeObserver(() => {
        handleResize();
    });
    
    if (canvas.parentElement) {
        resizeObserver.observe(canvas.parentElement);
    }

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
    };
  }, [maxSize, minSize, particleColor, particleDensity, speed]);

  return (
    <canvas
      ref={canvasRef}
      id={id}
      className={cn("h-full w-full", className)}
      style={{
        background: background || "transparent",
      }}
    />
  );
};
