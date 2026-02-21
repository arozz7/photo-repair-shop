import React, { useEffect, useState } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import type { AppSettings } from '../../../electron/services/SettingsService';

export const Settings: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                // @ts-ignore
                const data = await window.electronAPI.getSettings();
                setSettings(data);
            } catch (e) {
                console.error("Failed to load settings:", e);
            }
        };
        loadSettings();
    }, []);

    const handleChange = (key: keyof AppSettings, value: any) => {
        setSettings(prev => prev ? { ...prev, [key]: value } : null);
        setSaved(false);
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            // @ts-ignore
            await window.electronAPI.updateSettings(settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            console.error("Failed to save settings:", e);
        } finally {
            setSaving(false);
        }
    };

    if (!settings) {
        return (
            <div className="flex-1 p-8 text-text bg-background flex items-center justify-center">
                <div className="animate-pulse flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-primary/40 animate-bounce"></div>
                    <div className="w-4 h-4 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-4 h-4 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 p-8 text-text bg-background overflow-auto">
            <div className="max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold tracking-tight">Preferences</h2>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 text-white flex-shrink-0 ${saved ? 'bg-success hover:bg-success/90' : 'bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20'
                            }`}>
                        <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
                        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

                <div className="space-y-6">
                    {/* General Settings */}
                    <div className="bg-surface border border-surface-hover rounded-xl overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-surface-hover bg-surface-hover/20">
                            <h3 className="font-medium text-text">Workflow Settings</h3>
                            <p className="text-sm text-text-muted mt-0.5">Configure default behavior for repair outputs.</p>
                        </div>
                        <div className="p-6 space-y-6">

                            <div className="flex items-start justify-between gap-8">
                                <div>
                                    <label className="block text-sm font-medium text-text">Auto-Enhance Colors</label>
                                    <p className="text-sm text-text-muted mt-1 leading-relaxed">
                                        Automatically run histogram normalization on repaired outputs to fix washed-out colors.
                                        This modifies the original color profile of the image.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={settings.autoEnhanceOutput}
                                        onChange={(e) => handleChange('autoEnhanceOutput', e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>

                            <div className="pt-6 border-t border-surface-hover">
                                <label className="block text-sm font-medium text-text mb-3">Default Output Destination</label>
                                <div className="space-y-3 pl-1">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input
                                            type="radio"
                                            name="outputStrategy"
                                            value="prompt"
                                            checked={settings.defaultOutputStrategy === 'prompt'}
                                            onChange={(e) => handleChange('defaultOutputStrategy', e.target.value)}
                                            className="w-4 h-4 text-primary bg-surface border-surface-hover focus:ring-primary focus:ring-offset-background"
                                        />
                                        <span className="text-sm text-text group-hover:text-primary transition-colors">Prompt before saving (Explicit Save)</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input
                                            type="radio"
                                            name="outputStrategy"
                                            value="original-folder"
                                            checked={settings.defaultOutputStrategy === 'original-folder'}
                                            onChange={(e) => handleChange('defaultOutputStrategy', e.target.value)}
                                            className="w-4 h-4 text-primary bg-surface border-surface-hover focus:ring-primary focus:ring-offset-background"
                                        />
                                        <span className="text-sm text-text group-hover:text-primary transition-colors">Save alongside original file</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Performance Settings */}
                    <div className="bg-surface border border-surface-hover rounded-xl overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-surface-hover bg-surface-hover/20">
                            <h3 className="font-medium text-text">Engine Performance</h3>
                            <p className="text-sm text-text-muted mt-0.5">Control how much CPU overhead is allocated to extraction.</p>
                        </div>
                        <div className="p-6 pb-8">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="concurrentJobsLimit" className="block text-sm font-medium text-text">Max Concurrent Extraction Threads</label>
                                    <span className="font-mono text-primary font-medium">{settings.concurrentJobsLimit} Threads</span>
                                </div>
                                <input
                                    type="range"
                                    id="concurrentJobsLimit"
                                    min="1"
                                    max="8"
                                    step="1"
                                    value={settings.concurrentJobsLimit}
                                    onChange={(e) => handleChange('concurrentJobsLimit', parseInt(e.target.value))}
                                    className="w-full h-2 bg-surface-hover rounded-lg appearance-none cursor-pointer accent-primary mt-2"
                                />
                                <div className="flex justify-between text-xs text-text-muted mt-1 px-1">
                                    <span>Lower (Slower)</span>
                                    <span>Higher (CPU Intensive)</span>
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3 p-4 bg-primary/10 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-primary flex-shrink-0" />
                                <p className="text-sm text-primary leading-relaxed">
                                    Note: Settings marked under 'Engine Performance' will require an application restart to fully apply to the ExifTool daemon process.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
