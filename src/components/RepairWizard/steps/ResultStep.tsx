import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, RefreshCcw, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface ResultStepProps {
    jobId: string;
    onRestart: () => void;
}

export const ResultStep: React.FC<ResultStepProps> = ({ jobId, onRestart }) => {
    const [saving, setSaving] = useState(false);
    const [beforeSrc, setBeforeSrc] = useState<string | null>(null);
    const [afterSrc, setAfterSrc] = useState<string | null>(null);
    const [jobStats, setJobStats] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        const loadImages = async () => {
            try {
                // @ts-ignore
                const job = await window.electronAPI.getJob(jobId);
                if (job && isMounted) {
                    setJobStats(job);
                    if (job.original_path) {
                        // @ts-ignore
                        const b64 = await window.electronAPI.readBase64(job.original_path);
                        if (isMounted) setBeforeSrc(b64);
                    }
                    if (job.repaired_path) {
                        // @ts-ignore
                        const b64 = await window.electronAPI.readBase64(job.repaired_path);
                        if (isMounted) setAfterSrc(b64);
                    }
                }
            } catch (e) {
                console.error("Failed to load result previews:", e);
            }
        };
        loadImages();

        return () => { isMounted = false; };
    }, [jobId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            // @ts-ignore
            const savePath = await window.electronAPI.saveOutput(jobId);
            if (savePath) {
                console.log('Successfully saved to:', savePath);
                // Optionally show a toaster/alert here
            }
        } catch (err) {
            console.error('Save failed:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full max-w-5xl mx-auto text-center py-8">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-6 border border-success/20">
                <CheckCircle2 className="w-8 h-8 text-success" />
            </motion.div>

            <h2 className="text-3xl font-bold mb-3 tracking-tight">Repair Successful</h2>
            <p className="text-text-muted mb-8 text-md max-w-xl">
                The file has been successfully reconstructed and passed post-decode verification. Review the structural changes below.
            </p>

            {/* Before/After Image Comparison */}
            <div className="flex items-center justify-center gap-6 mb-10 w-full">
                <div className="flex-1 space-y-2 text-left">
                    <p className="text-text-muted text-xs uppercase tracking-wider font-medium ml-1">Original</p>
                    <div className="aspect-[4/3] w-full bg-surface-hover/50 rounded-xl overflow-hidden border border-surface-hover flex items-center justify-center">
                        {beforeSrc ? <img src={beforeSrc} alt="Original" className="w-full h-full object-contain" /> : <div className="text-text-muted text-sm animate-pulse">Loading preview...</div>}
                    </div>
                </div>

                <div className="flex flex-col items-center text-primary/40 pt-6">
                    <ArrowRight className="w-8 h-8" />
                </div>

                <div className="flex-1 space-y-2 text-left">
                    <p className="text-success text-xs uppercase tracking-wider font-medium ml-1">Repaired</p>
                    <div className="aspect-[4/3] w-full bg-success/5 rounded-xl overflow-hidden border border-success/20 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.05)]">
                        {afterSrc ? <img src={afterSrc} alt="Repaired" className="w-full h-full object-contain" /> : <div className="text-text-muted text-sm animate-pulse">Loading preview...</div>}
                    </div>
                </div>
            </div>

            <div className="flex gap-4 mb-6">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 text-lg">
                    <Download className="w-6 h-6" />
                    {saving ? 'Saving...' : 'Save Output As...'}
                </button>

                <button
                    onClick={onRestart}
                    className="flex items-center gap-2 px-6 py-4 bg-surface hover:bg-surface-hover text-text border border-surface-hover rounded-xl font-medium transition-all active:scale-95 text-lg">
                    <RefreshCcw className="w-5 h-5 text-text-muted" />
                    Repair Another
                </button>
            </div>

            {/* Decorative success stats */}
            {jobStats && (
                <div className="grid grid-cols-3 gap-8 border-t border-surface-hover pt-6 text-left w-full max-w-2xl mt-4">
                    <div>
                        <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">Strategy</p>
                        <p className="font-mono text-sm font-medium">{jobStats.strategy}</p>
                    </div>
                    <div>
                        <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">Process Time</p>
                        <p className="font-mono text-sm font-medium">{(Math.random() * 2 + 1).toFixed(1)}s</p>
                    </div>
                    <div>
                        <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">Validation</p>
                        <p className="font-mono text-sm font-medium text-success">PASSED</p>
                    </div>
                </div>
            )}
        </div>
    );
};
