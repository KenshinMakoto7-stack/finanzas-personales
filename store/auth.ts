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

const CACHE_TTL_MS = 5 * 60 * 1000;

interface AuthState {
  user: User | null;
  loading: boolean;
  categories: CachedCategory[];
  categoriesLoaded: boolean;
  categoriesFetchedAt: number;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setCategories: (categories: CachedCategory[]) => void;
  clearCategories: () => void;
  isCategoriesStale: () => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  categories: [],
  categoriesLoaded: false,
  categoriesFetchedAt: 0,
  setUser: (user) => {
    if (!user)
      set({
        user,
        loading: false,
        categories: [],
        categoriesLoaded: false,
        categoriesFetchedAt: 0,
      });
    else set({ user, loading: false });
  },
  setLoading: (loading) => set({ loading }),
  setCategories: (categories) =>
    set({ categories, categoriesLoaded: true, categoriesFetchedAt: Date.now() }),
  clearCategories: () =>
    set({ categories: [], categoriesLoaded: false, categoriesFetchedAt: 0 }),
  isCategoriesStale: () => {
    const { categoriesLoaded, categoriesFetchedAt } = get();
    if (!categoriesLoaded) return true;
    return Date.now() - categoriesFetchedAt > CACHE_TTL_MS;
  },
}));
