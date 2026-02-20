import React, { useEffect, useState, useRef } from 'react';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';

interface ExecutionStepProps {
    config: any;
    onComplete: () => void;
}

export const ExecutionStep: React.FC<ExecutionStepProps> = ({ config, onComplete }) => {
    const [progress, setProgress] = useState(0);

    const [logStream, setLogStream] = useState<string[]>(['> Initiating core engine bridge...']);
    const executeInit = useRef(false);

    useEffect(() => {
        let isMounted = true;

        // @ts-ignore
        const unsubscribe = window.electronAPI.onRepairProgress((status) => {
            if (!isMounted) return;
            setProgress(status.percent || 0);

            if (status.stage) {
                setLogStream(prev => {
                    const maxLogs = 10;
                    const updated = [...prev, `> ${status.stage}`];
                    return updated.slice(-maxLogs);
                });
            }

            if (status.status === 'done' || status.status === 'failed') {
                if (status.status === 'failed' && status.error_message) {
                    setLogStream(prev => [...prev, `[ERROR] ${status.error_message}`]);
                }
                setTimeout(onComplete, 1000);
            }
        });

        if (!executeInit.current) {
            executeInit.current = true;
            // @ts-ignore
            window.electronAPI.executeRepair(config).catch(console.error);
        }

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [onComplete, config]);

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
                <div className="space-y-1 transform animate-slide-up text-left">
                    {logStream.map((log, idx) => (
                        <p key={idx} className={log.includes('[ERROR]') ? 'text-danger' : (log.includes('verified') ? 'text-success' : '')}>
                            {log}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
};
