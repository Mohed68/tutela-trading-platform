import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Package, 
  FileText, 
  Users, 
  Shield, 
  Settings, 
  Bell,
  ChevronDown,
  LogOut
} from "lucide-react";
import { Link, useLocation } from "wouter";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: BarChart3, current: location === "/" },
    { name: "Commodities", href: "/commodities", icon: Package, current: location === "/commodities" },
    { name: "Contracts", href: "/contracts", icon: FileText, current: location === "/contracts" },
    { name: "Partners", href: "/partners", icon: Users, current: location === "/partners" },
    { name: "Verification", href: "/verification", icon: Shield, current: location === "/verification" },
    { name: "Analytics", href: "/analytics", icon: BarChart3, current: location === "/analytics" },
    { name: "Settings", href: "/settings", icon: Settings, current: location === "/settings" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white border-b border-gray-200 fixed w-full top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">T</span>
                </div>
                <span className="ml-3 text-xl font-bold text-gray-900">TUTELA</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Bell className="text-gray-400 text-lg h-5 w-5" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  3
                </span>
              </div>
              <div className="flex items-center space-x-3">
                {(user as any)?.profileImageUrl ? (
                  <img 
                    className="h-8 w-8 rounded-full object-cover" 
                    src={(user as any).profileImageUrl} 
                    alt="User Avatar"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {(user as any)?.firstName?.[0]}{(user as any)?.lastName?.[0]}
                    </span>
                  </div>
                )}
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
                return (
                  <Link key={item.name} href={item.href}>
                    <a className={`tutela-nav-item ${item.current ? 'active' : ''}`}>
                      <Icon className="mr-3 text-sm h-5 w-5" />
                      {item.name}
                    </a>
                  </Link>
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
