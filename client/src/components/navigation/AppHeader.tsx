import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Bell, 
  HelpCircle, 
  User, 
  Settings, 
  LogOut,
  Menu,
  X,
  Home
} from "lucide-react";
import { useTypingFreeze } from "@/hooks/useTypingFreeze";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAuth } from "@/lib/session";
import { isDemo, disableDemo } from "@/lib/demo";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { authenticatedIdentityPresentation } from "@/features/auth/authenticatedIdentity";

interface AppHeaderProps {
  onMenuToggle: () => void;
  isMenuOpen: boolean;
}

export function AppHeader({ onMenuToggle, isMenuOpen }: AppHeaderProps) {
  const [, setLocation] = useLocation();
  const { verified } = getAuth();
  const { user } = useAuth();
  const demoMode = isDemo();
  const freezeAnimations = useTypingFreeze();
  const identity = authenticatedIdentityPresentation(user);

  const handleLogout = async () => {
    if (demoMode) {
      disableDemo();
      setLocation("/");
    } else {
      await apiRequest("POST", "/api/auth/logout");
      queryClient.setQueryData(["/api/auth/user"], null);
      setLocation("/home");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-neutral-200">
      <div className="flex items-center justify-between px-4 h-16">
        {/* Left side - Menu toggle and Logo */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuToggle}
            className="lg:hidden"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          
          <Link href="/dashboard" className="flex items-center space-x-3 transition-opacity duration-200 hover:opacity-80">
            <img 
              src="/tutela-logo.png" 
              alt="TUTELA Logo" 
              className="w-7 h-7 object-contain"
            />
            <span className="font-bold text-neutral-900 hidden sm:block tracking-tight">TUTELA</span>
          </Link>
        </div>

        {/* Center - Search */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <Input
              placeholder="Search offers, contracts, partners..."
              className="pl-10 bg-neutral-50 border-neutral-200"
              onChange={(e) => {
                freezeAnimations();
                // Handle search logic here
              }}
            />
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-3">
          {/* Verification Status */}
          {!verified && (
            <Button 
              size="sm" 
              variant="outline"
              className="hidden sm:flex"
              asChild
            >
              <Link href="/verification">Complete Verification</Link>
            </Button>
          )}
          
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="w-5 h-5" />
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs"
                >
                  3
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="px-3 py-2 border-b">
                <p className="text-sm font-medium">Notifications</p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <DropdownMenuItem className="flex flex-col items-start p-3 hover:bg-gray-50">
                  <div className="flex items-center w-full">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">New offer received</p>
                      <p className="text-xs text-gray-500 mt-1">WTI Crude Oil - 50,000 barrels at $78.45</p>
                      <p className="text-xs text-gray-400 mt-1">2 hours ago</p>
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start p-3 hover:bg-gray-50">
                  <div className="flex items-center w-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3 flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">Contract signed</p>
                      <p className="text-xs text-gray-500 mt-1">Gold purchase agreement finalized</p>
                      <p className="text-xs text-gray-400 mt-1">5 hours ago</p>
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start p-3 hover:bg-gray-50">
                  <div className="flex items-center w-full">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3 flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">Verification pending</p>
                      <p className="text-xs text-gray-500 mt-1">Complete your KYB verification</p>
                      <p className="text-xs text-gray-400 mt-1">1 day ago</p>
                    </div>
                  </div>
                </DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/notifications" className="w-full text-center text-sm text-blue-600 py-2">
                  View all notifications
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Help */}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/support">
              <HelpCircle className="w-5 h-5" />
            </Link>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <User className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{identity.displayName}</p>
                <p className="text-xs text-neutral-500">{identity.email}</p>
                {verified && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    Verified
                  </Badge>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/support" className="w-full">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Support
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/home" className="w-full">
                  <Home className="w-4 h-4 mr-2" />
                  Homepage
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                {demoMode ? "Exit Demo" : "Sign Out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
