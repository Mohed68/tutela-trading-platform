import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RecentActivity() {
  const { data: activities = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/activity"],
    retry: false,
  });

  const getActivityIcon = (action: string) => {
    switch (action) {
      case "create_offer":
        return "success";
      case "create_contract":
        return "info";
      case "upload_document":
        return "warning";
      case "request_partnership":
        return "info";
      default:
        return "info";
    }
  };

  const formatActivityText = (activity: any) => {
    switch (activity.action) {
      case "create_offer":
        return "Created a new commodity offer";
      case "create_contract":
        return "Generated smart contract";
      case "upload_document":
        return "Uploaded verification document";
      case "request_partnership":
        return "Sent partnership request";
      default:
        return activity.action.replace(/_/g, ' ');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 24 * 60) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / (24 * 60));
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  };

  return (
    <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-900">
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-gray-200 rounded-full mt-2 loading-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded loading-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded loading-pulse w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity: any) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`activity-dot ${getActivityIcon(activity.action)}`}></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">
                    {formatActivityText(activity)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatTimeAgo(activity.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
