import React from "react";
import type { ReviewResult } from "@/lib/aiReview";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export function ReviewDialog({ open, onClose, result, onAcceptVerified }: {
  open: boolean; 
  result: ReviewResult | null; 
  onClose: () => void; 
  onAcceptVerified: () => void;
}) {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl border shadow-xl w-[min(92vw,640px)] p-5">
        <div className="flex items-center gap-3 mb-3">
          {result?.pass ? (
            <CheckCircle2 className="text-emerald-600" />
          ) : (
            <AlertTriangle className="text-amber-600" />
          )}
          <h3 className="text-lg font-semibold">Automated Document Review</h3>
          <div className="ml-auto text-sm text-gray-600">Score: {result?.score ?? 0}%</div>
        </div>
        
        <div className="max-h-[50vh] overflow-auto">
          {result?.issues.length ? (
            <ul className="space-y-2">
              {result.issues.map((i, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${
                    i.severity === "error" ? "bg-red-500" : "bg-amber-500"
                  }`} />
                  <span>{i.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-700">All checks passed.</p>
          )}
        </div>
        
        <div className="mt-4 flex items-center gap-2">
          <button 
            className="rounded-md border px-3 py-1.5" 
            onClick={onClose}
          >
            Close
          </button>
          <button 
            className="ml-auto rounded-md bg-emerald-600 text-white px-3 py-1.5 disabled:opacity-50"
            onClick={onAcceptVerified} 
            disabled={!result?.pass}
          >
            {result?.pass ? "Confirm & Set as Verified" : "Fix Issues First"}
          </button>
        </div>
      </div>
    </div>
  );
}