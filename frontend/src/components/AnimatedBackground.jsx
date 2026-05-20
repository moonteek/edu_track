import React from 'react';

const PARTICLES = Array.from({ length: 10 }, (_, i) => ({
    left: `${(i * 10.3) % 100}%`,
    top: `${(i * 17.7) % 100}%`,
    width: `${2 + (i % 3)}px`,
    height: `${2 + (i % 3)}px`,
    opacity: 0.10 + (i % 5) * 0.04,
    animationDuration: `${8 + (i % 4) * 3}s`,
    animationDelay: `${(i % 5) * 1.6}s`,
}));

export default function AnimatedBackground() {
    return (
        <>
            <div className="lp-bg-particles" aria-hidden="true">
                {PARTICLES.map((p, i) => <div key={i} className="lp-particle" style={p} />)}
            </div>
            <div className="lp-blob lp-blob-1" aria-hidden="true" />
            <div className="lp-blob lp-blob-2" aria-hidden="true" />
            <div className="lp-blob lp-blob-3" aria-hidden="true" />
        </>
    );
}
