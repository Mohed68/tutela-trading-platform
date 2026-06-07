import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Package,
  FileText,
  Users,
  Shield,
  Bell,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/hooks/useAuth";
import TutelaLogo from "@/components/common/TutelaLogo";

interface AppShellProps {
  children: ReactNode;
}

type AppShellUser = {
  name?: string | null;
  email?: string | null;
};

export default function AppShell({ children }: AppShellProps) {
  const { user, isLoading } = useAuth();
  const shellUser = user as AppShellUser | null | undefined;
  const { pathname } = useLocation();

  const navigation = [
    { name: "Dashboard", href: ROUTES.dashboard, icon: BarChart3 },
    { name: "Marketplace", href: ROUTES.marketplace, icon: Package },
    { name: "Commodities", href: ROUTES.commodities, icon: Package },
    { name: "Contracts", href: ROUTES.contracts, icon: FileText },
    { name: "Partners", href: ROUTES.partners, icon: Users },
    { name: "Verification", href: ROUTES.verification, icon: Shield },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--tutela-gray-50)" }}
    >
      {/* Top Navigation Bar */}
      <nav
        className="bg-white border-b fixed w-full top-0 z-50 shadow-sm"
        style={{ borderColor: "var(--tutela-gray-200)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
              <TutelaLogo size="md" showText />
            </div>

            {/* Right: Notifications + User */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium text-gray-900">
                    {shellUser?.name ?? "Guest User"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {shellUser?.email ?? ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main layout: sidebar + content */}
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
          {/* Sidebar navigation */}
          <aside className="w-56 hidden md:block">
            <nav className="space-y-1">
              {navigation.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");

                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        active ? "text-white" : "text-gray-400"
                      }`}
                    />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>
          </aside>

          {/* Page content */}
          <main className="flex-1">
            <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
