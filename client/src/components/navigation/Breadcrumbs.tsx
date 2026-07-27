import React from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  [key: string]: any; // Allow any additional props that might be passed down
}

export function Breadcrumbs({ items, ...otherProps }: BreadcrumbsProps) {
  const [location] = useLocation();

  // Auto-generate breadcrumbs from URL if items not provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      { label: "Dashboard", href: "/dashboard" }
    ];

    let currentPath = "";
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Convert path segment to readable label
      let label = segment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Special cases for common paths
      const labelMap: Record<string, string> = {
        'offers': 'Offers',
        'negotiations': 'Negotiations',
        'contracts': 'Contracts',
        'payments': 'Payments',
        'logistics': 'Logistics',
        'shipments': 'Shipments',
        'partners': 'Partners',
        'orders': 'Orders',
        'analytics': 'Analytics',
        'settings': 'Settings',
        'support': 'Support',
        'verification': 'Verification',
        'new': 'Create New',
        'show': 'Details',
        'wallet': 'Wallet',
        'partner': 'Partner',
        'admin': 'Admin',
        'compliance': 'Compliance',
        'audit-log': 'Audit Log',
        'reports': 'Reports',
        'review-queue': 'Review Queue',
        'requests': 'Requests',
        'billing': 'Billing'
      };

      label = labelMap[segment] || label;

      // For ID-like segments (numbers or UUIDs), format them
      if (/^[0-9]+$/.test(segment) || /^[a-f0-9-]{36}$/.test(segment)) {
        label = `#${segment.slice(0, 8)}${segment.length > 8 ? '...' : ''}`;
      }

      // Don't add href for last item (current page)
      const href = index === pathSegments.length - 1 ? undefined : currentPath;
      
      breadcrumbs.push({ label, href });
    });

    return breadcrumbs;
  };

  const breadcrumbItems = items || generateBreadcrumbs();

  // Don't show breadcrumbs for simple paths
  if (breadcrumbItems.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-1 text-sm text-neutral-600 mb-6">
      <Home className="w-4 h-4" />
      <ChevronRight className="w-4 h-4" />
      
      {breadcrumbItems.map((item, index) => (
        <span key={index} className="flex items-center">
          {index > 0 && <ChevronRight className="w-4 h-4" />}
          
          {item.href ? (
            <Link 
              href={item.href}
              className="hover:text-neutral-900 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-neutral-900 font-medium">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}