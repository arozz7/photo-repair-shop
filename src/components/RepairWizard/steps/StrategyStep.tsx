import React, { useState, useEffect } from 'react';
import { Settings2, Zap, Shield, Database, CheckCircle2 } from 'lucide-react';
import type { AnalysisResult } from '../../../../electron/services/FileAnalyzer';
import { motion } from 'framer-motion';

interface StrategyStepProps {
    analysis: AnalysisResult;
    onExecute: (config: any) => void;
}

export const StrategyStep: React.FC<StrategyStepProps> = ({ analysis, onExecute }) => {
    const [selectedStrategy, setSelectedStrategy] = useState<string>(analysis.suggestedStrategies[0]?.strategy || 'header-grafting');
    const [useReference, setUseReference] = useState(true);
    const [referencePath, setReferencePath] = useState<string>('');
    const [isSearchingDonor, setIsSearchingDonor] = useState(false);

    useEffect(() => {
        if (selectedStrategy === 'header-grafting' && !referencePath && analysis.filePath) {
            setIsSearchingDonor(true);
            // @ts-ignore
            window.electronAPI.referenceAutoSearch(analysis.filePath)
                .then((matchedPath: string | null) => {
                    if (matchedPath) setReferencePath(matchedPath);
                    setIsSearchingDonor(false);
                })
                .catch((e: any) => {
                    console.error("Auto-search failed:", e);
                    setIsSearchingDonor(false);
                });
        }
    }, [selectedStrategy, analysis.filePath]);

    const handleStart = () => {
        onExecute({
            strategy: selectedStrategy,
            useReference,
            referencePath
        });
    };

    const handleSelectDonor = async () => {
        // @ts-ignore
        const path = await window.electronAPI.showOpenDialog();
        if (path) setReferencePath(path);
    };

    const getStrategyIcon = (name: string) => {
        switch (name) {
            case 'header-grafting': return <Database className="w-6 h-6" />;
            case 'marker-sanitization': return <Shield className="w-6 h-6" />;
            default: return <Zap className="w-6 h-6" />;
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-8">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-surface-hover">
                <div className="p-4 rounded-xl bg-accent/10 text-accent">
                    <Settings2 className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold">Configure Strategy</h2>
                    <p className="text-text-muted mt-1">Select and tune the repair approach based on heuristic recommendations.</p>
                </div>
            </div>

            <div className="space-y-6 mb-10">
                <h3 className="text-lg font-medium text-text-muted uppercase tracking-wider text-sm">Target Approach</h3>

                <div className="grid gap-4">
                    {analysis.suggestedStrategies.map((s, idx) => (
                        <motion.button
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                            key={s.strategy}
                            onClick={() => setSelectedStrategy(s.strategy)}
                            className={`flex items-start gap-4 p-6 rounded-xl border-2 text-left transition-all ${selectedStrategy === s.strategy
                                ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                                : 'border-surface-hover bg-surface hover:border-text-muted'
                                }`}
                        >
                            <div className={`mt-1 ${selectedStrategy === s.strategy ? 'text-primary' : 'text-text-muted'}`}>
                                {getStrategyIcon(s.strategy)}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className={`font-semibold text-lg ${selectedStrategy === s.strategy ? 'text-text' : 'text-text-muted'}`}>
                                        {s.strategy.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </h4>
                                    <span className={`text-xs px-2 py-1 rounded-full ${s.confidence === 'high' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                                        {s.confidence} Match
                                    </span>
                                </div>
                                <p className="text-text-muted text-sm leading-relaxed">{s.reason}</p>
                            </div>
                        </motion.button>
                    ))}
                </div>
            </div>

            {selectedStrategy === 'header-grafting' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-10 p-6 bg-surface rounded-xl border border-surface-hover">
                    <h3 className="text-lg font-medium mb-4">Donor Configuration</h3>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-text-muted mb-2">Select Valid Donor File</label>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                readOnly
                                value={referencePath}
                                placeholder={isSearchingDonor ? "Scanning Reference Library..." : "Select a healthy JPEG with matching dimensions..."}
                                className="flex-1 bg-background border border-surface-hover rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary"
                            />
                            <button
                                onClick={handleSelectDonor}
                                disabled={isSearchingDonor}
                                className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors border border-primary/20 disabled:opacity-50">
                                Browse
                            </button>
                        </div>
                        {referencePath && !isSearchingDonor && (
                            <p className="mt-2 text-xs text-success flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Donor file loaded and ready.
                            </p>
                        )}
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${useReference ? 'bg-primary border-primary' : 'border-text-muted group-hover:border-primary'}`}>
                            {useReference && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={useReference} onChange={(e) => setUseReference(e.target.checked)} />
                        <div>
                            <p className="font-medium">Force strict Exif compatibility check</p>
                            <p className="text-sm text-text-muted">The Reference Manager will strictly enforce matching Camera Model and Orientation tags before allowing a donor header.</p>
                        </div>
                    </label>
                </motion.div>
            )}

            <div className="flex justify-end pt-6 border-t border-surface-hover">
                <button
                    onClick={handleStart}
                    disabled={selectedStrategy === 'header-grafting' && !referencePath}
                    className="disabled:opacity-50 disabled:cursor-not-allowed px-8 py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-all shadow-lg active:scale-95 flex items-center gap-2">
                    <Zap className="w-5 h-5" /> Execute Repair
                </button>
            </div>

        </div>
    );
};
