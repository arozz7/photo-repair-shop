import React, { useState, useRef, useEffect } from 'react';

interface BeforeAfterImageProps {
    beforeSrc: string;
    afterSrc: string;
    beforeLabel?: string;
    afterLabel?: string;
}

export const BeforeAfterImage: React.FC<BeforeAfterImageProps> = ({
    beforeSrc,
    afterSrc,
    beforeLabel = 'Corrupted',
    afterLabel = 'Repaired'
}) => {
    const [sliderPos, setSliderPos] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleMove = (clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        setSliderPos((x / rect.width) * 100);
    };

    const handleMouseUp = () => setIsDragging(false);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('mousemove', (e) => handleMove(e.clientX));
        }
        return () => {
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('mousemove', (e) => handleMove(e.clientX));
        };
    }, [isDragging]);

    return (
        <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-xl cursor-ew-resize bg-surface border border-surface-hover aspect-video select-none"
            onMouseDown={(e) => {
                setIsDragging(true);
                handleMove(e.clientX);
            }}
            onTouchStart={(e) => {
                setIsDragging(true);
                handleMove(e.touches[0].clientX);
            }}
            onTouchMove={(e) => {
                if (isDragging) handleMove(e.touches[0].clientX);
            }}
            onTouchEnd={() => setIsDragging(false)}
        >
            {/* After Image (Background) */}
            <img
                src={afterSrc}
                alt={afterLabel}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />

            {/* Before Image (Foreground, clipped) */}
            <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
            >
                <img
                    src={beforeSrc}
                    alt={beforeLabel}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            </div>

            {/* Labels */}
            <div className="absolute top-4 left-4 bg-background/80 backdrop-blur text-white text-xs font-semibold px-3 py-1 rounded shadow-lg pointer-events-none z-10 transition-opacity" style={{ opacity: sliderPos > 20 ? 1 : 0 }}>
                {beforeLabel}
            </div>
            <div className="absolute top-4 right-4 bg-primary/80 backdrop-blur text-white text-xs font-semibold px-3 py-1 rounded shadow-lg pointer-events-none z-10 transition-opacity" style={{ opacity: sliderPos < 80 ? 1 : 0 }}>
                {afterLabel}
            </div>

            {/* Slider Handle */}
            <div
                className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize flex items-center justify-center shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20 transition-transform active:scale-x-150"
                style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
            >
                <div className="w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-none">
                    <div className="flex gap-1">
                        <div className="w-1 h-3 bg-surface rounded-full" />
                        <div className="w-1 h-3 bg-surface rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
};
