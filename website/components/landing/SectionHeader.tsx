import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { focusIn, stagger } from './motion';

type SectionHeaderProps = {
    eyebrow: string;
    title: ReactNode;
    lead?: ReactNode;
    align?: 'center' | 'left';
};

export function SectionHeader({ eyebrow, title, lead, align = 'center' }: SectionHeaderProps) {
    const centered = align === 'center';
    return (
        <motion.div
            className={`flex flex-col ${centered ? 'mx-auto max-w-[760px] items-center text-center' : 'items-start'}`}
            variants={stagger(0.08)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.6 }}
        >
            <motion.span variants={focusIn} className="fzl-eyebrow">
                {eyebrow}
            </motion.span>
            <motion.h2 variants={focusIn} className="fzl-h2 mt-5">
                {title}
            </motion.h2>
            {lead && (
                <motion.p variants={focusIn} className={`fzl-lead mt-5 ${centered ? 'max-w-[34rem]' : 'max-w-[30rem]'}`}>
                    {lead}
                </motion.p>
            )}
        </motion.div>
    );
}
