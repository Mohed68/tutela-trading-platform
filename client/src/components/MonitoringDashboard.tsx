import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Users,
  FileText,
  ShoppingCart,
  CreditCard
} from "lucide-react";
import { ClientEvents, UserContext } from "@/lib/monitoring";

interface MonitoringStats {
  totalEvents: number;
  errorRate: number;
  avgResponseTime: number;
  activeUsers: number;
  lastUpdate: string;
}

interface RecentEvent {
  id: string;
  type: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  timestamp: string;
  userId?: string;
}

export function MonitoringDashboard() {
  const [stats, setStats] = useState<MonitoringStats>({
    totalEvents: 0,
    errorRate: 0,
    avgResponseTime: 0,
    activeUsers: 1,
    lastUpdate: new Date().toISOString()
  });

  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Demo function to simulate monitoring events
  const generateTestEvents = () => {
    const eventTypes = [
      { type: 'user_login', message: 'User logged in successfully', level: 'info' as const },
      { type: 'kyb_upload', message: 'KYB document uploaded', level: 'info' as const },
      { type: 'offer_created', message: 'New commodity offer created', level: 'info' as const },
      { type: 'payment_success', message: 'Payment processed successfully', level: 'info' as const },
      { type: 'api_error', message: 'Slow API response detected', level: 'warning' as const },
      { type: 'validation_error', message: 'Document validation failed', level: 'error' as const }
    ];

    const newEvents: RecentEvent[] = [];
    for (let i = 0; i < 5; i++) {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      newEvents.push({
        id: `event-${Date.now()}-${i}`,
        type: eventType.type,
        message: eventType.message,
        level: eventType.level,
        timestamp: new Date(Date.now() - Math.random() * 300000).toISOString(), // Random time in last 5 minutes
        userId: 'demo-user'
      });
    }

    setRecentEvents(prev => [...newEvents, ...prev].slice(0, 10));
    
    // Update stats
    setStats(prev => ({
      ...prev,
      totalEvents: prev.totalEvents + newEvents.length,
      errorRate: Math.random() * 5, // Random error rate 0-5%
      avgResponseTime: 150 + Math.random() * 300, // Random response time 150-450ms
      activeUsers: Math.floor(Math.random() * 50) + 1,
      lastUpdate: new Date().toISOString()
    }));
  };

  useEffect(() => {
    // Initialize with some demo data
    generateTestEvents();
    setIsLoading(false);

    // Set up interval to simulate real-time updates
    const interval = setInterval(generateTestEvents, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Demo functions to test various monitoring events
  const testEvents = {
    pageView: () => {
      ClientEvents.pageView('Monitoring Dashboard', 'demo-user');
      toast({ title: "Page View Logged", description: "Monitoring dashboard page view tracked" });
    },
    
    formSubmission: () => {
      ClientEvents.formSubmission('demo-form', true);
      toast({ title: "Form Success Logged", description: "Successful form submission tracked" });
    },
    
    formError: () => {
      ClientEvents.formSubmission('demo-form', false, ['validation error', 'required field missing']);
      toast({ title: "Form Error Logged", description: "Form submission error tracked", variant: "destructive" });
    },
    
    offerViewed: () => {
      ClientEvents.offerViewed('offer-123', 'crude-oil', 78.45);
      toast({ title: "Offer View Logged", description: "Commodity offer view tracked" });
    },
    
    contractInitiated: () => {
      ClientEvents.contractInitiated('offer-123', 'crude-oil');
      toast({ title: "Contract Event Logged", description: "Contract initiation tracked" });
    },
    
    documentUpload: () => {
      ClientEvents.documentUploadStarted('business-registration', 2048000);
      setTimeout(() => {
        ClientEvents.documentUploadCompleted('business-registration', 3500);
        toast({ title: "Upload Events Logged", description: "Document upload process tracked" });
      }, 1000);
    },
    
    paymentFlow: () => {
      ClientEvents.checkoutStarted('Market Analyzer', 'annual', 240);
      setTimeout(() => {
        ClientEvents.paymentSuccess('Market Analyzer', 240, 'cs_test_123');
        toast({ title: "Payment Events Logged", description: "Payment flow tracked successfully" });
      }, 2000);
    },
    
    apiError: () => {
      ClientEvents.apiError('/api/test-endpoint', 500, 'Internal server error');
      toast({ title: "API Error Logged", description: "Server error tracked", variant: "destructive" });
    },
    
    setUserContext: () => {
      UserContext.setUser('demo-user', 'demo@tutela.com', 'Market Analyzer');
      toast({ title: "User Context Set", description: "User context updated in monitoring" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Loading Monitoring Dashboard...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Monitoring Dashboard</h2>
        <Badge variant="outline" className="ml-auto">
          Real-time
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(stats.lastUpdate).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.errorRate.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.errorRate < 1 ? "Excellent" : stats.errorRate < 3 ? "Good" : "Needs attention"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgResponseTime.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">
              {stats.avgResponseTime < 200 ? "Fast" : stats.avgResponseTime < 500 ? "Good" : "Slow"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              Currently online
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Test Events */}
      <Card>
        <CardHeader>
          <CardTitle>Test Monitoring Events</CardTitle>
          <p className="text-sm text-muted-foreground">
            Click buttons to generate test events and see them tracked in real-time
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <Button onClick={testEvents.pageView} variant="outline" size="sm">
              <Activity className="h-4 w-4 mr-2" />
              Page View
            </Button>
            
            <Button onClick={testEvents.formSubmission} variant="outline" size="sm">
              <CheckCircle className="h-4 w-4 mr-2" />
              Form Success
            </Button>
            
            <Button onClick={testEvents.formError} variant="outline" size="sm">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Form Error
            </Button>
            
            <Button onClick={testEvents.offerViewed} variant="outline" size="sm">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Offer View
            </Button>
            
            <Button onClick={testEvents.contractInitiated} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Contract
            </Button>
            
            <Button onClick={testEvents.documentUpload} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Upload
            </Button>
            
            <Button onClick={testEvents.paymentFlow} variant="outline" size="sm">
              <CreditCard className="h-4 w-4 mr-2" />
              Payment
            </Button>
            
            <Button onClick={testEvents.apiError} variant="outline" size="sm">
              <AlertTriangle className="h-4 w-4 mr-2" />
              API Error
            </Button>
            
            <Button onClick={testEvents.setUserContext} variant="outline" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Set User
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <p className="text-sm text-muted-foreground">
            Latest monitoring events and system activities
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent events
              </p>
            ) : (
              recentEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0">
                    {event.level === 'error' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                    {event.level === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                    {event.level === 'info' && <CheckCircle className="h-5 w-5 text-green-500" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{event.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.type} • {new Date(event.timestamp).toLocaleTimeString()}
                      {event.userId && ` • User: ${event.userId}`}
                    </p>
                  </div>
                  
                  <Badge 
                    variant={event.level === 'error' ? 'destructive' : event.level === 'warning' ? 'secondary' : 'default'}
                    className="text-xs"
                  >
                    {event.level}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Sentry Monitoring</span>
              <Badge variant="default" className="ml-auto text-xs">Active</Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Error Tracking</span>
              <Badge variant="default" className="ml-auto text-xs">Active</Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Performance Monitoring</span>
              <Badge variant="default" className="ml-auto text-xs">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}