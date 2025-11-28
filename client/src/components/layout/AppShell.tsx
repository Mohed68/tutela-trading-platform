import { useAuth } from "@/hooks/useAuth";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Package, 
  FileText, 
  Users, 
  Shield, 
  Settings, 
import {
  BarChart3,
  Package,
  FileText,
  Users,
  Shield,
  Bell,
  ChevronDown,
  LogOut
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { NavLink, useLocation } from "react-router-dom";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/hooks/useAuth";
import TutelaLogo from "@/components/common/TutelaLogo";

interface AppShellProps {
  children: React.ReactNode;
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const { pathname } = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: BarChart3, current: location === "/" },
    { name: "Commodities", href: "/commodities", icon: Package, current: location === "/commodities" },
    { name: "Contracts", href: "/contracts", icon: FileText, current: location === "/contracts" },
    { name: "Partners", href: "/partners", icon: Users, current: location === "/partners" },
    { name: "Verification", href: "/verification", icon: Shield, current: location === "/verification" },
    { name: "Analytics", href: "/analytics", icon: BarChart3, current: location === "/analytics" },
    { name: "Settings", href: "/settings", icon: Settings, current: location === "/settings" },
    { name: "Dashboard", href: ROUTES.dashboard, icon: BarChart3 },
    { name: "Marketplace", href: ROUTES.marketplace, icon: Package },
    { name: "Contracts", href: ROUTES.contracts, icon: FileText },
    { name: "Partners", href: ROUTES.partners, icon: Users },
    { name: "Verification", href: ROUTES.verification, icon: Shield },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--tutela-gray-50)' }}>
      {/* Navigation Header */}
      <nav className="bg-white border-b fixed w-full top-0 z-50 shadow-sm" style={{ borderColor: 'var(--tutela-gray-200)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <TutelaLogo size="md" showText={true} />
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Bell className="text-gray-400 text-lg h-5 w-5" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  3
                </span>
@@ -72,46 +70,49 @@ export default function AppShell({ children }: AppShellProps) {
                <span className="text-sm font-medium text-gray-700">
                  {(user as any)?.firstName} {(user as any)?.lastName}
                </span>
                <ChevronDown className="text-gray-400 text-sm h-4 w-4" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = "/api/logout"}
                className="text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex pt-16">
        {/* Sidebar Navigation */}
        <aside className="tutela-sidebar fixed h-full overflow-y-auto">
          <nav className="mt-5 px-2">
            <div className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <a className={`tutela-nav-item ${item.current ? 'active' : ''}`}>
                      <Icon className="mr-3 text-sm h-5 w-5" />
                      {item.name}
                    </a>
                  </Link>
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={`tutela-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon className="mr-3 text-sm h-5 w-5" />
                    {item.name}
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64">
          {children}
        </main>
      </div>
    </div>
  );
}
