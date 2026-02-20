import React, { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface HexViewerProps {
    buffer: Uint8Array;
    markers?: { offset: number, label: string, color: 'danger' | 'success' | 'warning' }[];
    bytesPerRow?: number;
}

export const HexViewer: React.FC<HexViewerProps> = ({ buffer, markers = [], bytesPerRow = 16 }) => {
    const [page, setPage] = useState(0);
    const rowsPerPage = 20;
    const bytesPerPage = rowsPerPage * bytesPerRow;

    const totalPages = Math.ceil(buffer.length / bytesPerPage);

    const paginatedBuffer = useMemo(() => {
        const start = page * bytesPerPage;
        return buffer.slice(start, start + bytesPerPage);
    }, [buffer, page, bytesPerPage]);

    const rows = useMemo(() => {
        const r = [];
        for (let i = 0; i < paginatedBuffer.length; i += bytesPerRow) {
            r.push(paginatedBuffer.slice(i, i + bytesPerRow));
        }
        return r;
    }, [paginatedBuffer, bytesPerRow]);

    return (
        <div className="flex flex-col bg-surface border border-surfaceHover rounded-xl overflow-hidden font-mono text-xs shadow-inner">
            <div className="flex bg-surfaceHover/50 p-2 justify-between items-center text-textMuted border-b border-surfaceHover">
                <span>Offset (h)</span>
                <span>00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F</span>
                <span>Decoded Text</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {rows.map((row, rowIndex) => {
                    const absoluteOffset = (page * bytesPerPage) + (rowIndex * bytesPerRow);

                    return (
                        <div key={absoluteOffset} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 rounded transition-colors group">
                            {/* Offset Column */}
                            <span className="text-textMuted select-none w-16 group-hover:text-primary transition-colors">
                                {absoluteOffset.toString(16).padStart(8, '0').toUpperCase()}
                            </span>

                            {/* Hex Bytes Column */}
                            <div className="flex-1 flex gap-2">
                                {Array.from(row).map((byte, colIndex) => {
                                    const marker = markers.find(m => m.offset === absoluteOffset + colIndex);
                                    return (
                                        <span
                                            key={colIndex}
                                            title={marker?.label}
                                            className={twMerge(
                                                "w-5 text-center transition-colors cursor-crosshair",
                                                marker && clsx({
                                                    'bg-danger/20 text-danger font-bold': marker.color === 'danger',
                                                    'bg-success/20 text-success font-bold': marker.color === 'success',
                                                    'bg-warning/20 text-warning font-bold': marker.color === 'warning'
                                                }),
                                                byte === 0 && !marker ? "text-textMuted/30" : ""
                                            )}
                                        >
                                            {byte.toString(16).padStart(2, '0').toUpperCase()}
                                        </span>
                                    );
                                })}
                            </div>

                            {/* ASCII Decode Column */}
                            <span className="text-textMuted/70 tracking-widest w-40 overflow-hidden whitespace-pre">
                                {Array.from(row).map(byte => {
                                    // Printable ASCII range
                                    if (byte >= 32 && byte <= 126) return String.fromCharCode(byte);
                                    return '.';
                                }).join('')}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="bg-surface/80 p-3 border-t border-surfaceHover flex justify-between items-center text-textMuted">
                <button
                    disabled={page === 0}
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    className="px-3 py-1 bg-surfaceHover rounded hover:text-white disabled:opacity-50">
                    Prev
                </button>
                <span>Page {page + 1} of {totalPages} (Total: {(buffer.length / 1024).toFixed(2)} KB)</span>
                <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    className="px-3 py-1 bg-surfaceHover rounded hover:text-white disabled:opacity-50">
                    Next
                </button>
            </div>
        </div>
    );
};
