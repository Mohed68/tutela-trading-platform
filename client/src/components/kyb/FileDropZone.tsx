// client/src/components/kyb/FileDropZone.tsx
import { useRef, useState } from "react";
import { Upload, FileText, Image as ImageIcon, Trash2 } from "lucide-react";

type Item = {
  id: string; name: string; mime: string; size: number; previewUrl?: string; error?: string;
};

export function FileDropZone({
  items, onAdd, onRemove, accept = ".pdf,.jpg,.jpeg,.png", maxSizeMB = 10,
}: {
  items: Item[];
  onAdd: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  accept?: string;
  maxSizeMB?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const openPicker = () => inputRef.current?.click();
  const stop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => { stop(e); setDrag(false); onAdd(e.dataTransfer.files); };

  return (
    <div>
      <div
        onDragOver={(e)=>{stop(e); setDrag(true);}}
        onDragLeave={(e)=>{stop(e); setDrag(false);}}
        onDrop={onDrop}
        className={`rounded-xl border border-dashed p-10 text-center ${drag ? "bg-gray-50 border-blue-300" : "bg-white"}`}
      >
        <Upload className="mx-auto mb-3 h-6 w-6 text-gray-500" />
        <p className="text-sm text-gray-700">Drop files here or click to upload</p>
        <p className="text-xs text-gray-500">Supports PDF/JPEG/PNG up to {maxSizeMB}MB</p>
        <button onClick={openPicker} className="mt-3 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">Select Files</button>
        <input ref={inputRef} type="file" multiple accept={accept} hidden onChange={(e)=>onAdd(e.target.files)} />
      </div>

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map(f => (
            <li key={f.id} className={`flex items-center justify-between rounded-md border p-2 ${f.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              <div className="flex items-center gap-2">
                {f.mime.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                <span className="text-sm">{f.name}</span>
                <span className="text-xs text-gray-500">({Math.round(f.size / 1024)}KB)</span>
                {f.error && <span className="text-xs text-red-600">· {f.error}</span>}
              </div>
              <button onClick={()=>onRemove(f.id)} className="text-gray-600 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}