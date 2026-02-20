import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';

interface ExecutionStepProps {
    config: any;
    onComplete: () => void;
}

export const ExecutionStep: React.FC<ExecutionStepProps> = ({ config, onComplete }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // Simulate real-time progress updates from an IPC backend hook
        const duration = 4000;
        const intervalTime = 50;
        const steps = duration / intervalTime;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            setProgress((currentStep / steps) * 100);

            if (currentStep >= steps) {
                clearInterval(timer);
                setTimeout(onComplete, 500); // Slight delay before moving purely for visual UX
            }
        }, intervalTime);

        return () => clearInterval(timer);
    }, [onComplete]);

    return (
        <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center space-y-8">
            <div className="relative">
                <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center relative z-10">
                    <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.6)]">
                        <Play className="w-8 h-8 ml-1" />
                    </div>
                </motion.div>

                {/* Pulsing Backglows */}
                <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-24 h-24 rounded-full bg-accent/20 absolute inset-0 z-0" />
            </div>

            <div>
                <h2 className="text-3xl font-bold mb-2 tracking-tight">Applying Strategy</h2>
                <p className="text-text-muted text-sm font-mono mb-6 uppercase tracking-widest">{config.strategy.replace('-', ' ')}</p>

                {/* Progress Bar Container */}
                <div className="w-80 h-3 bg-surface rounded-full overflow-hidden shadow-inner border border-surface-hover mx-auto">
                    <motion.div
                        className="h-full bg-gradient-to-r from-accent to-primary"
                        initial={{ width: '0%' }}
                        animate={{ width: `${progress}%` }}
                        transition={{ ease: "linear", duration: 0.05 }}
                    />
                </div>
                <p className="mt-3 text-text-muted text-sm font-medium">{Math.min(100, Math.round(progress))}% Completed</p>
            </div>

            <div className="bg-surface/50 border border-surface-hover rounded-xl p-4 w-full text-left text-xs font-mono text-text-muted/80 h-32 overflow-hidden relative">
                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent z-10" />
                <div className="space-y-1 transform -translate-y-[calc(100%-120px)] animate-slide-up">
                    <p>› Initiating core engine bridge...</p>
                    <p>› Loading strategy module: <span className="text-accent">{config.strategy}</span></p>
                    <p>› Exif requirements: {config.useReference ? 'STRICT' : 'LOOSE'}</p>
                    <p>› Parsing binary buffer headers...</p>
                    <p>› Extracting baseline structures...</p>
                    <p>› Aligning metadata tags (Offset 0x00A4)...</p>
                    <p>› Patching SOF0 bounds...</p>
                    <p>› Flushing bitstream to disk...</p>
                    <p className="text-success">› Operation verified.</p>
                </div>
            </div>
        </div>
    );
};
