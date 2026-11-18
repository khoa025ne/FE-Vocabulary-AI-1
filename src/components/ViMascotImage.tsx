import { useEffect, useState } from 'react';
import { VI_MASCOT_POSES, type ViPoseId } from '../constants/mascot';

interface ViMascotImageProps {
  pose: ViPoseId;
  /** Width in CSS px; height automatically preserves 3:4 aspect ratio (384x512). */
  size?: number;
  width?: number;
  height?: number;
  alt?: string;
  /** Only applies to 'celebrate' and 'listen' micro-moments; disabled under reduced motion / hidden tab. */
  animated?: boolean;
  priority?: boolean;
  framed?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ViMascotImage({
  pose,
  size = 84,
  width,
  height,
  alt,
  animated = false,
  priority = false,
  framed = true,
  className = '',
  style,
}: ViMascotImageProps) {
  const asset = VI_MASCOT_POSES[pose];
  const w = width ?? size;
  const h = height ?? Math.round((w * asset.height) / asset.width);

  const [canAnimate, setCanAnimate] = useState(false);

  useEffect(() => {
    if (!animated || !asset.animatedFile || typeof window === 'undefined') {
      setCanAnimate(false);
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setCanAnimate(!mq.matches && !document.hidden);
    };
    sync();
    mq.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      mq.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [animated, asset.animatedFile]);

  const src = canAnimate && asset.animatedFile ? asset.animatedFile : asset.file;

  if (!framed) {
    return (
      <img
        src={src}
        alt={alt || asset.alt}
        width={w}
        height={h}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`vi-mascot-img ${className}`.trim()}
        style={{
          width: w,
          height: h,
          objectFit: 'cover',
          borderRadius: 'var(--r-md, 20px)',
          display: 'block',
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  return (
    <span
      className={`vi-mascot-frame ${className}`.trim()}
      style={{
        width: w,
        height: h,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--r-md, 20px)',
        padding: 3,
        background: 'linear-gradient(145deg, rgba(250, 248, 241, 0.92), rgba(212, 224, 204, 0.78))',
        border: '1px solid rgba(255, 255, 255, 0.92)',
        boxShadow: '0 10px 24px rgba(14, 38, 23, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      <img
        src={src}
        alt={alt || asset.alt}
        width={w - 6}
        height={h - 6}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 'calc(var(--r-md, 20px) - 3px)',
          display: 'block',
        }}
      />
    </span>
  );
}
