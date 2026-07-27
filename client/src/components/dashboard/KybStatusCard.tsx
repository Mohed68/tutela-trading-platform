import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface KybStatusCardProps {
  onContinueVerification: () => void;
}

type VerificationStatus = "not_started" | "in_progress" | "pending" | "verified" | "rejected";

function getInitialVerificationStatus(): VerificationStatus {
  return "not_started";
}

export default function KybStatusCard({ onContinueVerification }: KybStatusCardProps) {
  // In a real app, this would come from the user's verification status
  const verificationStatus = getInitialVerificationStatus();
  
  const getStatusConfig = () => {
    switch (verificationStatus) {
      case "verified":
        return {
          icon: CheckCircle,
          iconColor: "text-green-500",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          status: "Verified",
          statusVariant: "default" as const,
          statusBg: "bg-green-100 text-green-800",
          description: "Your business is fully verified",
          action: null
        };
      case "pending":
        return {
          icon: Clock,
          iconColor: "text-amber-500",
          bgColor: "bg-amber-50",
          borderColor: "border-amber-200",
          status: "Pending Review",
          statusVariant: "secondary" as const,
          statusBg: "bg-amber-100 text-amber-800",
          description: "Documents under review",
          action: null
        };
      case "in_progress":
        return {
          icon: AlertTriangle,
          iconColor: "text-blue-500",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
          status: "In Progress",
          statusVariant: "secondary" as const,
          statusBg: "bg-blue-100 text-blue-800",
          description: "Complete your verification",
          action: { label: "Continue Verification", handler: onContinueVerification }
        };
      case "rejected":
        return {
          icon: AlertTriangle,
          iconColor: "text-red-500",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          status: "Needs Attention",
          statusVariant: "destructive" as const,
          statusBg: "bg-red-100 text-red-800",
          description: "Please resubmit documents",
          action: { label: "Restart Verification", handler: onContinueVerification }
        };
      default: // "not_started"
        return {
          icon: Shield,
          iconColor: "text-gray-500",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
          status: "Not Started",
          statusVariant: "outline" as const,
          statusBg: "bg-gray-100 text-gray-800",
          description: "Start KYB verification process",
          action: { label: "Start Verification", handler: onContinueVerification }
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Card className={`tutela-metric-card ${config.borderColor} ${config.bgColor}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">KYB Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div className="flex-1">
            <Badge className={config.statusBg}>
              {config.status}
            </Badge>
          </div>
        </div>
        
        <p className="text-xs text-gray-600">{config.description}</p>
        
        {config.action && (
          <Button
            size="sm"
            onClick={config.action.handler}
            className="w-full text-xs h-8"
            variant={verificationStatus === "not_started" ? "default" : "outline"}
          >
            {config.action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
