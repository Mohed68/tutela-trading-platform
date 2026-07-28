import React from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/config/routes";
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  FileText,
  CreditCard,
  Truck,
  ShoppingCart,
  BarChart3,
  ShieldCheck,
  Settings,
  HelpCircle,
  Users,
  Building,
  FileCheck,
  UserCheck,
  ClipboardCheck,
  Globe
} from "lucide-react";
import { getAuth, type UserRole } from "@/lib/session";

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavigationItem {
  icon: React.ComponentType<any>;
  label: string;
  href: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const [location] = useLocation();
  const { verified, role } = getAuth();

  // Base navigation items for unverified users
  const unverifiedItems: NavigationItem[] = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      href: ROUTES.dashboard,
    },
    {
      icon: ShieldCheck,
      label: "Verification",
      href: ROUTES.verification,
      badge: "Required",
      badgeVariant: "destructive",
    },
    {
      icon: Globe,
      label: "Marketplace",
      href: ROUTES.marketplace,
    },
    {
      icon: Package,
      label: "My Drafts",
      href: "/my-offers",
      badge: "Personal",
      badgeVariant: "secondary",
    },
    {
      icon: HelpCircle,
      label: "Support",
      href: "/support",
    },
    {
      icon: Settings,
      label: "Settings",
      href: "/settings",
    },
  ];

  // Full navigation items for verified users
  const verifiedItems: NavigationItem[] = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      href: ROUTES.dashboard,
    },
    {
      icon: Globe,
      label: "Marketplace",
      href: ROUTES.marketplace,
    },
    {
      icon: Package,
      label: "My Drafts", 
      href: "/my-offers",
    },
    {
      icon: MessageSquare,
      label: "Negotiations",
      href: "/negotiations",
    },
    {
      icon: FileText,
      label: "Contracts",
      href: "/contracts",
    },
    {
      icon: CreditCard,
      label: "Payments",
      href: "/payments",
    },
    {
      icon: Truck,
      label: "Logistics",
      href: "/logistics",
    },
    {
      icon: ShoppingCart,
      label: "Orders",
      href: "/orders",
    },
    {
      icon: BarChart3,
      label: "Analytics",
      href: "/analytics",
    },
    {
      icon: HelpCircle,
      label: "Support",
      href: "/support",
    },
    {
      icon: Settings,
      label: "Settings",
      href: "/settings",
    },
  ];

  // Partner-specific items
  const partnerItems: NavigationItem[] = [
    {
      icon: UserCheck,
      label: "Partner Requests",
      href: "/partner/requests",
    },
    {
      icon: FileText,
      label: "Partner Contracts",
      href: "/partner/contracts",
    },
    {
      icon: CreditCard,
      label: "Partner Billing",
      href: "/partner/billing",
    },
  ];

  // Admin-specific items
  const adminItems: NavigationItem[] = [
    {
      icon: ClipboardCheck,
      label: "Review Queue",
      href: "/admin/review-queue",
    },
    {
      icon: FileCheck,
      label: "Audit Log",
      href: "/compliance/audit-log",
    },
    {
      icon: BarChart3,
      label: "Compliance Reports",
      href: "/compliance/reports",
    },
  ];

  // Determine which items to show
  let navigationItems = verified ? verifiedItems : unverifiedItems;

  // Add role-specific items for verified users
  if (verified) {
    if (role === "partner" || role === "admin") {
      navigationItems = [...navigationItems.slice(0, -2), ...partnerItems, ...navigationItems.slice(-2)];
    }
    if (role === "admin") {
      navigationItems = [...navigationItems.slice(0, -2), ...adminItems, ...navigationItems.slice(-2)];
    }
  }

  const isActiveRoute = (href: string) => {
    if (href === "/dashboard") {
      return location === "/" || location === "/dashboard";
    }
    return location.startsWith(href);
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden" 
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-16 left-0 z-40 w-64 h-[calc(100vh-4rem)] bg-white border-r border-neutral-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto py-4">
            <nav className="space-y-1 px-3">
              {navigationItems.map((item) => {
                const isActive = isActiveRoute(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-emerald-100 text-emerald-900"
                        : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                    )}
                    onClick={() => onClose()}
                  >
                    <item.icon className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0",
                      isActive ? "text-emerald-600" : "text-neutral-400 group-hover:text-neutral-500"
                    )} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <Badge 
                        variant={item.badgeVariant} 
                        className="ml-2 text-xs"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Verification Status Footer */}
          <div className="p-4 border-t border-neutral-200">
            <div className={cn(
              "flex items-center p-3 rounded-lg",
              verified ? "bg-emerald-50" : "bg-amber-50"
            )}>
              <ShieldCheck className={cn(
                "h-5 w-5 mr-2",
                verified ? "text-emerald-600" : "text-amber-600"
              )} />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {verified ? "Verified" : "Unverified"}
                </p>
                <p className="text-xs text-neutral-500">
                  {verified ? "Full access enabled" : "Complete verification"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
