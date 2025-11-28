import { Navigate, useLocation } from "react-router-dom";
import { ROUTES, ROUTE_ALIASES } from "@/config/routes";

export default function CommoditiesRedirect() {
  const { search } = useLocation();
  const baseRedirect = ROUTE_ALIASES[ROUTES.commodities] ?? ROUTES.marketplace;
  const hasQuery = baseRedirect.includes("?");
  const redirectTarget = search
    ? `${baseRedirect}${hasQuery ? "&" : "?"}${search.slice(1)}`
    : baseRedirect;

  return <Navigate to={redirectTarget} replace />;
}
