import React from "react";
import { Link } from "wouter";
import { Globe } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="bg-neutral-900 text-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src="/tutela-logo.png" 
                alt="TUTELA Logo" 
                className="w-8 h-8 object-contain"
              />
              <span className="text-xl font-bold tracking-tight">TUTELA</span>
            </div>
            <p className="text-neutral-400 max-w-md mb-4">
              Trade strategic commodities with verified counterparties. 
              Fraud protection, secure contracts, and integrated payments.
            </p>
            <p className="text-xs text-neutral-500">
              IP Registered — UAE Ministry of Economy #1129-2024
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-neutral-400">
              <li>
                <Link href="/how-it-works" className="hover:text-neutral-200 transition-colors">
                  How it Works
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-neutral-200 transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <button 
                  onClick={() => {
                    const event = new CustomEvent('openDemoModal');
                    window.dispatchEvent(event);
                  }}
                  className="hover:text-neutral-200 transition-colors"
                >
                  Try Demo
                </button>
              </li>
              <li>
                <button 
                  onClick={() => window.location.href = "/api/login"}
                  className="hover:text-neutral-200 transition-colors"
                >
                  Get Started
                </button>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm text-neutral-400">
              <li>
                <Link href="/faq" className="hover:text-neutral-200 transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <a href="mailto:support@tutela.com" className="hover:text-neutral-200 transition-colors">
                  Contact Support
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-neutral-200 transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <Link href="/support" className="hover:text-neutral-200 transition-colors">
                  Help Center
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-neutral-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          {/* Legal */}
          <div className="flex space-x-6 text-sm text-neutral-400 mb-4 md:mb-0">
            <a href="#" className="hover:text-neutral-200 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-neutral-200 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-neutral-200 transition-colors">Legal</a>
            <a href="mailto:contact@tutela.com" className="hover:text-neutral-200 transition-colors">Contact</a>
          </div>

          {/* Language & Copyright */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-1 text-sm text-neutral-400">
              <Globe className="w-4 h-4" />
              <span className="font-medium text-neutral-200">EN</span>
              <span>|</span>
              <span className="opacity-50">AR</span>
            </div>
            <p className="text-sm text-neutral-400">
              © 2024 TUTELA. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}