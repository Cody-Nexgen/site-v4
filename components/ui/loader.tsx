"use client";
import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export const LoaderThree = ({ className }: { className?: string }) => {
  return (
    <div className={cn("flex h-full min-h-[200px] w-full flex-col items-center justify-center bg-black", className)}>
      <div className="relative flex items-center justify-center">
        {/* Outer Ring */}
        <motion.div
          className="absolute size-32 rounded-full border-t-2 border-indigo-500 opacity-20"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute size-32 rounded-full border-r-2 border-indigo-500/40"
          animate={{ rotate: -360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Inner Pulsing Circle */}
        <motion.div
          className="absolute size-24 rounded-full bg-indigo-500/10 blur-xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Logo Text */}
        <div className="z-10 flex flex-col items-center gap-1">
          <motion.span 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-lg font-bold tracking-tighter text-white"
          >
            Focuz<span className="text-indigo-500">now</span>
          </motion.span>
          <motion.div 
            className="h-0.5 w-12 rounded-full bg-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: "3rem" }}
            transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          />
        </div>
      </div>
      
      <motion.p 
        className="mt-8 text-xs font-medium uppercase tracking-widest text-neutral-500"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Loading
      </motion.p>
    </div>
  );
};
