import { z } from 'zod';

export const GenderOptions = ['Male', 'Female'] as const;
export type Gender = typeof GenderOptions[number];

export const ProfileSchema = z.object({
  name: z.string().min(2).max(40),
  age: z.number().int().min(16).max(120),
  university: z.string().min(2).max(80),
  gender: z.enum(GenderOptions),
  major: z.string().min(2).max(80),
  interest: z.string().min(2).max(100),
});

export type Profile = z.infer<typeof ProfileSchema>;

const STORAGE_KEY = 'uni_omegle_profile_v1';

export function loadProfile(): Profile | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const res = ProfileSchema.safeParse({
      ...parsed,
      age: typeof parsed?.age === 'string' ? Number(parsed.age) : parsed.age,
    });
    return res.success ? res.data : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function clearProfile() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
