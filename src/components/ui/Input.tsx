import * as React from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...props }: Props) {
  return (
    <input
      className={[
        'h-11 w-full rounded-xl bg-zinc-900 px-3 text-sm text-zinc-50',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset] outline-none',
        'placeholder:text-zinc-500 focus:shadow-[0_0_0_1px_rgba(99,102,241,0.6)_inset]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
