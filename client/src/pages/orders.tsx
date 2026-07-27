import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  ShoppingCart, 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Truck,
  DollarSign,
  Shield,
  Eye,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { Order } from "@shared/schema";

interface OrderWithDetails extends Order {
  offer: {
    id: string;
    commodity: {
      name: string;
      category: string;
    };
    location: string;
    specifications: string;
    deliveryOptions: string;
    user: {
      firstName: string;
      lastName: string;
      companyName: string;
    };
  };
}

const statusConfig = {
  pending: { label: "Pending", color: "bg-yellow-500", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-blue-500", icon: CheckCircle },
  in_transit: { label: "In Transit", color: "bg-purple-500", icon: Truck },
  delivered: { label: "Delivered", color: "bg-green-500", icon: Package },
  completed: { label: "Completed", color: "bg-emerald-500", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-red-500", icon: XCircle },
};

const paymentStatusConfig = {
  pending: { label: "Payment Pending", color: "bg-gray-500" },
  escrowed: { label: "Escrowed", color: "bg-blue-500" },
  released: { label: "Payment Released", color: "bg-green-500" },
  refunded: { label: "Refunded", color: "bg-red-500" },
};

export default function Orders() {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [activeTab, setActiveTab] = useState("incoming");
  const { user, isLoading: isAuthLoading } = useAuth();

  const { data: orders = [], isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  const incomingOrders = orders.filter(order => order.sellerId === user?.id);
  const outgoingOrders = orders.filter(order => order.buyerId === user?.id);

  const getProgressValue = (status: string): number => {
    const progress = {
      pending: 20,
      confirmed: 40,
      in_transit: 60,
      delivered: 80,
      completed: 100,
      cancelled: 0,
    };
    return progress[status as keyof typeof progress] || 0;
  };

  if (isLoading || isAuthLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Orders</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20 bg-gray-200" />
              <CardContent className="h-32 bg-gray-100" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const OrderCard = ({ order }: { order: OrderWithDetails }) => {
    const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending;
    const paymentInfo = paymentStatusConfig[order.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.pending;
    const StatusIcon = statusInfo.icon;
    
    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{order.offer.commodity.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Package className="h-3 w-3" />
                {Number(order.quantity).toLocaleString()} units
              </CardDescription>
            </div>
            <Badge className={cn("text-white", statusInfo.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>
          
          <div className="mt-3 space-y-2">
            <Progress value={getProgressValue(order.status || 'pending')} className="h-2" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Order Progress</span>
              <span>{getProgressValue(order.status || 'pending')}%</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Value:</span>
              <div className="font-semibold flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                ${Number(order.totalAmount).toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Company:</span>
              <div className="font-medium">{order.offer.user.companyName}</div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Badge variant="outline" className={cn("text-white", paymentInfo.color)}>
              <Shield className="h-3 w-3 mr-1" />
              {paymentInfo.label}
            </Badge>
            
            <Button
              variant="outline" 
              size="sm"
              onClick={() => setSelectedOrder(order)}
              className="flex items-center gap-1"
            >
              <Eye className="h-3 w-3" />
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Orders Management</h1>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Order
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{orders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${orders.reduce((sum, order) => sum + Number(order.totalAmount), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {orders.filter(o => o.status === "completed").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="incoming" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Incoming Orders ({incomingOrders.length})
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Outgoing Orders ({outgoingOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="space-y-4">
          <div className="text-muted-foreground">
            Orders where you are selling commodities to buyers
          </div>
          {incomingOrders.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No incoming orders yet
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {incomingOrders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="space-y-4">
          <div className="text-muted-foreground">
            Orders where you are purchasing commodities from sellers
          </div>
          {outgoingOrders.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center text-muted-foreground">
                  <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No outgoing orders yet
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {outgoingOrders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Order Details Modal would go here */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto m-4">
            <CardHeader>
              <CardTitle>Order Details - {selectedOrder.offer.commodity.name}</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-4 right-4"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Detailed order information would be displayed here */}
              <p>Detailed order view would be implemented here with all specifications, delivery options, and smart contract details.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
