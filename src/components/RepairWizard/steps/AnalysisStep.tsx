import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, CheckCircle2, Binary } from 'lucide-react';
import type { AnalysisResult } from '../../../../electron/services/FileAnalyzer';
import { motion } from 'framer-motion';
import { HexViewer } from '../../HexViewer/HexViewer';

interface AnalysisStepProps {
    filePath: string;
    onAnalysisComplete: (result: AnalysisResult) => void;
}

export const AnalysisStep: React.FC<AnalysisStepProps> = ({ filePath, onAnalysisComplete }) => {
    const [analyzing, setAnalyzing] = useState(true);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [viewMode, setViewMode] = useState<'diagnostics' | 'hex'>('diagnostics');

    // Stub data for hex view demonstration
    const stubBuffer = new Uint8Array([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
        0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0xFF, 0x9A, 0x42, 0x11, 0xFF, 0xD9, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    const stubMarkers = [
        { offset: 0, label: 'Start of Image (SOI)', color: 'success' as const },
        { offset: 1, label: 'Start of Image (SOI)', color: 'success' as const },
        { offset: 32, label: 'Invalid Marker (FF 9A)', color: 'danger' as const },
        { offset: 33, label: 'Invalid Marker (FF 9A)', color: 'danger' as const },
    ];

    useEffect(() => {
        // Simulate IPC call to backend to analyze the file
        const timer = setTimeout(() => {
            const mockResult: AnalysisResult = {
                jobId: 'sim_123',
                filePath,
                fileType: 'jpeg',
                fileSize: 4096000,
                isCorrupted: true,
                corruptionTypes: ['invalid_markers', 'missing_header'],
                metadata: null,
                embeddedPreviewAvailable: false,
                suggestedStrategies: [
                    {
                        strategy: 'header-grafting',
                        confidence: 'high',
                        requiresReference: true,
                        reason: 'Missing SOS Header blocks decoding entirely.'
                    },
                    {
                        strategy: 'marker-sanitization',
                        confidence: 'high',
                        requiresReference: false,
                        reason: 'Found invalid FF markers within bitstream.'
                    }
                ]
            };
            setResult(mockResult);
            setAnalyzing(false);
        }, 2500);

        return () => clearTimeout(timer);
    }, [filePath]);

    if (analyzing) {
        return (
            <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center space-y-6">
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-surface-hover border-t-primary rounded-full animate-spin"></div>
                    <Activity className="absolute inset-0 m-auto text-primary w-8 h-8" />
                </div>
                <h2 className="text-2xl font-semibold">Running Deep Scan...</h2>
                <p className="text-text-muted">Deconstructing structural headers, scanning entropy thresholds, and analyzing MCU shifts.</p>
            </div>
        );
    }

    if (!result) return null;

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="flex items-center justify-between gap-4 mb-8 pb-6 border-b border-surface-hover">
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-xl ${result.isCorrupted ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'} `}>
                        {result.isCorrupted ? <ShieldAlert className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold">{result.isCorrupted ? 'Corruption Detected' : 'File is Healthy'}</h2>
                        <p className="text-text-muted font-mono text-sm mt-1">{result.filePath}</p>
                    </div>
                </div>

                <div className="flex bg-surface p-1 rounded-lg border border-surface-hover">
                    <button
                        onClick={() => setViewMode('diagnostics')}
                        className={`px-4 py-2 rounded-md transition-colors ${viewMode === 'diagnostics' ? 'bg-surface-hover text-white font-medium' : 'text-text-muted hover:text-white'} `}>
                        Diagnostics
                    </button>
                    <button
                        onClick={() => setViewMode('hex')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${viewMode === 'hex' ? 'bg-primary/20 text-primary font-medium' : 'text-text-muted hover:text-primary'} `}>
                        <Binary className="w-4 h-4" /> Raw Hex
                    </button>
                </div>
            </div>

            {result.isCorrupted && viewMode === 'diagnostics' && (
                <div className="grid grid-cols-2 gap-8">
                    {/* Diagnostics Column */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-text-muted uppercase tracking-wider text-sm">Diagnostics</h3>
                        <ul className="space-y-3">
                            {result.corruptionTypes.map(c => (
                                <motion.li
                                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                    key={c} className="bg-surface p-4 rounded-lg border border-surface-hover shadow-sm flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-danger"></div>
                                    <span className="font-mono text-sm">{c.replace('_', ' ')}</span>
                                </motion.li>
                            ))}
                        </ul>
                    </div>

                    {/* Strategies Column */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-primary uppercase tracking-wider text-sm">Suggested Strategies</h3>
                        <div className="space-y-4">
                            {result.suggestedStrategies.map((s, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                                    key={s.strategy} className="bg-primary/5 border border-primary/20 p-5 rounded-xl hover:bg-primary/10 transition-colors cursor-default">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-primary">{s.strategy}</h4>
                                        <span className={`text-xs px-2 py-1 rounded-full ${s.confidence === 'high' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'} `}>
                                            {s.confidence} confidence
                                        </span>
                                    </div>
                                    <p className="text-sm text-text-muted">{s.reason}</p>
                                </motion.div>
                            ))}
                        </div>

                        <button
                            onClick={() => onAnalysisComplete(result)}
                            className="w-full mt-6 py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-all shadow-lg active:scale-95">
                            Configure Repair Workflow
                        </button>
                    </div>
                </div>
            )}

            {viewMode === 'hex' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-[600px] flex flex-col">
                    <div className="mb-4 text-sm text-text-muted">
                        Viewing snippet of parsed binary. Corrupt markers are highlighted in <span className="text-danger font-bold">red</span>.
                    </div>
                    <HexViewer buffer={stubBuffer} markers={stubMarkers} />
                </motion.div>
            )}
        </div>
    );
};
