import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Shield, Clock, Sparkles, ArrowRight, Check } from 'lucide-react';

interface OnboardingOverlayProps {
    onComplete: () => void;
    onStepChange: (step: number) => void;
    currentStep: number;
}

export function OnboardingOverlay({ onComplete, onStepChange, currentStep }: OnboardingOverlayProps) {
    const steps = [
        {
            title: "Welcome to FocuzNow",
            description: "Your personal productivity companion. Let's get you set up for success.",
            icon: <Sparkles className="w-12 h-12 text-purple-400" />,
            color: "bg-purple-500/20"
        },
        {
            title: "Block Distractions",
            description: "Add distracting sites to your blocklist. We'll stop you from visiting them when you need to focus.",
            icon: <Shield className="w-12 h-12 text-red-400" />,
            color: "bg-red-500/20"
        },
        {
            title: "Focus Timer",
            description: "Use the Pomodoro timer to work in bursts. Stay focused, take breaks, repeat.",
            icon: <Clock className="w-12 h-12 text-blue-400" />,
            color: "bg-blue-500/20"
        },
        {
            title: "AI Coach",
            description: "Chat with your personal AI coach for motivation, advice, and to analyze your habits.",
            icon: <Sparkles className="w-12 h-12 text-yellow-400" />,
            color: "bg-yellow-500/20"
        }
    ];

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            onStepChange(currentStep + 1);
        } else {
            onComplete();
        }
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-6 pointer-events-auto">
            <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-800">
                    <motion.div
                        className="h-full bg-purple-600"
                        initial={{ width: "0%" }}
                        animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>

                <div className="p-8 flex flex-col items-center text-center space-y-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col items-center space-y-6"
                        >
                            <div className={`w-24 h-24 rounded-full ${steps[currentStep].color} flex items-center justify-center mb-2`}>
                                {steps[currentStep].icon}
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-white">{steps[currentStep].title}</h2>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    {steps[currentStep].description}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    <Button
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white mt-4"
                        onClick={handleNext}
                    >
                        {currentStep === steps.length - 1 ? (
                            <>
                                Get Started <Check className="w-4 h-4 ml-2" />
                            </>
                        ) : (
                            <>
                                Next <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
