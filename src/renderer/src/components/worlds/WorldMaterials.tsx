import type { ReactNode, CSSProperties } from 'react';

/** These primitives own only material and geometry, never application state. */
export function HangingSign({children, className = ''}: {children: ReactNode; className?: string}) {
  return <div className={`worlds-hanging-sign ${className}`}>{children}</div>;
}
export function WoodFrame({children, className = '', style}: {children: ReactNode; className?: string; style?: CSSProperties}) {
  return <section className={`worlds-wood-frame ${className}`} style={style}>{children}</section>;
}
export function LedgerBook({children, className = '', style}: {children: ReactNode; className?: string; style?: CSSProperties}) {
  return <section className={`worlds-ledger-book ${className}`} style={style}>{children}</section>;
}
export function ParchmentSurface({children, className = ''}: {children: ReactNode; className?: string}) {
  return <section className={`worlds-parchment-surface ${className}`}>{children}</section>;
}
/** Original vector ornament. No hitbox and no meaning beyond framing the scene. */
export function VineCorner({flipped = false}: {flipped?: boolean}) {
  return <svg className={`worlds-vine ${flipped ? 'worlds-vine--flipped' : ''}`} aria-hidden="true" viewBox="0 0 110 115">
    <path d="M3 106C31 93 6 71 25 55S41 38 37 5M10 36C42 28 52 13 104 4" fill="none" stroke="#3c4c22" strokeWidth="5"/>
    {[[8,85],[23,65],[15,42],[34,24],[51,15],[74,7],[92,10],[30,91]].map(([x,y],i)=><path key={i} d={`M${x} ${y}q-13 -16 7 -18q10 16 -7 18`} fill={i%2 ? '#668237' : '#435f2c'} stroke="#263d21" strokeWidth="1"/>)}
  </svg>;
}
