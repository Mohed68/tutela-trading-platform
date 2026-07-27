import React from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Play, Mail, Eye } from "lucide-react";
import { enableDemo } from "@/lib/demo";

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
}

export function DemoModal({ open, onClose }: DemoModalProps) {
  const [, setLocation] = useLocation();
  const [startAsVerified, setStartAsVerified] = React.useState<boolean>(true);

  const handleStartDemo = () => {
    onClose();
    enableDemo(startAsVerified ? "verified" : "pending");
    // enableDemo() will handle the navigation
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
                  Experience the full platform with realistic sample data and complete workflows.
                </p>
                
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="verified-start"
                    checked={startAsVerified}
                    onCheckedChange={(checked) => setStartAsVerified(checked === true)}
                  />
                  <Label htmlFor="verified-start" className="text-sm">
                    Start as Verified user (recommended)
                  </Label>
                </div>

                <Button 
                  onClick={handleStartDemo}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  Start Interactive Demo
                </Button>
              </div>
            </div>
          </div>

          {/* Live Demo Option */}
          <div className="border border-neutral-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900 mb-2">
                  Book a Live Demo
                </h3>
                <p className="text-sm text-neutral-600 mb-4">
                  Schedule a personalized walkthrough with our team to see how Tutela fits your needs.
                </p>
                <Button 
                  variant="outline"
                  className="w-full"
                  asChild
                >
                  <a href="mailto:demo@tutela.com?subject=Book%20a%20Live%20Demo">
                    Contact Sales Team
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* Video Walkthrough Option */}
          <div className="border border-neutral-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg">
                <Eye className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900 mb-2">
                  Watch 90-Second Walkthrough
                </h3>
                <p className="text-sm text-neutral-600 mb-4">
                  See the key features and workflow in a quick video overview.
                </p>
                <Button 
                  variant="outline"
                  className="w-full"
                  asChild
                >
                  <a href="#" target="_blank" rel="noopener noreferrer">
                    View Video Guide
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center pt-4 border-t border-neutral-200">
          <p className="text-xs text-neutral-500">
            Demo data is temporary and will be cleared when you exit demo mode.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}