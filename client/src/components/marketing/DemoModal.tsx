import React from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, Mail } from "lucide-react";

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
}

export function DemoModal({ open, onClose }: DemoModalProps) {
  const [, setLocation] = useLocation();
  const handleStartDemo = () => {
    onClose();
    setLocation("/demo/request");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Try Tutela
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Demo Option */}
          <div className="border border-neutral-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-lg">
                <Play className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900 mb-2">
                  Explore with Demo Data
                </h3>
                <p className="text-sm text-neutral-600 mb-4">
                  Request secure access to an isolated, non-binding commodity trade simulation.
                </p>

                <Button 
                  onClick={handleStartDemo}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  Start Interactive Demo
                </Button>
              </div>
            </div>
          </div>

          {/* Qualified access explanation */}
          <div className="border border-neutral-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900 mb-2">
                  Business email verification
                </h3>
                <p className="text-sm text-neutral-600 mb-4">
                  A one-time link verifies qualified access. No production trading account is created.
                </p>
                <Button variant="outline" className="w-full" onClick={handleStartDemo}>Request demo access</Button>
              </div>
            </div>
          </div>

        </div>

        <div className="text-center pt-4 border-t border-neutral-200">
          <p className="text-xs text-neutral-500">
            Demo data is temporary, isolated, simulated, and non-binding.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
