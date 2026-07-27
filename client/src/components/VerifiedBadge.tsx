import React from "react";
import { ShieldCheck } from "lucide-react";

export function VerifiedBadge() {
  const [isVerified, setIsVerified] = React.useState(false);
  
  React.useEffect(() => {
    const check = () => {
      const byBody = document.body.classList.contains("state-verified");
      const byLS = localStorage.getItem("tutela_kyb_state") === "verified";
      setIsVerified(byBody || byLS);
    };
    
    check();
    
    const onStorage = () => check();
    window.addEventListener("storage", onStorage);
    
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  
  if (!isVerified) return null;
  
  return (
    <div className="rounded-2xl border bg-white/80 backdrop-blur p-3 shadow-md flex items-center gap-3 w-fit">
      <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-inner">
        <ShieldCheck className="text-white h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-semibold text-emerald-700">Account Verified</div>
        <div className="text-xs text-gray-600 -mt-0.5">KYB review completed</div>
      </div>
    </div>
  );
}