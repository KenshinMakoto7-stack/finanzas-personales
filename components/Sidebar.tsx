"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/store/auth";

const navItems = [
  { href: "/hoy", label: "Hoy", icon: "🏠" },
  { href: "/historial", label: "Historial", icon: "📋" },
  { href: "/resumen", label: "Resumen", icon: "📊" },
  { href: "/ajustes", label: "Ajustes", icon: "⚙️" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  async function handleLogout() {
    await signOut(getFirebaseAuth());
    router.replace("/login");
  }

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex-col z-50">
      {/* Brand */}
      <div className="px-6 py-7 border-b border-slate-100">
        <h1 className="text-2xl font-bold text-brand">Finanzas</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                active
                  ? "bg-brand-light text-brand"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-5 border-t border-slate-100 space-y-3">
        <div className="flex items-center gap-3 px-4">
          <div className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
            <span className="text-brand font-bold text-sm">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-slate-600 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-expense hover:bg-red-50 transition-colors"
        >
          <span className="text-base">🚪</span>
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
