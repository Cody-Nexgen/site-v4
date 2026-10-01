import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';

const WORDS = 'You don’t need more willpower. You need fewer doors.'.split(' ');

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
    const opacity = useTransform(progress, range, [0.13, 1]);
    const blur = useTransform(progress, range, ['blur(3px)', 'blur(0px)']);
    return (
        <motion.span className="inline-block" style={{ opacity, filter: blur, marginRight: '0.24em' }}>
            {children}
        </motion.span>
    );
}

/** One line that comes into focus word by word as you scroll. */
export function Statement() {
    const ref = useRef<HTMLParagraphElement>(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.5'] });

    return (
        <section className="px-5 py-36 sm:px-8 sm:py-52">
            <p
                ref={ref}
                className="mx-auto max-w-[16ch] text-center text-[clamp(2.3rem,6vw,4.9rem)] font-[610] leading-[1.04] tracking-[-0.045em]"
            >
                {reduce
                    ? WORDS.join(' ')
                    : WORDS.map((word, i) => (
                          <Word key={i} progress={scrollYProgress} range={[i / WORDS.length, (i + 1) / WORDS.length]}>
                              {word}
                          </Word>
                      ))}
            </p>
        </section>
    );
}
