import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, FileText, Clock, DollarSign } from "lucide-react";

interface MetricsCardsProps {
  metrics?: {
    activeOffers: number;
    pendingContracts: number;
    verificationQueue: number;
    totalVolume: string;
  };
  isLoading: boolean;
}

export default function MetricsCards({ metrics, isLoading }: MetricsCardsProps) {
  const formatVolume = (volume: string) => {
    const numValue = parseFloat(volume);
    if (numValue >= 1000000) {
      return `$${(numValue / 1000000).toFixed(1)}M`;
    } else if (numValue >= 1000) {
      return `$${(numValue / 1000).toFixed(1)}K`;
    } else {
      return `$${numValue.toFixed(0)}`;
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="tutela-metric-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-gray-200 rounded-lg loading-pulse">
                  <div className="w-5 h-5"></div>
                </div>
                <div className="ml-4 flex-1">
                  <div className="h-4 bg-gray-200 rounded loading-pulse mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded loading-pulse"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Active Offers",
      value: metrics?.activeOffers || 0,
      icon: TrendingUp,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Pending Contracts", 
      value: metrics?.pendingContracts || 0,
      icon: FileText,
      iconColor: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Verification Queue",
      value: metrics?.verificationQueue || 0,
      icon: Clock,
      iconColor: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: "Total Volume",
      value: formatVolume(metrics?.totalVolume || "0"),
      icon: DollarSign,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="tutela-metric-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`p-2 ${card.bgColor} rounded-lg`}>
                  <Icon className={`${card.iconColor} h-5 w-5`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
