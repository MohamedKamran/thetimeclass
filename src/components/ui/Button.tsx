import * as React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

const variants: Record<NonNullable<Props['variant']>, string> = {
  primary:
    'bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset] focus:ring-indigo-400',
  secondary:
    'bg-zinc-800 hover:bg-zinc-700 text-zinc-50 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset] focus:ring-zinc-400',
  danger:
    'bg-rose-500 hover:bg-rose-400 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset] focus:ring-rose-400',
};

export default function Button({
  className,
  variant = 'primary',
  ...props
}: Props) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium outline-none transition',
        'focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
