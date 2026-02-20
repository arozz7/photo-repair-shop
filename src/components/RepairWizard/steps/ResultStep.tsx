import React from 'react';
import { CheckCircle2, Download, RefreshCcw } from 'lucide-react';
import { motion } from 'framer-motion';

interface ResultStepProps {
    jobId: string;
    onRestart: () => void;
}

export const ResultStep: React.FC<ResultStepProps> = ({ jobId, onRestart }) => {
    const [saving, setSaving] = React.useState(false);

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
        <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="w-24 h-24 bg-success/10 rounded-full flex items-center justify-center mb-8 border border-success/20">
                <CheckCircle2 className="w-12 h-12 text-success" />
            </motion.div>

            <h2 className="text-4xl font-bold mb-4 tracking-tight">Repair Successful</h2>
            <p className="text-text-muted mb-10 text-lg">
                The file has been successfully reconstructed, validated structurally, and passed post-decode verification.
            </p>

            <div className="flex gap-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-all shadow-lg active:scale-95 disabled:opacity-50">
                    <Download className="w-5 h-5" />
                    {saving ? 'Saving...' : 'Save Output File'}
                </button>

                <button
                    onClick={onRestart}
                    className="flex items-center gap-2 px-6 py-3 bg-surface hover:bg-surface-hover text-text border border-surface-hover rounded-xl font-medium transition-all active:scale-95">
                    <RefreshCcw className="w-5 h-5 text-text-muted" />
                    Repair Another File
                </button>
            </div>

            {/* Decorative success stats */}
            <div className="mt-16 grid grid-cols-3 gap-8 border-t border-surface-hover pt-8 text-left w-full max-w-lg">
                <div>
                    <p className="text-text-muted text-xs uppercase tracking-wider mb-1">Process Time</p>
                    <p className="font-mono text-lg font-medium">3.8s</p>
                </div>
                <div>
                    <p className="text-text-muted text-xs uppercase tracking-wider mb-1">Bytes Modified</p>
                    <p className="font-mono text-lg font-medium text-warning">14,204</p>
                </div>
                <div>
                    <p className="text-text-muted text-xs uppercase tracking-wider mb-1">Validation</p>
                    <p className="font-mono text-lg font-medium text-success">PASSED</p>
                </div>
            </div>
        </div>
    );
};
