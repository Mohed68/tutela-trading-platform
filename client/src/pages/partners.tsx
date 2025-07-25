import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Plus, Users, Building, Star, Shield, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

const partnerRequestSchema = z.object({
  partnerId: z.string().min(1, "Partner ID is required"),
  notes: z.string().optional(),
});

export default function Partners() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["/api/partners"],
    retry: false,
  });

  const form = useForm<z.infer<typeof partnerRequestSchema>>({
    resolver: zodResolver(partnerRequestSchema),
    defaultValues: {
      partnerId: "",
      notes: "",
    },
  });

  const requestPartnerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof partnerRequestSchema>) => {
      const response = await apiRequest("POST", "/api/partners/request", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Partner Request Sent",
        description: "Your partnership request has been sent successfully.",
      });
      setIsRequestModalOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send partner request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updatePartnerStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/partners/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Partner Status Updated",
        description: "The partner relationship status has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update partner status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const statusOptions = [
    { value: "all", label: "All Partners" },
    { value: "approved", label: "Approved" },
    { value: "pending", label: "Pending" },
    { value: "rejected", label: "Rejected" },
  ];

  const filteredPartners = (partners as any[]).filter((partner: any) => {
    const matchesSearch = 
      partner.partner?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.partner?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.partner?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.requester?.companyName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || partner.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRatingStars = (rating: string | number) => {
    const numRating = typeof rating === 'string' ? parseFloat(rating) : rating;
    const fullStars = Math.floor(numRating);
    const stars = [];
    
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`h-4 w-4 ${i < fullStars ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
        />
      );
    }
    
    return stars;
  };

  const onSubmit = (data: z.infer<typeof partnerRequestSchema>) => {
    requestPartnerMutation.mutate(data);
  };

  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Trading Partners</h1>
            <p className="mt-2 text-gray-600">
              Manage your verified trading relationships and partnerships
            </p>
          </div>
          <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
            <DialogTrigger asChild>
              <Button className="tutela-btn-primary mt-4 sm:mt-0">
                <Plus className="mr-2 h-4 w-4" />
                Request Partnership
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Request New Partnership</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="partnerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Partner User ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter partner's user ID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add a message or reason for the partnership request..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsRequestModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={requestPartnerMutation.isPending}
                      className="tutela-btn-primary"
                    >
                      {requestPartnerMutation.isPending ? "Sending..." : "Send Request"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filter Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search partners..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="tutela-form-select w-full sm:w-auto"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Partners Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="tutela-metric-card">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full loading-pulse"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded loading-pulse mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded loading-pulse w-2/3"></div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded loading-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded loading-pulse w-3/4"></div>
                    <div className="h-8 bg-gray-200 rounded loading-pulse"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPartners.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No partners found</h3>
                <p className="text-gray-600">
                  {searchQuery || statusFilter !== "all" 
                    ? "Try adjusting your search or filter criteria."
                    : "You don't have any trading partners yet. Send a partnership request to get started."
                  }
                </p>
              </div>
            ) : (
              filteredPartners.map((partnership: any) => {
                const partner = partnership.partner || partnership.requester;
                return (
                  <Card key={partnership.id} className="tutela-metric-card hover:shadow-lg transition-shadow duration-200">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          {partner?.profileImageUrl ? (
                            <img
                              src={partner.profileImageUrl}
                              alt={`${partner.firstName} ${partner.lastName}`}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                              <Building className="h-6 w-6 text-blue-600" />
                            </div>
                          )}
                          <div className="flex-1">
                            <CardTitle className="text-lg">
                              {partner?.firstName} {partner?.lastName}
                            </CardTitle>
                            <p className="text-sm text-gray-600">
                              {partner?.companyName || "Individual Trader"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(partnership.status)}
                          <Badge className={`status-badge ${getStatusColor(partnership.status)}`}>
                            {partnership.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Financial Rating */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Financial Rating:</span>
                          <div className="flex items-center space-x-1">
                            {getRatingStars(partner?.financialRating || 0)}
                            <span className="text-sm font-medium ml-2">
                              {parseFloat(partner?.financialRating || "0").toFixed(1)}
                            </span>
                          </div>
                        </div>

                        {/* Credit Rating */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Credit Rating:</span>
                          <Badge variant="outline" className="text-xs">
                            {partner?.creditRating || "Unrated"}
                          </Badge>
                        </div>

                        {/* Verification Status */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Verified:</span>
                          <div className="flex items-center space-x-1">
                            {partner?.verified ? (
                              <Shield className="h-4 w-4 text-green-600" />
                            ) : (
                              <Shield className="h-4 w-4 text-gray-400" />
                            )}
                            <span className={`text-xs ${partner?.verified ? 'text-green-600' : 'text-gray-400'}`}>
                              {partner?.verified ? "Verified" : "Unverified"}
                            </span>
                          </div>
                        </div>

                        {/* Partnership Notes */}
                        {partnership.notes && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-600 mb-1">Notes:</p>
                            <p className="text-sm">{partnership.notes}</p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t">
                          {partnership.status === "pending" && (
                            <>
                              <Button
                                onClick={() => updatePartnerStatusMutation.mutate({ 
                                  id: partnership.id, 
                                  status: "approved" 
                                })}
                                disabled={updatePartnerStatusMutation.isPending}
                                className="tutela-btn-primary flex-1"
                              >
                                Approve
                              </Button>
                              <Button
                                onClick={() => updatePartnerStatusMutation.mutate({ 
                                  id: partnership.id, 
                                  status: "rejected" 
                                })}
                                disabled={updatePartnerStatusMutation.isPending}
                                variant="outline"
                                className="flex-1"
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {partnership.status === "approved" && (
                            <Button className="tutela-btn-primary w-full">
                              View Profile
                            </Button>
                          )}
                          {partnership.status === "rejected" && (
                            <Button
                              onClick={() => updatePartnerStatusMutation.mutate({ 
                                id: partnership.id, 
                                status: "pending" 
                              })}
                              disabled={updatePartnerStatusMutation.isPending}
                              variant="outline"
                              className="w-full"
                            >
                              Reconsider
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
