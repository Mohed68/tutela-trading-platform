import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Globe, Menu, X } from "lucide-react";

export function PublicHeader() {
  const [location, setLocation] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const scrollToSection = (sectionId: string) => {
    if (location !== "/") {
      setLocation("/");
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
      return;
    }
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleTryDemo = () => {
    setLocation("/demo/request");
  };

  const handleStartVerification = () => {
    setLocation("/verification");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 transition-opacity duration-200 hover:opacity-80">
            <img 
              src="/tutela-logo.png" 
              alt="TUTELA Logo" 
              className="w-8 h-8 object-contain"
            />
            <span className="text-xl font-bold text-neutral-900 tracking-tight">TUTELA</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <button 
              onClick={() => scrollToSection("product")}
              className="text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Product
            </button>
            <Link href="/how-it-works" className="text-neutral-600 hover:text-neutral-900 transition-colors">
              How it Works
            </Link>
            <Link href="/pricing" className="text-neutral-600 hover:text-neutral-900 transition-colors">
              Pricing
            </Link>
            <Link href="/faq" className="text-neutral-600 hover:text-neutral-900 transition-colors">
              FAQ
            </Link>
            <Button onClick={handleTryDemo} variant="outline" size="sm" className="text-neutral-600 border-neutral-300 hover:bg-neutral-50">
              Try Demo
            </Button>
            <Button onClick={() => window.location.href = "/api/login"} size="sm" className="bg-neutral-900 hover:bg-neutral-800 text-white">
              Sign In
            </Button>
          </nav>

          {/* IP Registration & Language - Mobile Hidden */}
          <div className="hidden lg:flex items-center space-x-4 text-xs text-neutral-500 mr-4">
            <span>IP Registered — UAE Ministry of Economy #1129-2024</span>
            <div className="flex items-center space-x-1">
              <Globe className="w-3 h-3" />
              <span className="font-medium text-neutral-900">EN</span>
              <span>|</span>
              <span className="opacity-50">AR</span>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-neutral-200">
            <div className="flex flex-col space-y-3">
              <button 
                onClick={() => {
                  scrollToSection("product");
                  setIsMenuOpen(false);
                }}
                className="text-left text-neutral-600 hover:text-neutral-900"
              >
                Product
              </button>
              <Link 
                href="/how-it-works" 
                className="text-neutral-600 hover:text-neutral-900"
                onClick={() => setIsMenuOpen(false)}
              >
                How it Works
              </Link>
              <Link 
                href="/pricing" 
                className="text-neutral-600 hover:text-neutral-900"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link 
                href="/faq" 
                className="text-neutral-600 hover:text-neutral-900"
                onClick={() => setIsMenuOpen(false)}
              >
                FAQ
              </Link>
              
              <div className="pt-3 space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full text-neutral-600 border-neutral-300"
                  onClick={() => {
                    handleTryDemo();
                    setIsMenuOpen(false);
                  }}
                >
                  Try Demo
                </Button>
                <Button 
                  className="w-full bg-neutral-900 hover:bg-neutral-800 text-white"
                  onClick={() => {
                    window.location.href = "/api/login";
                    setIsMenuOpen(false);
                  }}
                >
                  Sign In
                </Button>
              </div>

              <div className="pt-3 text-xs text-neutral-500 text-center">
                <div>IP Registered — UAE Ministry of Economy #1129-2024</div>
                <div className="flex items-center justify-center space-x-1 mt-1">
                  <Globe className="w-3 h-3" />
                  <span className="font-medium text-neutral-900">EN</span>
                  <span>|</span>
                  <span className="opacity-50">AR</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
