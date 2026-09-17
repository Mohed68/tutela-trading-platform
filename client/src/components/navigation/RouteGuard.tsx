import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
interface Props{children:React.ReactNode;requireVerified?:boolean;requireRoles?:string[];fallbackPath?:string}
export function RouteGuard({children,requireVerified=false,requireRoles=[],fallbackPath="/verification"}:Props){
  const[,navigate]=useLocation();const auth=useAuth();const organization=useOrganizationContext(auth.isAuthenticated);
  const hasOrganization=organization.context?.state==="available";
  const denied=!auth.isLoading&&!organization.isLoading&&(!auth.isAuthenticated||(requireVerified&&!hasOrganization)||requireRoles.length>0);
  React.useEffect(()=>{if(denied)navigate(!auth.isAuthenticated?"/login":requireRoles.length?"/dashboard":fallbackPath);},[denied,auth.isAuthenticated,requireRoles.length,fallbackPath,navigate]);
  if(auth.isLoading||organization.isLoading||denied)return null;return <>{children}</>;
}
// Historical reads remain available regardless of current trust or membership.
// Every mutation independently requires current server-authoritative eligibility.
export function VerifiedRoute({children,fallbackPath}:{children:React.ReactNode;fallbackPath?:string}){return <RouteGuard fallbackPath={fallbackPath}>{children}</RouteGuard>}
export function PartnerRoute({children}:{children:React.ReactNode}){return <RouteGuard requireRoles={["unsupported-future-role"]}>{children}</RouteGuard>}
export function AdminRoute({children}:{children:React.ReactNode}){
  const[,navigate]=useLocation();const[state,setState]=React.useState<"loading"|"allowed"|"denied">("loading");
  React.useEffect(()=>{let current=true;fetch("/admin/auth/info",{credentials:"include"}).then(response=>{if(!current)return;if(response.ok)setState("allowed");else{setState("denied");navigate(response.status===401?"/login":"/dashboard");}}).catch(()=>{if(current){setState("denied");navigate("/dashboard");}});return()=>{current=false};},[navigate]);
  return state==="allowed"?<>{children}</>:state==="loading"?<p className="p-8 text-sm text-neutral-600">Checking platform authority…</p>:null;
}
export function ComplianceRoute({children}:{children:React.ReactNode}){return <RouteGuard requireRoles={["unsupported-legacy-compliance-role"]}>{children}</RouteGuard>}
