import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useRoute } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  FileCheck, 
  Shield, 
  Activity,
  Settings,
  Eye,
  EyeOff,
  Archive,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/queryClient';

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  role: string;
  permissions: string[];
  requires2FA: boolean;
  is2FAVerified: boolean;
}

interface Company {
  id: string;
  email: string;
  companyName: string;
  kybStatus: string;
  verificationLevel: string;
  createdAt: string;
}

interface Offer {
  id: string;
  commodity: { name: string };
  user: { companyName: string };
  quantity: string;
  pricePerUnit: string;
  status: string;
  moderationStatus: string;
  moderatedAt: string;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const [match] = useRoute('/admin/:section?');
  const section = match?.section || 'overview';
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [moderationDialog, setModerationDialog] = useState<{ open: boolean; offer: Offer | null }>({ open: false, offer: null });
  const [moderationReason, setModerationReason] = useState('');

  // Admin authentication check
  const { data: adminUser, isLoading: adminLoading, error: adminError } = useQuery({
    queryKey: ['/admin/auth/info'],
    retry: false,
  });

  // Data queries for different sections
  const { data: kybQueue = [] } = useQuery({
    queryKey: ['/admin/kyb'],
    enabled: section === 'kyb' && !!adminUser,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['/admin/companies'],
    enabled: section === 'companies' && !!adminUser,
  });

  const { data: offers = [] } = useQuery({
    queryKey: ['/admin/offers'],
    enabled: section === 'offers' && !!adminUser,
  });

  const { data: marketInsights } = useQuery({
    queryKey: ['/admin/insights/market'],
    enabled: section === 'insights' && !!adminUser,
  });

  const { data: complianceInsights } = useQuery({
    queryKey: ['/admin/insights/compliance'],
    enabled: section === 'insights' && !!adminUser,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['/admin/audit'],
    enabled: section === 'audit' && !!adminUser,
  });

