import { Request } from "express";

export function getTenantId(req: Request): string | undefined {
  // For now, we don't have multi-tenancy, so return undefined
  // In the future, this can be extended to support demo/production tenants
  
  // Demo mode check (if needed)
  if (req.headers['x-demo'] === '1' || process.env.DEMO_MODE === 'true') {
    return process.env.DEMO_TENANT_ID || 'demo';
  }
  
  // Default tenant (production)
  return process.env.DEFAULT_TENANT_ID;
}