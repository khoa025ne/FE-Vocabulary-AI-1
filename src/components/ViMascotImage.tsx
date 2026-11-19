import React from 'react';
import { useDocumentVisibility, useReducedMotion } from '@mantine/hooks';
import { VI_MASCOT_POSES, type ViPoseId } from '../constants/mascot';
import { BlurUpImage } from './states/BlurUpImage';

interface ViMascotImageProps {
  pose: ViPoseId;
  /** Width in CSS px; height automatically preserves 3:4 aspect ratio (384x512). */
  size?: number;
  width?: number;
  height?: number;
  alt?: string;
  /** Only applies to 'celebrate' and 'listen' micro-moments; disabled under reduced motion / hidden tab. */
  animated?: boolean;
  /** Use clean transparent-background cutout asset so Vi melts directly into the scene. */
  transparent?: boolean;
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
  transparent = false,
  priority = false,
  framed = true,
  className = '',
  style,
}: ViMascotImageProps) {
  const asset = VI_MASCOT_POSES[pose];
  const w = width ?? size;
  const h = height ?? Math.round((w * asset.height) / asset.width);

  const reducedMotion = useReducedMotion();
  const visibility = useDocumentVisibility();
  const canAnimate = Boolean(animated && asset.animatedFile && !reducedMotion && visibility === 'visible');

  const src =
    transparent && asset.transparentFile
      ? asset.transparentFile
      : canAnimate && asset.animatedFile
      ? asset.animatedFile
      : asset.file;

  if (transparent || !framed) {
    return (
      <BlurUpImage
        src={src}
        alt={alt || asset.alt}
        width={w}
        height={h}
        priority={priority}
        transparent={transparent}
        borderRadius={transparent ? 0 : 'var(--r-md, 20px)'}
        className={`vi-mascot-img ${className}`.trim()}
        style={{
          filter: transparent ? 'drop-shadow(0 12px 22px rgba(10, 28, 18, 0.34))' : undefined,
          ...style,
        }}
      />
    );
  }

  const innerW = Math.max(24, w - 6);
  const innerH = Math.max(24, h - 6);

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
      <BlurUpImage
        src={src}
        alt={alt || asset.alt}
        width={innerW}
        height={innerH}
        priority={priority}
        borderRadius="calc(var(--r-md, 20px) - 3px)"
        imgClassName="vi-mascot-cover"
      />
    </span>
  );
}
