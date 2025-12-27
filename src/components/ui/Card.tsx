import * as React from 'react';

type Props = React.HTMLAttributes<HTMLDivElement>;

export default function Card({ className, ...props }: Props) {
  return (
    <div
      className={[
        'rounded-2xl bg-zinc-950/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]',
        'backdrop-blur',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
