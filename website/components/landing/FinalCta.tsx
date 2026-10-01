import { lazy, Suspense, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { LighthouseView } from './lighthouse/scene';
import { focusIn, stagger } from './motion';

const Lighthouse = lazy(() => import('./lighthouse/Lighthouse'));

/** A closer shot from the other side of the lighthouse. The distractions are gone; only calm sea is left. */
const FINALE: LighthouseView = {
    camera: { home: [46, 3.6, -30], look: [-6, 7.5, -70] },
    clearing: [0.5, 0.26, 0.5, 0.24],
    wreckage: false,
};

/** The page ends back at the lighthouse. */
export function FinalCta({ signedIn, onPrimary }: { signedIn: boolean; onPrimary: () => void }) {
    const ref = useRef<HTMLElement>(null);
    const near = useInView(ref, { margin: '0px 0px 60% 0px', once: true });

    return (
        <section ref={ref} className="relative isolate h-[max(720px,94svh)] overflow-hidden">
            <div aria-hidden className="absolute inset-0 -z-10">
                {near && (
                    <Suspense fallback={null}>
                        <Lighthouse view={FINALE} />
                    </Suspense>
                )}
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[var(--l-bg)] to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[var(--l-bg)]" />
            </div>

            <motion.div
                className="absolute inset-x-0 bottom-[12%] flex flex-col items-center px-8 text-center"
                variants={stagger(0.1, 0.15)}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.5 }}
            >
                <motion.h2 variants={focusIn} className="fzl-display text-[clamp(2.8rem,5.4vw,5.4rem)] [text-shadow:0_2px_24px_rgb(0_0_0/0.6)]">
                    Start your first session.
                </motion.h2>
                <motion.p variants={focusIn} className="fzl-lead mt-5">
                    Free to start. Takes about a minute to set up.
                </motion.p>
                <motion.div variants={focusIn} className="mt-9">
                    <button type="button" onClick={onPrimary} className="fzl-btn fzl-btn-primary">
                        {signedIn ? 'Open dashboard' : 'Get FocuzNow'}
                        <ArrowRight size={16} className="fzl-arrow" />
                    </button>
                </motion.div>
            </motion.div>
        </section>
    );
}
