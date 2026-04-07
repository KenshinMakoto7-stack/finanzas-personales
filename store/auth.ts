"use client";

import { create } from "zustand";

interface User {
  uid: string;
  email: string;
}

export interface CachedCategory {
  id: string;
  name: string;
  type: string;
  color: string;
  parentId: string | null;
  children?: CachedCategory[];
}

interface AuthState {
  user: User | null;
  loading: boolean;
  categories: CachedCategory[];
  categoriesLoaded: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setCategories: (categories: CachedCategory[]) => void;
  clearCategories: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  categories: [],
  categoriesLoaded: false,
  setUser: (user) => {
    if (!user) set({ user, loading: false, categories: [], categoriesLoaded: false });
    else set({ user, loading: false });
  },
  setLoading: (loading) => set({ loading }),
  setCategories: (categories) => set({ categories, categoriesLoaded: true }),
  clearCategories: () => set({ categories: [], categoriesLoaded: false }),
}));
