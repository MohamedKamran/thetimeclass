'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ProfileSchema, saveProfile, GenderOptions, type Gender } from '@/lib/profile';

export default function SetupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [university, setUniversity] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [major, setMajor] = useState('');
  const [interest, setInterest] = useState('');
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    const res = ProfileSchema.safeParse({
      name,
      age: Number(age),
      university,
      gender: gender || undefined,
      major,
      interest,
    });
    return res;
  }, [name, age, university, gender, major, interest]);

  function onContinue() {
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? 'Invalid profile';
      setError(first);
      return;
    }
    saveProfile(parsed.data);
    router.push('/chat');
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(1200px_circle_at_20%_0%,rgba(99,102,241,0.25),transparent_55%),radial-gradient(800px_circle_at_80%_20%,rgba(244,63,94,0.18),transparent_55%)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl items-center justify-center px-4 py-10">
        <Card className="w-full">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-xl font-semibold">Uni Connect</h1>
              <p className="mt-1 text-sm text-zinc-400">
                Omegle-style chat, but only for university students. No accounts,
                no database.
              </p>
            </div>
            <div className="rounded-xl bg-zinc-900 px-3 py-2 text-xs text-zinc-300 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
              Client-side profile
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-2">
                <span className="text-sm text-zinc-300">Name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Markie" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-zinc-300">Age</span>
                <Input
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g., 19"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm text-zinc-300">Gender</span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="h-10 w-full rounded-xl border-0 bg-zinc-900 px-3 text-sm text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset] outline-none transition-shadow focus:shadow-[0_0_0_2px_rgba(99,102,241,0.5)_inset]"
              >
                <option value="" disabled>Select gender</option>
                {GenderOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-zinc-300">University</span>
              <Input value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="e.g., Stanford" />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-zinc-300">Major</span>
              <Input value={major} onChange={(e) => setMajor(e.target.value)} placeholder="e.g., Computer Science" />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-zinc-300">Interest</span>
              <Input value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="e.g., AI, Music, Gaming" />
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200 shadow-[0_0_0_1px_rgba(244,63,94,0.22)_inset]">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              By continuing, you agree to keep it respectful.
            </p>
            <Button onClick={onContinue} disabled={!parsed.success}>
              Continue
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
