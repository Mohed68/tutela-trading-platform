import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, Calendar, DollarSign, User, MapPin, Link } from "lucide-react";

export default function Contracts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["/api/contracts"],
    retry: false,
  });

  const statusOptions = [
    { value: "all", label: "All Contracts" },
    { value: "draft", label: "Draft" },
    { value: "pending_approval", label: "Pending Approval" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const filteredContracts = (contracts as any[]).filter((contract: any) => {
    const matchesSearch = 
      contract.offer?.commodity?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.buyer?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.seller?.companyName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatPrice = (price: string, currency: string = "USD") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(parseFloat(price));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending_approval":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Smart Contracts</h1>
          <p className="mt-2 text-gray-600">
            Manage your blockchain-secured commodity trading contracts
          </p>
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
                    placeholder="Search contracts..."
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

        {/* Contracts List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="tutela-metric-card">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg loading-pulse"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded loading-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded loading-pulse w-2/3"></div>
                    </div>
                    <div className="h-6 w-20 bg-gray-200 rounded loading-pulse"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredContracts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No contracts found</h3>
                <p className="text-gray-600">
                  {searchQuery || statusFilter !== "all" 
                    ? "Try adjusting your search or filter criteria."
                    : "You don't have any contracts yet. Create an offer to get started."
                  }
                </p>
              </div>
            ) : (
              filteredContracts.map((contract: any) => (
                <Card key={contract.id} className="tutela-metric-card">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {contract.offer?.commodity?.name}
                          </CardTitle>
                          <p className="text-sm text-gray-600">
                            Contract #{contract.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <Badge className={`status-badge ${getStatusColor(contract.status)}`}>
                        {contract.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-600">Total Value</p>
                          <p className="font-medium">
                            {formatPrice(contract.totalPrice, contract.offer?.currency)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-600">Quantity</p>
                          <p className="font-medium">
                            {parseFloat(contract.quantity).toLocaleString()} {contract.offer?.unit}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-600">Counterparty</p>
                          <p className="font-medium">
                            {contract.buyer?.companyName || contract.seller?.companyName}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-600">Delivery Date</p>
                          <p className="font-medium">
                            {contract.deliveryDate ? formatDate(contract.deliveryDate) : "TBD"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Link className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">Blockchain Status</span>
                        </div>
                        {contract.blockchainTxHash ? (
                          <div className="text-right">
                            <p className="text-xs text-gray-600">Transaction Hash</p>
                            <p className="font-mono text-sm text-blue-600">
                              {contract.blockchainTxHash.slice(0, 10)}...{contract.blockchainTxHash.slice(-8)}
                            </p>
                          </div>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            Pending Deployment
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button className="tutela-btn-primary flex-1">
                        View Details
                      </Button>
                      {contract.status === "draft" && (
                        <Button variant="outline" className="tutela-btn-secondary">
                          Edit Contract
                        </Button>
                      )}
                      {contract.blockchainTxHash && (
                        <Button variant="outline" className="tutela-btn-secondary">
                          View on Blockchain
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Package(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}
