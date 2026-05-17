"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { IconAlertTriangle, IconX, IconRobot, IconMailExclamation } from "@tabler/icons-react";
// Use CDN import to match project pattern
import { GoogleGenAI } from "https://esm.sh/@google/genai";

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: string | null;
}

export const ErrorModal = ({ isOpen, onClose, error }: ErrorModalProps) => {
  const [explanation, setExplanation] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showAiSection, setShowAiSection] = useState(true);

  useEffect(() => {
    const analyzeError = async () => {
      if (!error || !isOpen) return;

      // RESET STATE
      setExplanation("");
      setShowAiSection(true);

      const errLower = error.toLowerCase();

      // 1. STATIC FALLBACKS FOR KNOWN ERRORS
      // This prevents calling the AI API (and getting 400s) for common infrastructure issues.
      
      // Supabase 500 / Email Rate Limit Error
      if (
        errLower.includes("confirmation email") || 
        error.includes("500") || 
        errLower.includes("rate limit")
      ) {
        setLoading(false);
        setExplanation(
          "This is a common Supabase configuration issue. The default email service has a strict rate limit (usually 3 emails/hour). \n\n" +
          "FIX: Go to your Supabase Dashboard > Project Settings > Authentication > Rate Limits and increase the email limits, or configure a custom SMTP provider."
        );
        return; // STOP HERE - Do not call Gemini
      }

      // 403 Forbidden / Invalid Token Error
      // This handles the OTP error specifically to stop AI calls for simple typos
      if (
        error.includes("403") || 
        errLower.includes("forbidden") || 
        errLower.includes("invalid") ||
        errLower.includes("expired")
      ) {
        setLoading(false);
        setExplanation(
            "The verification code provided is incorrect or has expired.\n\n" +
            "FIX: Double-check the code you entered from your email. If it has been more than 10 minutes, please request a new code."
        );
        return; // STOP HERE
      }

      // Network / Fetch Errors
      if (errLower.includes("fetch") || errLower.includes("network")) {
         setLoading(false);
         setExplanation(
             "Could not connect to the server. Please check your internet connection and try again."
         );
         return; // STOP HERE
      }

      // API Key Error
      if (errLower.includes("api key")) {
         setLoading(false);
         setShowAiSection(false);
         return;
      }

      // 2. CHECK API KEY BEFORE CALLING AI
      let apiKey = "";
      try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
          apiKey = process.env.API_KEY;
        }
      } catch(e) {}

      // If no key, just hide AI section silently.
      if (!apiKey || apiKey.includes("your_api_key")) {
         setShowAiSection(false);
         return;
      }
      
      setLoading(true);
      try {
        const ai = new GoogleGenAI({ apiKey });
        const model = "gemini-2.5-flash";
        
        const prompt = `
          You are a helpful tech support assistant for "FocuzNow".
          The user encountered: "${error}".
          Explain what this means in simple terms and how to fix it. Keep it under 2 sentences.
        `;

        const result = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt }] }
        });
        
        setExplanation(result.text || "No explanation available.");
      } catch (e) {
        // Silently fail to static message if AI fails (e.g. 400 invalid key)
        console.warn("AI Analysis skipped due to config.");
        setShowAiSection(false); 
      } finally {
        setLoading(false);
      }
    };

    analyzeError();
  }, [error, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#1a1820] border border-red-500/30 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="bg-red-500/10 p-3 rounded-full flex-shrink-0">
                  <IconAlertTriangle className="text-red-500 w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white mb-1">Something went wrong</h3>
                  <p className="text-red-400 text-sm font-mono bg-red-950/30 p-2 rounded mb-4 break-words">
                    {error}
                  </p>

                  {showAiSection && (explanation || loading) && (
                    <div className="bg-[#25222e] rounded-xl p-4 border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                        <IconRobot className="w-4 h-4" /> 
                        {error?.includes("confirmation") ? "Troubleshooting" : "AI Analysis"}
                      </div>
                      {loading ? (
                        <div className="flex space-x-1 animate-pulse py-1">
                          <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                          <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                          <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                        </div>
                      ) : (
                        <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">
                          {explanation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-[#111] p-4 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-neutral-200 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
