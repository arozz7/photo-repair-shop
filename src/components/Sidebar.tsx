import React from 'react';
import { motion } from 'framer-motion';
import { Wrench, Settings, Clock } from 'lucide-react';

export type AppView = 'repair' | 'history' | 'settings';

interface SidebarProps {
    currentView: AppView;
    onViewChange: (view: AppView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
    const navItems = [
        { id: 'repair', label: 'Repair Wizard', icon: Wrench },
        { id: 'history', label: 'Job History', icon: Clock },
        { id: 'settings', label: 'Settings', icon: Settings }
    ] as const;

    return (
        <div className="w-64 h-screen bg-surface border-r border-surface-hover flex flex-col pt-8 pb-4 shrink-0">
            {/* App Branding */}
            <div className="flex items-center gap-3 px-6 mb-12">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-bold text-lg shadow-lg shadow-primary/20">
                    PR
                </div>
                <div>
                    <h1 className="text-lg font-semibold tracking-tight leading-tight">Photo Repair</h1>
                    <span className="text-text-muted text-sm font-normal">Shop</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-2">
                {navItems.map((item) => {
                    const isActive = currentView === item.id;
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onViewChange(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all relative ${isActive
                                    ? 'text-primary bg-primary/10'
                                    : 'text-text-muted hover:text-text hover:bg-surface-hover'
                                }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="active-nav-indicator"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
                                    initial={false}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                />
                            )}
                            <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-text-muted'}`} />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            <div className="px-6 text-xs text-text-muted/50 font-mono">
                v1.0.0
            </div>
        </div>
    );
};
