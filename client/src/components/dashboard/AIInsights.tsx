import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Lightbulb, Shield, AlertTriangle, TrendingUp, Plus } from "lucide-react";
import { useLocation } from "wouter";

export default function AIInsights() {
  const [, setLocation] = useLocation();
  
  // Mock AI insights - in production, these would come from an API
  const insights = [
    {
      type: "opportunity",
      icon: Lightbulb,
      title: "Market Opportunity",
      message: "Crude oil prices are trending upward. Consider adjusting your pricing strategy.",
      color: "blue",
    },
    {
      type: "verification",
      icon: Shield,
      title: "Verification Complete",
      message: "3 new partners have been verified and are ready for trading.",
      color: "green",
    },
    {
      type: "risk",
      icon: AlertTriangle,
      title: "Risk Alert",
      message: "2 contracts require additional documentation before proceeding.",
      color: "yellow",
    },
  ];

  const getInsightCardClass = (color: string) => {
    switch (color) {
      case "blue":
        return "tutela-insight-card info";
      case "green":
        return "tutela-insight-card success";
      case "yellow":
        return "tutela-insight-card warning";
      case "red":
        return "tutela-insight-card error";
      default:
        return "tutela-insight-card info";
    }
  };

  const getIconColor = (color: string) => {
    switch (color) {
      case "blue":
        return "text-blue-600";
      case "green":
        return "text-green-600";
      case "yellow":
        return "text-yellow-600";
      case "red":
        return "text-red-600";
      default:
        return "text-blue-600";
    }
  };

  const getTextColor = (color: string) => {
    switch (color) {
      case "blue":
        return "text-blue-900";
      case "green":
        return "text-green-900";
      case "yellow":
        return "text-yellow-900";
      case "red":
        return "text-red-900";
      default:
        return "text-blue-900";
    }
  };

  const getSubtextColor = (color: string) => {
    switch (color) {
      case "blue":
        return "text-blue-700";
      case "green":
        return "text-green-700";
      case "yellow":
        return "text-yellow-700";
      case "red":
        return "text-red-700";
      default:
        return "text-blue-700";
    }
  };

  return (
    <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
          <Bot className="mr-2 h-5 w-5 text-primary" />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <div key={index} className={getInsightCardClass(insight.color)}>
                <div className="flex items-start">
                  <Icon className={`${getIconColor(insight.color)} mt-1 mr-3 h-4 w-4`} />
                  <div className="flex-1">
                    <h4 className={`text-sm font-medium ${getTextColor(insight.color)}`}>
                      {insight.title}
                    </h4>
                    <p className={`text-sm ${getSubtextColor(insight.color)} mt-1`}>
                      {insight.message}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Quick Actions */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h4>
          <div className="space-y-3">
            <Button 
              className="w-full tutela-btn-primary"
              onClick={() => setLocation('/offers')}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Offer
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full tutela-btn-secondary"
              onClick={() => setLocation('/marketplace')}
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Browse Marketplace
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full tutela-btn-secondary"
              onClick={() => setLocation('/verification')}
            >
              <Shield className="mr-2 h-4 w-4" />
              Upload Documents
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full tutela-btn-secondary"
              onClick={() => setLocation('/analytics')}
            >
              <Bot className="mr-2 h-4 w-4" />
              View Analytics
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
