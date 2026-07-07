"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const WORDS = ["build", "work", "win", "focus"] as const;

export function RotatingWord({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const word = WORDS[index % WORDS.length];

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % WORDS.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className={`inline-block min-w-[5ch] text-purple-500 font-bold ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={word}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="inline-block"
          style={{ textShadow: "0 0 20px rgba(168, 85, 247, 0.5)" }}
        >
          {word}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
