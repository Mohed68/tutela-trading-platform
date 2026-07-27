import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  Target,
  ChevronRight,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";

interface PersonalizedRecommendation {
  id: string;
  type: "offer_match" | "market_opportunity" | "price_alert" | "strategy" | "partner";
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  cta?: string;
  ctaUrl?: string;
  metadata?: Record<string, any>;
  priority: "high" | "medium" | "low";
  category: string;
}

const typeIcons = {
  offer_match: Target,
  market_opportunity: TrendingUp,
  price_alert: AlertTriangle,
  strategy: Lightbulb,
  partner: Users,
};

const priorityColors = {
  high: "bg-red-50 border-red-200 text-red-800",
  medium: "bg-yellow-50 border-yellow-200 text-yellow-800", 
  low: "bg-blue-50 border-blue-200 text-blue-800",
};

const typeColors = {
  offer_match: "text-green-600",
  market_opportunity: "text-blue-600",
  price_alert: "text-orange-600",
  strategy: "text-purple-600",
  partner: "text-teal-600",
};

export default function AIRecommendations() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: recommendations = [], isLoading, error, refetch } = useQuery<PersonalizedRecommendation[]>({
    queryKey: ['/api/recommendations/personalized'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (gcTime replaces cacheTime in TanStack Query v5)
  });

  const handleRecommendationClick = (rec: PersonalizedRecommendation) => {
    if (rec.ctaUrl) {
      setLocation(rec.ctaUrl);
    }
    
    // Track recommendation interaction
    toast({
      title: "Recommendation Followed",
      description: `Following recommendation: ${rec.title}`,
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Recommendations Updated",
        description: "Your personalized recommendations have been refreshed.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Unable to refresh recommendations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return { text: "High Confidence", variant: "default" as const };
    if (confidence >= 0.6) return { text: "Medium Confidence", variant: "secondary" as const };
    return { text: "Low Confidence", variant: "outline" as const };
  };

  if (error) {
    return (
      <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <Sparkles className="mr-2 h-5 w-5 text-primary" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
            <p>Unable to load recommendations</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={handleRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <Sparkles className="mr-2 h-5 w-5 text-primary" />
            AI Recommendations
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
            data-testid="button-refresh-recommendations"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Lightbulb className="mx-auto h-8 w-8 mb-2" />
            <p>No recommendations available</p>
            <p className="text-sm">Check back later for personalized insights</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.slice(0, 4).map((rec: PersonalizedRecommendation) => {
              const Icon = typeIcons[rec.type];
              const confidenceBadge = getConfidenceBadge(rec.confidence);
              
              return (
                <div 
                  key={rec.id} 
                  className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${priorityColors[rec.priority]}`}
                  onClick={() => handleRecommendationClick(rec)}
                  data-testid={`recommendation-${rec.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center">
                      <Icon className={`h-4 w-4 mr-2 ${typeColors[rec.type]}`} />
                      <h4 className="font-medium text-sm">{rec.title}</h4>
                    </div>
                    <Badge 
                      variant={confidenceBadge.variant}
                      className="text-xs"
                    >
                      {confidenceBadge.text}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {rec.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {rec.category}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${rec.priority === 'high' ? 'border-red-300 text-red-700' : 
                          rec.priority === 'medium' ? 'border-yellow-300 text-yellow-700' : 
                          'border-blue-300 text-blue-700'}`}
                      >
                        {rec.priority} priority
                      </Badge>
                    </div>
                    
                    {rec.actionable && rec.cta && (
                      <div className="flex items-center text-xs text-primary font-medium">
                        {rec.cta}
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {recommendations.length > 4 && (
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => setLocation('/recommendations')}
                data-testid="button-view-all-recommendations"
              >
                View All {recommendations.length} Recommendations
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}