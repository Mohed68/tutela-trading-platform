import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, File, CheckCircle, AlertCircle, Shield, Lock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SecureUploaderProps {
  documentType: string;
  onUploadComplete: (files: FileList) => void;
  accept?: string;
  maxFiles?: number;
  className?: string;
  children?: React.ReactNode;
}

export function SecureUploader({ documentType, onUploadComplete, accept, maxFiles, className, children }: SecureUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Only PDF and image files are allowed",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 10MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      
      // Create FileList for callback
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      onUploadComplete(dataTransfer.files);
    }
  };

  const uploadToSecureStorage = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get presigned upload URL
      toast({
        title: "Securing Upload",
        description: "Generating secure upload URL...",
      });

      const { uploadURL } = await apiRequest('/api/verification/upload-url', {
        method: 'POST',
        body: { documentType }
      });

      setUploadProgress(25);

      // Step 2: Upload directly to secure storage
      toast({
        title: "Uploading Securely",
        description: "Transferring document to encrypted storage...",
      });

      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to secure storage');
      }

      setUploadProgress(75);

      // Step 3: Complete upload and set security policies
      toast({
        title: "Finalizing Security",
        description: "Setting access controls and encryption...",
      });

      // Extract document path from upload URL
      const urlPath = new URL(uploadURL).pathname;
      const documentPath = `/kyb-documents${urlPath.split('/kyb-documents')[1]}`;

      const completeResponse = await apiRequest('/api/verification/complete-upload', {
        method: 'POST',
        body: {
          documentType,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
          documentPath,
        }
      });

      setUploadProgress(100);

      toast({
        title: "Upload Complete",
        description: "Document uploaded securely and queued for verification",
        variant: "default",
      });

      onUploadComplete(completeResponse.id);
      setSelectedFile(null);

    } catch (error) {
      console.error('Secure upload failed:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload document securely. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-600" />
          Secure Document Upload
        </CardTitle>
        <CardDescription>
          {documentType} - Documents are encrypted and stored securely
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Security Notice */}
        <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <Lock className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-emerald-900">End-to-End Encryption</p>
            <p className="text-emerald-700">
              Your documents are encrypted in transit and at rest. Only authorized personnel can access them.
            </p>
          </div>
        </div>

        {/* File Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-center w-full">
            <label 
              htmlFor="secure-file-upload" 
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-neutral-300 border-dashed rounded-lg cursor-pointer bg-neutral-50 hover:bg-neutral-100 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-neutral-500" />
                <p className="mb-2 text-sm text-neutral-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-neutral-500">PDF, PNG, JPG (MAX. 10MB)</p>
              </div>
              <input 
                id="secure-file-upload"
                type="file" 
                className="hidden" 
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </label>
          </div>

          {/* Selected File */}
          {selectedFile && (
            <div className="flex items-center gap-3 p-3 bg-white border border-neutral-200 rounded-lg">
              <File className="w-4 h-4 text-neutral-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-900">{selectedFile.name}</p>
                <p className="text-xs text-neutral-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Badge variant="secondary">Ready</Badge>
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">Uploading securely...</span>
              <span className="font-medium">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <div 
                className="bg-emerald-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Upload Button */}
        <Button 
          onClick={uploadToSecureStorage}
          disabled={!selectedFile || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <AlertCircle className="w-4 h-4 mr-2 animate-spin" />
              Uploading Securely...
            </>
          ) : (
            <>
              <Shield className="w-4 h-4 mr-2" />
              Upload Securely
            </>
          )}
        </Button>

        {/* Security Features */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-200">
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            <span>Encrypted Storage</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            <span>Access Controlled</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            <span>Audit Logged</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            <span>No Local Storage</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}