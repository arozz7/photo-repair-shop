import React from 'react';
import { UploadCloud, FileWarning } from 'lucide-react';

interface ImportStepProps {
    onFileSelect: (filepath: string) => void;
}

export const ImportStep: React.FC<ImportStepProps> = ({ onFileSelect }) => {
    // In a real electron app, we'd use window.electron.ipcRenderer to trigger a file dialog
    const handleSimulateSelect = () => {
        onFileSelect('/simulated/path/to/corrupt_image.jpg');
    };

    return (
        <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center">
            <div className="w-20 h-20 bg-surface rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-surface-hover">
                <FileWarning className="w-10 h-10 text-primary" />
            </div>

            <h2 className="text-3xl font-bold mb-3 tracking-tight">Import Corrupt Photo</h2>
            <p className="text-text-muted mb-10 max-w-md">
                Select a JPEG or RAW file that is suffering from structural corruption, missing headers, or bitstream degradation.
            </p>

            <button
                onClick={handleSimulateSelect}
                className="group relative flex items-center gap-3 px-8 py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95"
            >
                <UploadCloud className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                Browse Files
            </button>

            <div className="mt-12 p-4 rounded-xl border border-warning/20 bg-warning/5 text-sm text-warning/90 max-w-md flex gap-3 text-left">
                <span className="text-lg">💡</span>
                <p>
                    We currently support `.jpg`, `.jpeg`, `.cr2`, `.nef`, and `.arw` container formats.
                </p>
            </div>
        </div>
    );
};
