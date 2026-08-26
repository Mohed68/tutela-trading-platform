import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function Header() {
  const [location] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const scrollToSection = (sectionId: string) => {
    if (location !== "/") {
      window.location.href = `/#${sectionId}`;
      return;
    }
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
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
          </nav>

          {/* Language & CTA */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Language Switcher */}
            <div className="flex items-center space-x-1 text-sm text-neutral-500">
              <Globe className="w-4 h-4" />
              <span className="font-medium text-neutral-900">EN</span>
              <span>|</span>
              <span className="opacity-50">AR</span>
            </div>
            
            <Button variant="outline" asChild>
              <Link href="/demo/request">Try Demo</Link>
            </Button>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <Link href="/verification">Start Verification</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-neutral-200">
            <div className="flex flex-col space-y-3">
              <button 
                onClick={() => scrollToSection("product")}
                className="text-left text-neutral-600 hover:text-neutral-900"
              >
                Product
              </button>
              <Link href="/how-it-works" className="text-neutral-600 hover:text-neutral-900">
                How it Works
              </Link>
              <Link href="/pricing" className="text-neutral-600 hover:text-neutral-900">
                Pricing
              </Link>
              <Link href="/faq" className="text-neutral-600 hover:text-neutral-900">
                FAQ
              </Link>
              <div className="pt-3 space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/demo/request">Try Demo</Link>
                </Button>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" asChild>
                  <Link href="/verification">Start Verification</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
