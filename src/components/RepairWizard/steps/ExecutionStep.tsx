import React, { useEffect, useState, useRef } from 'react';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';

interface ExecutionStepProps {
    config: any;
    onComplete: (jobId: string) => void;
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
                    const maxLogs = 50;
                    const updated = [...prev, `> ${status.stage}`];
                    return updated.slice(-maxLogs);
                });
            }

            if (status.error_message) {
                setLogStream(prev => {
                    const maxLogs = 50;
                    const lines = status.error_message.split('\n').filter((l: string) => l.trim().length > 0);
                    const formatted = lines.map((l: string) => `[STDERR] ${l}`);
                    return [...prev, ...formatted].slice(-maxLogs);
                });
            }

            if (status.status === 'done' || status.status === 'failed') {
                setTimeout(() => onComplete(status.job_id), status.status === 'failed' ? 3000 : 1000);
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

            <div className="bg-surface/50 border border-surface-hover rounded-xl p-4 w-full text-left text-xs font-mono text-text-muted/80 h-48 overflow-y-auto flex flex-col">
                <div className="space-y-1 mt-auto">
                    {logStream.map((log, idx) => (
                        <p key={idx} className={log.includes('[STDERR]') || log.includes('[ERROR]') ? 'text-danger break-words' : (log.includes('verified') ? 'text-success' : '')}>
                            {log}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
};
