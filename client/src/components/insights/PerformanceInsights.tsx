import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Target, 
  Lightbulb, 
  AlertTriangle,
  CheckCircle,
  Loader2,
  Zap,
  DollarSign,
  Users,
  Activity
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface InsightData {
  id: string;
  type: 'trend' | 'opportunity' | 'risk' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  category: string;
  actionable: boolean;
  metric?: {
    value: string | number;
    change?: number;
    unit?: string;
  };
}

interface PerformanceReport {
  id: string;
  generatedAt: string;
  summary: {
    totalTrades: number;
    totalVolume: string;
    successRate: number;
    riskScore: number;
  };
  insights: InsightData[];
  recommendations: string[];
  riskFactors: string[];
  opportunities: string[];
}

export default function PerformanceInsights() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: latestReport, isLoading } = useQuery<PerformanceReport>({
    queryKey: ["/api/insights/latest"],
    retry: false,
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      return await apiRequest("POST", "/api/insights/generate");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights/latest"] });
      toast({
        title: "Performance Insights Generated",
        description: "Your AI-powered insights are ready for review",
        variant: "default",
      });
      setIsGenerating(false);
    },
    onError: (error) => {
      console.error("Failed to generate insights:", error);
      toast({
        title: "Generation Failed",
        description: "Unable to generate insights. Please try again.",
        variant: "destructive",
      });
      setIsGenerating(false);
    },
  });

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend':
        return <TrendingUp className="h-4 w-4" />;
      case 'opportunity':
        return <Target className="h-4 w-4" />;
      case 'risk':
        return <AlertTriangle className="h-4 w-4" />;
      case 'recommendation':
        return <Lightbulb className="h-4 w-4" />;
      default:
        return <BarChart3 className="h-4 w-4" />;
    }
  };

  const getInsightColor = (type: string, impact: string) => {
    if (type === 'risk') return 'text-red-600 bg-red-50 border-red-200';
    if (type === 'opportunity') return 'text-green-600 bg-green-50 border-green-200';
    if (impact === 'high') return 'text-blue-600 bg-blue-50 border-blue-200';
    if (impact === 'medium') return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getImpactBadgeColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Performance Insights</h2>
          <p className="text-gray-600">AI-powered analysis of your trading performance and opportunities</p>
        </div>
        <Button 
          onClick={() => generateInsightsMutation.mutate()}
          disabled={isGenerating}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Generate Insights
            </>
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : latestReport ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Trades</p>
                    <p className="text-2xl font-bold">{latestReport.summary.totalTrades}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Volume</p>
                    <p className="text-2xl font-bold">{latestReport.summary.totalVolume}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold">{latestReport.summary.successRate}%</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Risk Score</p>
                    <p className="text-2xl font-bold">{latestReport.summary.riskScore}/100</p>
                  </div>
                  <AlertTriangle className={`h-8 w-8 ${latestReport.summary.riskScore > 70 ? 'text-red-600' : latestReport.summary.riskScore > 40 ? 'text-yellow-600' : 'text-green-600'}`} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="mr-2 h-5 w-5" />
                Key Insights
                <Badge variant="outline" className="ml-2">
                  Generated {formatDate(latestReport.generatedAt)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {latestReport.insights.map((insight: InsightData) => (
                  <div
                    key={insight.id}
                    className={`p-4 rounded-lg border ${getInsightColor(insight.type, insight.impact)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getInsightIcon(insight.type)}
                        <h4 className="font-medium">{insight.title}</h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getImpactBadgeColor(insight.impact)}>
                          {insight.impact} impact
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {Math.round(insight.confidence * 100)}% confidence
                        </span>
                      </div>
                    </div>
                    <p className="text-sm mb-2">{insight.description}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {insight.category}
                      </Badge>
                      {insight.metric && (
                        <div className="text-sm font-medium">
                          {insight.metric.value}
                          {insight.metric.unit}
                          {insight.metric.change && (
                            <span className={`ml-1 ${insight.metric.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {insight.metric.change > 0 ? '+' : ''}{insight.metric.change}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-green-700">
                  <Target className="mr-2 h-5 w-5" />
                  Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {latestReport.opportunities.map((opportunity: string, index: number) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{opportunity}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-amber-700">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Risk Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {latestReport.riskFactors.map((risk: string, index: number) => (
                    <li key={index} className="flex items-start space-x-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{risk}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Action Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-blue-700">
                <Lightbulb className="mr-2 h-5 w-5" />
                Recommended Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {latestReport.recommendations.map((rec: string, index: number) => (
                  <li key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <BarChart3 className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Insights Available</h3>
              <p className="text-gray-600 mb-4">
                Generate your first performance insights to get AI-powered analysis of your trading activity.
              </p>
              <Button 
                onClick={() => generateInsightsMutation.mutate()}
                disabled={isGenerating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Generate First Report
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
