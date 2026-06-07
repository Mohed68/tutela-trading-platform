import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DocumentUpload from "@/components/verification/DocumentUpload";
import { FileText, Shield, CheckCircle, Clock, XCircle, AlertTriangle, Download, Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function Verification() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: documents = [], isLoading: documentsLoading } = useQuery<any[]>({
    queryKey: ["/api/verification/documents"],
    retry: false,
    enabled: isAuthenticated,
  });

  const { data: pendingVerifications = [], isLoading: pendingLoading } = useQuery<any[]>({
    queryKey: ["/api/verification/pending"],
    retry: false,
    enabled: isAuthenticated,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "under_review":
        return <Eye className="h-5 w-5 text-blue-600" />;
      case "requires_additional_docs":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "pending":
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "under_review":
        return "bg-blue-100 text-blue-800";
      case "requires_additional_docs":
        return "bg-yellow-100 text-yellow-800";
      case "pending":
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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

  const formatDocumentType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Document Verification</h1>
          <p className="mt-2 text-gray-600">
            Upload and manage your business documents for AI-powered verification
          </p>
        </div>

        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Upload Documents</TabsTrigger>
            <TabsTrigger value="my-documents">My Documents</TabsTrigger>
            <TabsTrigger value="review-queue">Review Queue</TabsTrigger>
          </TabsList>

          {/* Upload Documents Tab */}
          <TabsContent value="upload" className="space-y-6">
            <DocumentUpload />
            
            {/* Document Types Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5 text-blue-600" />
                  Required Document Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Business License</h4>
                    <p className="text-sm text-blue-700">
                      Official business registration and licensing documents
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-2">Financial Statements</h4>
                    <p className="text-sm text-green-700">
                      Audited financial statements and balance sheets
                    </p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-900 mb-2">Tax Certificates</h4>
                    <p className="text-sm text-yellow-700">
                      Tax compliance certificates and clearances
                    </p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-medium text-purple-900 mb-2">Insurance Documents</h4>
                    <p className="text-sm text-purple-700">
                      Professional liability and trade insurance policies
                    </p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-900 mb-2">Bank Statements</h4>
                    <p className="text-sm text-red-700">
                      Recent bank statements showing financial capacity
                    </p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Other Certificates</h4>
                    <p className="text-sm text-gray-700">
                      Industry-specific certifications and permits
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Documents Tab */}
          <TabsContent value="my-documents" className="space-y-6">
            {documentsLoading ? (
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
              <div className="space-y-4">
                {documents.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No documents uploaded</h3>
                    <p className="text-gray-600">
                      Upload your first document to start the verification process.
                    </p>
                  </div>
                ) : (
                  documents.map((document: any) => (
                    <Card key={document.id} className="tutela-metric-card">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileText className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{document.fileName}</h4>
                              <p className="text-sm text-gray-600 mb-2">
                                {formatDocumentType(document.documentType)}
                              </p>
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>{formatFileSize(document.fileSize)}</span>
                                <span>Uploaded {formatDate(document.uploadedAt)}</span>
                                {document.reviewedAt && (
                                  <span>Reviewed {formatDate(document.reviewedAt)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(document.status)}
                            <Badge className={`status-badge ${getStatusColor(document.status)}`}>
                              {document.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>

                        {/* AI Validation Results */}
                        {document.aiValidationResult && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <h5 className="font-medium text-gray-900 mb-2 flex items-center">
                              <Shield className="mr-2 h-4 w-4 text-blue-600" />
                              AI Validation Results
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Validity:</span>
                                <span className={`ml-2 font-medium ${
                                  document.aiValidationResult.isValid ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {document.aiValidationResult.isValid ? 'Valid' : 'Invalid'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Confidence:</span>
                                <span className="ml-2 font-medium">
                                  {(document.aiValidationResult.confidence * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Type:</span>
                                <span className="ml-2 font-medium">
                                  {document.aiValidationResult.extractedData?.documentType || 'Unknown'}
                                </span>
                              </div>
                            </div>
                            
                            {document.aiValidationResult.issues && document.aiValidationResult.issues.length > 0 && (
                              <div className="mt-3">
                                <h6 className="text-sm font-medium text-red-700 mb-1">Issues Found:</h6>
                                <ul className="text-xs text-red-600 space-y-1">
                                  {document.aiValidationResult.issues.map((issue: string, index: number) => (
                                    <li key={index}>• {issue}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {document.aiValidationResult.recommendations && document.aiValidationResult.recommendations.length > 0 && (
                              <div className="mt-3">
                                <h6 className="text-sm font-medium text-blue-700 mb-1">Recommendations:</h6>
                                <ul className="text-xs text-blue-600 space-y-1">
                                  {document.aiValidationResult.recommendations.map((rec: string, index: number) => (
                                    <li key={index}>• {rec}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Review Notes */}
                        {document.reviewNotes && (
                          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <h5 className="font-medium text-yellow-900 mb-1">Reviewer Notes:</h5>
                            <p className="text-sm text-yellow-800">{document.reviewNotes}</p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
                          <Button variant="outline" className="tutela-btn-secondary flex-1">
                            <Eye className="mr-2 h-4 w-4" />
                            View Document
                          </Button>
                          <Button variant="outline" className="tutela-btn-secondary flex-1">
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                          {document.status === "requires_additional_docs" && (
                            <Button className="tutela-btn-primary flex-1">
                              Upload Additional
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </TabsContent>

          {/* Review Queue Tab */}
          <TabsContent value="review-queue" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Verifications</CardTitle>
                <p className="text-sm text-gray-600">
                  Documents from all users waiting for manual review
                </p>
              </CardHeader>
              <CardContent>
                {pendingLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                        <div className="w-10 h-10 bg-gray-200 rounded-full loading-pulse"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded loading-pulse"></div>
                          <div className="h-3 bg-gray-200 rounded loading-pulse w-3/4"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : pendingVerifications.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No pending verifications</h3>
                    <p className="text-gray-600">
                      All documents have been processed and reviewed.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingVerifications.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{doc.fileName}</p>
                            <p className="text-sm text-gray-600">
                              {formatDocumentType(doc.documentType)} • {doc.user?.companyName || `${doc.user?.firstName} ${doc.user?.lastName}`}
                            </p>
                            <p className="text-xs text-gray-500">
                              Uploaded {formatDate(doc.uploadedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm">
                            Review
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
