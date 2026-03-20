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
    const [genericProfiles, setGenericProfiles] = useState<string[]>([]);

    const selectedStrategyObj = analysis.suggestedStrategies.find(s => s.strategy === selectedStrategy);
    const requiresReference = selectedStrategyObj?.requiresReference || false;

    useEffect(() => {
        // @ts-ignore
        if (window.electronAPI.getGenericProfiles) {
            // @ts-ignore
            window.electronAPI.getGenericProfiles().then(setGenericProfiles).catch(console.error);
        }
    }, []);

    useEffect(() => {
        if (requiresReference && !referencePath && analysis.filePath) {
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
    }, [requiresReference, referencePath, analysis.filePath]);

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
            case 'png-chunk-rebuilder': return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
            case 'heic-box-recovery': return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
            case 'tiff-ifd-rebuilder': return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
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

            {requiresReference && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-10 p-6 bg-surface rounded-xl border border-surface-hover">
                    <h3 className="text-lg font-medium mb-4">Donor Configuration</h3>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-text-muted mb-2">Select Valid Donor File</label>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                readOnly
                                value={referencePath}
                                placeholder={isSearchingDonor ? "Scanning Reference Library..." : "Select a healthy equivalent photo with matching dimensions..."}
                                className="flex-1 bg-background border border-surface-hover rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary text-ellipsis overflow-hidden whitespace-nowrap"
                            />
                            <button
                                onClick={handleSelectDonor}
                                disabled={isSearchingDonor}
                                className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors border border-primary/20 disabled:opacity-50 flex-shrink-0">
                                Browse
                            </button>
                        </div>
                        
                        {genericProfiles.length > 0 && selectedStrategy === 'header-grafting' && (
                            <div className="mt-4 pt-4 border-t border-surface-hover">
                                <label className="block text-sm font-medium text-text-muted mb-2">Or Use Built-in Generic Profile (Relaxed Mode)</label>
                                <select 
                                    className="w-full bg-background border border-surface-hover rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setReferencePath(e.target.value);
                                            setUseReference(false); // Suggest turning off strict check for generic profiles
                                        }
                                    }}
                                    value={genericProfiles.includes(referencePath) ? referencePath : ""}
                                >
                                    <option value="">-- Select a Generic Profile --</option>
                                    {genericProfiles.map(p => {
                                        const name = p.split(/[\\/]/).pop()?.replace('-profile.jpg', '').replace('.hdr', '') || p;
                                        // capitalize first letter and format
                                        const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
                                        return <option key={p} value={p}>{formattedName}</option>;
                                    })}
                                </select>
                            </div>
                        )}

                        {referencePath && !isSearchingDonor && (
                            <p className="mt-3 text-xs text-success flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Donor file loaded and ready.
                            </p>
                        )}
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer group bg-background p-3 rounded-lg border border-surface-hover">
                        <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${useReference ? 'bg-primary border-primary' : 'border-text-muted group-hover:border-primary'}`}>
                            {useReference && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={useReference} onChange={(e) => setUseReference(e.target.checked)} />
                        <div>
                            <p className="font-medium">Force strict Exif compatibility check</p>
                            <p className="text-xs text-text-muted mt-0.5">The Reference Manager will strictly enforce matching Camera Model and Orientation. Uncheck this for "Relaxed Mode" to force grafting any header (may cause color shifts).</p>
                        </div>
                    </label>
                </motion.div>
            )}

            <div className="flex justify-end pt-6 border-t border-surface-hover">
                <button
                    onClick={handleStart}
                    disabled={requiresReference && !referencePath}
                    className="disabled:opacity-50 disabled:cursor-not-allowed px-8 py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-all shadow-lg active:scale-95 flex items-center gap-2">
                    <Zap className="w-5 h-5" /> Execute Repair
                </button>
            </div>

        </div>
    );
};