  // Handle admin access
  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p>Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (adminError || !adminUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Access Denied</CardTitle>
            <CardDescription className="text-center">
              You don't have admin privileges to access this console.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/dashboard">
              <Button>Return to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleKYBDecision = async (companyId: string, decision: string, reason: string) => {
    try {
      await apiRequest("POST", `/admin/kyb/${companyId}/decision`, {
        decision,
        reason,
        verificationLevel: decision === 'enhanced' ? 'enhanced' : 'basic',
      });
      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('KYB decision failed:', error);
    }
  };

  const handleOfferModeration = async (offerId: string, action: string, reason: string) => {
    try {
      await apiRequest("POST", `/admin/offers/${offerId}/moderate`, {
        action,
        reason,
      });
      setModerationDialog({ open: false, offer: null });
      setModerationReason('');
      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Offer moderation failed:', error);
    }
  };

  const downloadCSV = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url + '?export=csv';
    link.download = filename;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">TUTELA Admin Console</h1>
              <p className="text-gray-600">
                Welcome, {adminUser.user.role} • {adminUser.user.permissions.length} permissions
              </p>
            </div>
            <div className="flex items-center gap-4">
              {adminUser.user.requires2FA && (
                <Badge variant={adminUser.user.is2FAVerified ? "default" : "destructive"}>
                  {adminUser.user.is2FAVerified ? "2FA Verified" : "2FA Required"}
                </Badge>
              )}
              <Link href="/dashboard">
                <Button variant="outline">Return to Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <Tabs value={section} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <Link href="/admin/overview">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Overview
              </TabsTrigger>
            </Link>
            <Link href="/admin/kyb">
              <TabsTrigger value="kyb" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                KYB Queue
              </TabsTrigger>
            </Link>
            <Link href="/admin/companies">
              <TabsTrigger value="companies" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Companies
              </TabsTrigger>
            </Link>
            <Link href="/admin/offers">
              <TabsTrigger value="offers" className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Offers
              </TabsTrigger>
            </Link>
            <Link href="/admin/insights">
              <TabsTrigger value="insights" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Insights
              </TabsTrigger>
            </Link>
            <Link href="/admin/audit">
              <TabsTrigger value="audit" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Audit Log
              </TabsTrigger>
            </Link>
          </TabsList>

          {/* Overview Section */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending KYB</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kybQueue.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Companies awaiting verification
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Offers</CardTitle>
                  <FileCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{marketInsights?.activeOffers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Total market listings
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{companies.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Registered companies
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Market Value</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${marketInsights?.totalValue || '0'}</div>
                  <p className="text-xs text-muted-foreground">
                    Total marketplace value
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Admin Actions</CardTitle>
                <CardDescription>Latest administrative activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {auditLogs.slice(0, 5).map((log: AuditLog) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{log.action}</p>
                        <p className="text-sm text-muted-foreground">
                          {log.entityType} • {log.entityId} • {new Date(log.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      {log.reason && (
                        <Badge variant="outline" className="text-xs">
                          {log.reason}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* KYB Queue Section */}
          <TabsContent value="kyb" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>KYB Verification Queue</CardTitle>
                <CardDescription>Companies pending verification approval</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kybQueue.map((company: Company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.companyName}</TableCell>
                        <TableCell>{company.email}</TableCell>
                        <TableCell>
                          <Badge variant={company.kybStatus === 'pending' ? 'secondary' : 'default'}>
                            {company.kybStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(company.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleKYBDecision(company.id, 'verified', 'Standard verification approved')}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleKYBDecision(company.id, 'enhanced', 'Enhanced verification approved')}
                            >
                              <Shield className="h-4 w-4" />
                              Enhanced
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleKYBDecision(company.id, 'rejected', 'Insufficient documentation')}
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Companies Section */}
          <TabsContent value="companies" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Management</CardTitle>
                <CardDescription>Manage registered companies and users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Input placeholder="Search companies..." className="max-w-sm" />
                    <Select>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>KYB Status</TableHead>
                        <TableHead>Verification Level</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies.map((company: Company) => (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">{company.companyName}</TableCell>
                          <TableCell>{company.email}</TableCell>
                          <TableCell>
                            <Badge variant={company.kybStatus === 'verified' ? 'default' : 
                                           company.kybStatus === 'rejected' ? 'destructive' : 'secondary'}>
                              {company.kybStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{company.verificationLevel}</Badge>
                          </TableCell>
                          <TableCell>{new Date(company.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                View Details
                              </Button>
                              <Button size="sm" variant="outline">
                                Reset 2FA
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Offers Section */}
          <TabsContent value="offers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Offer Moderation</CardTitle>
                <CardDescription>Manage marketplace offers and content moderation</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Commodity</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offers.map((offer: Offer) => (
                      <TableRow key={offer.id}>
                        <TableCell className="font-medium">{offer.commodity?.name}</TableCell>
                        <TableCell>{offer.user?.companyName}</TableCell>
                        <TableCell>{offer.quantity}</TableCell>
                        <TableCell>${offer.pricePerUnit}</TableCell>
                        <TableCell>
                          <Badge variant={offer.moderationStatus === 'hidden' ? 'destructive' : 'default'}>
                            {offer.moderationStatus || 'active'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setModerationDialog({ open: true, offer })}
                            >
                              {offer.moderationStatus === 'hidden' ? (
                                <>
                                  <Eye className="h-4 w-4" />
                                  Unhide
                                </>
                              ) : (
                                <>
                                  <EyeOff className="h-4 w-4" />
                                  Hide
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setModerationDialog({ open: true, offer })}
                            >
                              <Archive className="h-4 w-4" />
                              Archive
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Insights Section */}
          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Market Insights</CardTitle>
                      <CardDescription>Trading activity and market metrics</CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadCSV('/admin/insights/market', 'market-insights.csv')}
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold">{marketInsights?.activeOffers || 0}</div>
                      <div className="text-sm text-muted-foreground">Active Offers</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold">${marketInsights?.totalValue || '0'}</div>
                      <div className="text-sm text-muted-foreground">Market Value</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Top Commodities</h4>
                    {marketInsights?.topCommodities?.map((commodity: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{commodity.name}</span>
                        <Badge variant="outline">{commodity.count} offers</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Compliance Insights</CardTitle>
                  <CardDescription>KYB processing and compliance metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{complianceInsights?.kybPending || 0}</div>
                      <div className="text-sm text-muted-foreground">Pending</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{complianceInsights?.kybApproved || 0}</div>
                      <div className="text-sm text-muted-foreground">Approved</div>
                    </div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{complianceInsights?.avgProcessingTime || 48}h</div>
                    <div className="text-sm text-muted-foreground">Avg Processing Time</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Audit Log Section */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>Complete history of administrative actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Input placeholder="Search audit logs..." className="max-w-sm" />
                    <Select>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="kyb_approved">KYB Approved</SelectItem>
                        <SelectItem value="kyb_rejected">KYB Rejected</SelectItem>
                        <SelectItem value="offer_hidden">Offer Hidden</SelectItem>
                        <SelectItem value="user_disabled">User Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Admin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log: AuditLog) => (
                        <TableRow key={log.id}>
                          <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.action}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {log.entityType} • {log.entityId.substring(0, 8)}...
                            </span>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{log.reason}</TableCell>
                          <TableCell>{log.userId.substring(0, 8)}...</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Moderation Dialog */}
        <Dialog open={moderationDialog.open} onOpenChange={(open) => setModerationDialog({ open, offer: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Moderate Offer</DialogTitle>
              <DialogDescription>
                Choose an action for this offer and provide a reason
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Offer: {moderationDialog.offer?.commodity?.name}</label>
                <p className="text-sm text-muted-foreground">
                  By {moderationDialog.offer?.user?.companyName}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium">Reason</label>
                <Textarea
                  placeholder="Provide a reason for this moderation action..."
                  value={moderationReason}
                  onChange={(e) => setModerationReason(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => moderationDialog.offer && handleOfferModeration(
                    moderationDialog.offer.id, 
                    moderationDialog.offer.moderationStatus === 'hidden' ? 'unhide' : 'hide', 
                    moderationReason
                  )}
                >
                  {moderationDialog.offer?.moderationStatus === 'hidden' ? 'Unhide' : 'Hide'} Offer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => moderationDialog.offer && handleOfferModeration(
                    moderationDialog.offer.id, 
                    'archive', 
                    moderationReason
                  )}
                >
                  Archive Offer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
