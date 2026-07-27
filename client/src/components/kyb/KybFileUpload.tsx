import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  RotateCcw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { KybFile } from '@/types/kyb';
import { ALLOWED_FILE_TYPES, FILE_SIZE_LIMIT } from '@/types/kyb';

interface KybFileUploadProps {
  stepId: string;
  fileKind: {
    id: string;
    label: string;
    required: boolean;
    multiple?: boolean;
  };
  files: KybFile[];
  onFilesAdd: (stepId: string, kind: string, files: FileList) => void;
  onFileRemove: (fileId: string) => void;
  onFileReplace: (fileId: string, newFile: File) => void;
}

export default function KybFileUpload({
  stepId,
  fileKind,
  files,
  onFilesAdd,
  onFileRemove,
  onFileReplace
}: KybFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceFileId = useRef<string>('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      onFilesAdd(stepId, fileKind.id, selectedFiles);
    }
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleReplaceFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && replaceFileId.current) {
      onFileReplace(replaceFileId.current, selectedFile);
    }
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const triggerFileReplace = (fileId: string) => {
    replaceFileId.current = fileId;
    replaceInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const canAddMore = fileKind.multiple || files.length === 0;
  const validFiles = files.filter(f => f.valid);
  const hasRequiredFiles = !fileKind.required || validFiles.length > 0;

  return (
    <div className="space-y-3">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_FILE_TYPES.join(',')}
        multiple={fileKind.multiple}
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept={ALLOWED_FILE_TYPES.join(',')}
        onChange={handleReplaceFileSelect}
        className="hidden"
      />

      {/* Upload Button */}
      {canAddMore && (
        <Button
          variant="outline"
          onClick={triggerFileUpload}
          className="w-full border-dashed border-2 h-20 flex flex-col items-center justify-center gap-2 hover:bg-gray-50"
        >
          <Upload className="h-6 w-6 text-gray-400" />
          <div className="text-center">
            <div className="text-sm font-medium">
              {files.length === 0 ? 'Upload Files' : 'Add More Files'}
            </div>
            <div className="text-xs text-gray-500">
              PDF, JPG, PNG up to {FILE_SIZE_LIMIT / 1024 / 1024}MB
            </div>
          </div>
        </Button>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                file.valid 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-red-200 bg-red-50'
              }`}
            >
              {/* File Icon/Preview */}
              <div className="flex-shrink-0">
                {file.mime.startsWith('image/') ? (
                  file.previewUrl ? (
                    <div className="w-10 h-10 rounded overflow-hidden">
                      <img 
                        src={file.previewUrl} 
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <ImageIcon className="h-10 w-10 text-blue-500" />
                  )
                ) : (
                  <FileText className="h-10 w-10 text-red-500" />
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  {file.valid ? (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                {file.error && (
                  <p className="text-xs text-red-600 mt-1">{file.error}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => triggerFileReplace(file.id)}
                  className="h-8 w-8 p-0"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFileRemove(file.id)}
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status Badge */}
      <div className="flex justify-end">
        {hasRequiredFiles ? (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            {fileKind.required ? 'Required files uploaded' : 'Files uploaded'}
          </Badge>
        ) : (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Required files missing
          </Badge>
        )}
      </div>
    </div>
  );
}