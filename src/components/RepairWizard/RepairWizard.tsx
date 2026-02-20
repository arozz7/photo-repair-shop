import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WizardProps {
    currentStep: number;
    steps: { id: string; title: string }[];
    children: React.ReactNode[];
}

export const RepairWizard: React.FC<WizardProps> = ({ currentStep, steps, children }) => {
    return (
        <div className="flex flex-col h-screen w-full bg-background text-text">

            {/* Header/Stepper */}
            <header className="flex items-center justify-between p-6 border-b border-surface-hover bg-surface z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold shadow-lg shadow-primary/20">
                        PR
                    </div>
                    <h1 className="text-xl font-semibold tracking-tight">Photo Repair <span className="text-text-muted font-normal">Shop</span></h1>
                </div>

                <nav className="flex items-center gap-2">
                    {steps.map((step, idx) => (
                        <React.Fragment key={step.id}>
                            <div className={`flex flex-col items-center gap-1 transition-colors ${idx === currentStep ? 'text-primary' : idx < currentStep ? 'text-success' : 'text-text-muted'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 
                  ${idx === currentStep ? 'border-primary bg-primary/10' :
                                        idx < currentStep ? 'border-success bg-success/10' : 'border-surface-hover bg-surface'}`}>
                                    {idx < currentStep ? '✓' : idx + 1}
                                </div>
                                <span className="text-xs font-medium">{step.title}</span>
                            </div>
                            {idx < steps.length - 1 && (
                                <div className={`w-12 h-1 rounded-full mb-4 ${idx < currentStep ? 'bg-success/50' : 'bg-surface-hover'}`} />
                            )}
                        </React.Fragment>
                    ))}
                </nav>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 relative overflow-hidden bg-background">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 p-8 overflow-y-auto"
                    >
                        {children[currentStep]}
                    </motion.div>
                </AnimatePresence>
            </main>

        </div>
    );
};
