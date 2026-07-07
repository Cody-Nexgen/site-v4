"use client";

import React from "react";

type Props = {
  phase: "redirecting" | "done";
};

export default function ExtensionHandoffScreen({ phase }: Props) {
  const isRedirecting = phase === "redirecting";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-10">
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full" />
        {isRedirecting && (
          <div className="absolute inset-0 border-4 border-t-purple-500 rounded-full animate-spin" />
        )}
        {!isRedirecting && (
          <div className="absolute inset-0 flex items-center justify-center text-2xl text-emerald-400">
            ✓
          </div>
        )}
      </div>
      <h1 className="text-2xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">
        {isRedirecting ? "Redirecting to extension…" : "Redirected to extension"}
      </h1>
      <p className="text-neutral-400 text-sm text-center max-w-md">
        {isRedirecting
          ? "Syncing your account with the FocuzNow extension. This only takes a moment."
          : "You're signed in. Feel free to close this tab and continue in the extension."}
      </p>
    </div>
  );
}
