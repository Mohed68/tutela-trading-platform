import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecureUploader } from "../verification/SecureUploader";
import { FileText, Shield, CheckCircle, Clock, Upload, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMonitoring } from "@/hooks/useMonitoring";

interface OfferVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: any;
  onVerificationComplete?: (offer: any) => void;
}

export function OfferVerificationModal({ 
  isOpen, 
  onClose, 
  offer, 
  onVerificationComplete 
}: OfferVerificationModalProps) {
  const [activeTab, setActiveTab] = useState("documents");
  const [verificationData, setVerificationData] = useState({
    productCertificates: [],
    qualityReports: [],
    originCertificates: [],
    complianceDocuments: [],
    additionalNotes: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { trackDocumentUpload } = useMonitoring();

  const documentTypes = [
    {
      id: "product_certificates",
      title: "Product Certificates",
      description: "Quality and composition certificates for the commodity",
      icon: <FileText className="h-5 w-5 text-blue-600" />,
      required: true
    },
    {
      id: "quality_reports",
      title: "Quality Reports",
      description: "Third-party quality assurance and testing reports",
      icon: <Shield className="h-5 w-5 text-green-600" />,
      required: true
    },
    {
      id: "origin_certificates",
      title: "Origin Certificates",
      description: "Certificates of origin and export documentation",
      icon: <CheckCircle className="h-5 w-5 text-purple-600" />,
      required: false
    },
    {
      id: "compliance_documents",
      title: "Compliance Documents",
      description: "Regulatory compliance and safety documentation",
      icon: <AlertTriangle className="h-5 w-5 text-orange-600" />,
      required: false
    }
  ];

  const handleDocumentUpload = async (documentType: string, files: FileList | any) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const startTime = Date.now();
    
    trackDocumentUpload.started(documentType, file.size);

    try {
      setIsSubmitting(true);

      // Generate upload URL
      const response = await fetch('/api/verification/upload-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType })
      });

      if (!response.ok) {
        throw new Error('Failed to generate upload URL');
      }

      const { uploadURL } = await response.json();

      // Upload file to object storage
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      // Update verification data
      setVerificationData(prev => ({
        ...prev,
        [documentType]: [...(prev[documentType as keyof typeof prev] as any[]), {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          uploadUrl: uploadURL,
          uploadedAt: new Date().toISOString()
        }]
      }));

      const duration = Date.now() - startTime;
      trackDocumentUpload.completed(documentType, duration);

      toast({
        title: "Document Uploaded",
        description: `${file.name} has been uploaded successfully`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      trackDocumentUpload.failed(documentType, errorMessage);
      
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitVerification = async () => {
    try {
      setIsSubmitting(true);

      // Check required documents
      const hasProductCerts = verificationData.productCertificates.length > 0;
      const hasQualityReports = verificationData.qualityReports.length > 0;

      if (!hasProductCerts || !hasQualityReports) {
        toast({
          title: "Missing Required Documents",
          description: "Please upload Product Certificates and Quality Reports",
          variant: "destructive",
        });
        return;
      }

      // Submit verification
      const response = await fetch(`/api/offers/${offer.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents: verificationData,
          notes: verificationData.additionalNotes
        })
      });

      if (!response.ok) {
        throw new Error('Verification submission failed');
      }

      toast({
        title: "Verification Submitted",
        description: "Your offer verification has been submitted for review",
      });

      onVerificationComplete?.(offer);
      onClose();

    } catch (error) {
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDocumentCount = (type: string) => {
    return (verificationData[type as keyof typeof verificationData] as any[])?.length || 0;
  };

  if (!offer) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="h-6 w-6 text-blue-600" />
            <span>Offer Verification</span>
          </DialogTitle>
          <DialogDescription>
            Upload required documents to verify your commodity offer and enable trading
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Offer Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{offer.commodity || offer.commodityName || 'Commodity'}</h3>
                  <p className="text-sm text-gray-600">
                    {offer.quantity?.toLocaleString() || 'N/A'} {offer.unit || 'units'} • ${offer.pricePerUnit || offer.price || 'N/A'}/unit
                  </p>
                  <p className="text-sm text-gray-500">{offer.location || 'Location not specified'}</p>
                </div>
                <Badge variant="outline">Pending Verification</Badge>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="documents">Document Upload</TabsTrigger>
              <TabsTrigger value="review">Review & Submit</TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="space-y-4">
              <div className="grid gap-4">
                {documentTypes.map((docType) => (
                  <Card key={docType.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start space-x-3">
                          {docType.icon}
                          <div>
                            <h4 className="font-medium flex items-center space-x-2">
                              <span>{docType.title}</span>
                              {docType.required && <span className="text-red-500">*</span>}
                            </h4>
                            <p className="text-sm text-gray-600">{docType.description}</p>
                          </div>
                        </div>
                        <Badge variant={getDocumentCount(docType.id) > 0 ? "default" : "outline"}>
                          {getDocumentCount(docType.id)} uploaded
                        </Badge>
                      </div>

                      <SecureUploader
                        documentType={docType.id}
                        onUploadComplete={(files) => handleDocumentUpload(docType.id, files)}
                        accept=".pdf,.jpg,.jpeg,.png"
                        maxFiles={5}
                        className="w-full"
                      >
                        <div className="flex items-center space-x-2">
                          <Upload className="h-4 w-4" />
                          <span>Upload {docType.title}</span>
                        </div>
                      </SecureUploader>

                      {/* Show uploaded files */}
                      {getDocumentCount(docType.id) > 0 && (
                        <div className="mt-3 space-y-2">
                          {(verificationData[docType.id as keyof typeof verificationData] as any[]).map((file: any) => (
                            <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4 text-gray-500" />
                                <span className="text-sm">{file.name}</span>
                              </div>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* Additional Notes */}
                <Card>
                  <CardContent className="pt-6">
                    <Label htmlFor="notes">Additional Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any additional information about your commodity or documentation..."
                      value={verificationData.additionalNotes}
                      onChange={(e) => setVerificationData(prev => ({ ...prev, additionalNotes: e.target.value }))}
                      className="mt-2"
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="review" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4">Verification Summary</h3>
                  
                  <div className="space-y-3">
                    {documentTypes.map((docType) => {
                      const count = getDocumentCount(docType.id);
                      const isComplete = !docType.required || count > 0;
                      
                      return (
                        <div key={docType.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div className="flex items-center space-x-3">
                            {docType.icon}
                            <span className="font-medium">{docType.title}</span>
                            {docType.required && <span className="text-red-500 text-sm">Required</span>}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">{count} uploaded</span>
                            {isComplete ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <Clock className="h-5 w-5 text-orange-600" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {verificationData.additionalNotes && (
                    <div className="mt-4 p-3 bg-blue-50 rounded">
                      <h4 className="font-medium text-blue-900">Additional Notes:</h4>
                      <p className="text-sm text-blue-700 mt-1">{verificationData.additionalNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <div className="space-x-3">
              {activeTab === "documents" && (
                <Button 
                  onClick={() => setActiveTab("review")}
                  disabled={getDocumentCount("product_certificates") === 0 || getDocumentCount("quality_reports") === 0}
                >
                  Review Submission
                </Button>
              )}
              {activeTab === "review" && (
                <Button 
                  onClick={handleSubmitVerification}
                  disabled={isSubmitting || getDocumentCount("product_certificates") === 0 || getDocumentCount("quality_reports") === 0}
                >
                  {isSubmitting ? "Submitting..." : "Submit for Verification"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}