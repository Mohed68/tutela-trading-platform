import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

interface UploadedFile {
  file: File;
  documentType: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

export default function DocumentUpload() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const documentTypes = [
    { value: "business_license", label: "Business License" },
    { value: "financial_statement", label: "Financial Statement" },
    { value: "tax_certificate", label: "Tax Certificate" },
    { value: "insurance_document", label: "Insurance Document" },
    { value: "bank_statement", label: "Bank Statement" },
    { value: "other_certificate", label: "Other Certificate" },
  ];

  const uploadMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) => {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", documentType);

      const response = await fetch("/api/verification/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      setUploadedFiles(prev =>
        prev.map(f =>
          f.file === variables.file
            ? { ...f, status: "success" }
            : f
        )
      );
      toast({
        title: "Document Uploaded",
        description: "Your document has been uploaded and is being processed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/verification/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
    },
    onError: (error, variables) => {
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

      setUploadedFiles(prev =>
        prev.map(f =>
          f.file === variables.file
            ? { ...f, status: "error", error: error.message }
            : f
        )
      );
      toast({
        title: "Upload Failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload PDF or image files only.",
          variant: "destructive",
        });
        return false;
      }

      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: "Please upload files smaller than 10MB.",
          variant: "destructive",
        });
        return false;
      }

      return true;
    });

    const newFiles: UploadedFile[] = validFiles.map(file => ({
      file,
      documentType: documentTypes[0].value,
      status: "pending",
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileToRemove: File) => {
    setUploadedFiles(prev => prev.filter(f => f.file !== fileToRemove));
  };

  const updateDocumentType = (file: File, documentType: string) => {
    setUploadedFiles(prev =>
      prev.map(f =>
        f.file === file ? { ...f, documentType } : f
      )
    );
  };

  const uploadFile = (file: File, documentType: string) => {
    setUploadedFiles(prev =>
      prev.map(f =>
        f.file === file ? { ...f, status: "uploading" } : f
      )
    );
    uploadMutation.mutate({ file, documentType });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Upload className="mr-2 h-5 w-5 text-blue-600" />
          Upload Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Upload Area */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Drop files here or click to upload
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Supports PDF, JPEG, PNG files up to 10MB
          </p>
          <Button 
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Select Files
          </Button>
        </div>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="mt-6 space-y-4">
            <h4 className="font-medium text-gray-900">Files to Upload</h4>
            {uploadedFiles.map((uploadedFile, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <FileText className="h-8 w-8 text-blue-600 mt-1" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{uploadedFile.file.name}</p>
                      <p className="text-sm text-gray-600">
                        {formatFileSize(uploadedFile.file.size)}
                      </p>
                      
                      {uploadedFile.status === "pending" && (
                        <div className="mt-2 flex items-center space-x-2">
                          <select
                            value={uploadedFile.documentType}
                            onChange={(e) => updateDocumentType(uploadedFile.file, e.target.value)}
                            className="tutela-form-select text-sm"
                          >
                            {documentTypes.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={() => uploadFile(uploadedFile.file, uploadedFile.documentType)}
                            className="tutela-btn-primary"
                          >
                            Upload
                          </Button>
                        </div>
                      )}
                      
                      {uploadedFile.status === "error" && uploadedFile.error && (
                        <p className="text-sm text-red-600 mt-1">{uploadedFile.error}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {uploadedFile.status === "uploading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    )}
                    {uploadedFile.status === "success" && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {uploadedFile.status === "error" && (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    
                    <Badge 
                      className={`text-xs ${
                        uploadedFile.status === "success" 
                          ? "bg-green-100 text-green-800"
                          : uploadedFile.status === "error"
                          ? "bg-red-100 text-red-800"
                          : uploadedFile.status === "uploading"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {uploadedFile.status}
                    </Badge>
                    
                    {uploadedFile.status !== "uploading" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadedFile.file)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
