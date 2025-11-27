import { create } from 'zustand';

export type User = {
  id: number;
  email: string;
  nickname: string;
  role: 'user' | 'admin';
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (payload: { user: User; access: string; refresh: string }) => void;
  logout: () => void;
};

const storageKey = 'ai-card-auth';

const stored = (() => {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
})();

const useAuthStore = create<AuthState>((set) => ({
  user: stored?.user ?? null,
  accessToken: stored?.accessToken ?? null,
  refreshToken: stored?.refreshToken ?? null,
  login: ({ user, access, refresh }) => {
    set({ user, accessToken: access, refreshToken: refresh });
    localStorage.setItem(storageKey, JSON.stringify({ user, accessToken: access, refreshToken: refresh }));
  },
  logout: () => {
    set({ user: null, accessToken: null, refreshToken: null });
    localStorage.removeItem(storageKey);
  },
}));

export default useAuthStore;
