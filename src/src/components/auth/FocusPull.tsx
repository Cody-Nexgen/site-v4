import { useEffect, useRef, type RefObject } from 'react';

/*
 * Out-of-focus lights drifting behind the sign-in headline, drawn through the same 1-bit
 * ordered dither as the landing hero. Each light keeps a fixed size and softness (set by its
 * depth); only the headline's words change focus. Plain WebGL, one fragment shader, rendered
 * at half resolution.
 */

const LIGHTS = 20;

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;  // -1..1
uniform vec4 uClear;    // calm area behind the headline: centre, half-size (0..1 of the canvas)
uniform vec3 uInk;
uniform vec3 uPaper;

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
    float lum = 0.0;
    for (int i = 0; i < ${LIGHTS}; i++) {
        float f = float(i);
        float depth = hash(f + 3.1);
        float r0 = mix(0.018, 0.075, hash(f + 7.7)) * mix(1.5, 0.6, depth);
        vec2 home = (vec2(hash(f + 1.3), hash(f + 5.9)) * 2.0 - 1.0) * vec2(aspect * 0.56, 0.56);
        float speed = mix(0.2, 0.08, depth);
        vec2 drift = vec2(sin(uTime * speed + f * 1.7), cos(uTime * speed * 0.8 + f * 2.3)) * 0.07;
        vec2 c = home + drift + uPointer * 0.035 * (1.0 - depth);
        // Circle of confusion: lights further from the focal plane are softer. Fixed per light.
        float coc = 0.018 + 0.07 * abs(depth - 0.3);
        float r = r0 + coc * 0.7;
        float d = length(p - c);
        float disc = 1.0 - smoothstep(r - coc, r + coc, d);
        float rim = smoothstep(r - coc * 1.8, r, d) * disc;
        float energy = (r0 * r0) / (r * r);
        float bright = mix(0.22, 0.8, hash(f + 9.4));
        lum += (disc * 0.6 + rim * 0.55) * energy * bright;
    }
    // Keep the water calm behind the words, and fall off towards the edges.
    vec2 q = abs(uv - uClear.xy) / uClear.zw;
    float clear = 1.0 - smoothstep(0.85, 1.2, pow(pow(q.x, 4.0) + pow(q.y, 4.0), 0.25));
    lum *= 1.0 - clear;
    // Quiet bands under the top bar and the caption, and a soft vignette.
    float bands = smoothstep(0.06, 0.2, 1.0 - uv.y) * smoothstep(0.08, 0.24, uv.y);
    lum *= bands * bands;
    lum *= smoothstep(1.3, 0.25, length(p * vec2(0.75, 1.0)));
    float bit = step(bayer8(gl_FragCoord.xy) + 0.004, pow(clamp(lum, 0.0, 1.0), 0.9));
    gl_FragColor = vec4(mix(uInk, uPaper, bit), 1.0);
}
`;

/** Any CSS color as sRGB 0–1 (the canvas 2D context resolves oklch and friends for us). */
function cssToRgb(css: string): [number, number, number] {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!ctx) return [0, 0, 0];
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r / 255, g / 255, b / 255];
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'shader');
    return shader;
}

type Props = {
    className?: string;
    /** The headline: the lights stay clear of it. */
    clearRef: RefObject<HTMLElement | null>;
    /** CSS colors for the two dither tones. */
    ink: string;
    paper: string;
};

export function FocusPull({ className = '', clearRef, ink, paper }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const gl = canvas?.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
        if (!canvas || !gl) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let program: WebGLProgram;
        try {
            program = gl.createProgram()!;
            gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
            gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
        } catch {
            return;
        }
        gl.useProgram(program);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(program, 'aPos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        const u = (name: string) => gl.getUniformLocation(program, name);
        const uRes = u('uRes');
        const uTime = u('uTime');
        const uPointer = u('uPointer');
        const uClear = u('uClear');
        gl.uniform3fv(u('uInk'), cssToRgb(ink));
        gl.uniform3fv(u('uPaper'), cssToRgb(paper));

        const PIXEL = 2;
        const fit = () => {
            const w = Math.max(2, Math.round(canvas.clientWidth / PIXEL));
            const h = Math.max(2, Math.round(canvas.clientHeight / PIXEL));
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
            gl.uniform2f(uRes, w, h);
            const box = clearRef.current?.getBoundingClientRect();
            const c = canvas.getBoundingClientRect();
            if (box && c.width && c.height) {
                gl.uniform4f(
                    uClear,
                    (box.left + box.width / 2 - c.left) / c.width,
                    1 - (box.top + box.height / 2 - c.top) / c.height,
                    (box.width / 2 + 96) / c.width,
                    (box.height / 2 + 84) / c.height,
                );
            } else {
                gl.uniform4f(uClear, 0.3, 0.5, 0.001, 0.001);
            }
        };

        const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
        const onPointer = (e: PointerEvent) => {
            pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
            pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
        };

        let raf = 0;
        let last = 0;
        const start = performance.now();
        const draw = (now: number) => {
            const t = (now - start) / 1000;
            pointer.sx += (pointer.x - pointer.sx) * 0.05;
            pointer.sy += (pointer.y - pointer.sy) * 0.05;
            gl.uniform1f(uTime, reduce ? 12 : t);
            gl.uniform2f(uPointer, pointer.sx, pointer.sy);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            if (now - last < 1000 / 40) return;
            last = now;
            draw(now);
        };

        fit();
        const ro = new ResizeObserver(() => {
            fit();
            if (reduce) draw(performance.now());
        });
        ro.observe(canvas);
        if (clearRef.current) ro.observe(clearRef.current);

        const run = () => {
            cancelAnimationFrame(raf);
            raf = 0;
            if (!reduce && !document.hidden) raf = requestAnimationFrame(loop);
        };
        if (reduce) draw(performance.now());
        else {
            window.addEventListener('pointermove', onPointer, { passive: true });
            run();
        }
        document.addEventListener('visibilitychange', run);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.removeEventListener('pointermove', onPointer);
            document.removeEventListener('visibilitychange', run);
            gl.deleteBuffer(buffer);
            gl.deleteProgram(program);
        };
    }, [clearRef, ink, paper]);

    return <canvas ref={canvasRef} aria-hidden className={`block h-full w-full ${className}`} style={{ imageRendering: 'pixelated' }} />;
}
