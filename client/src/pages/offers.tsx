import { Navigate, useLocation } from "react-router-dom";
import { ROUTES, ROUTE_ALIASES } from "@/config/routes";

export default function OffersRedirect() {
  const { search } = useLocation();
  const baseRedirect = ROUTE_ALIASES[ROUTES.offers] ?? ROUTES.marketplace;
  const redirectTarget = search ? `${baseRedirect}${search}` : baseRedirect;

  return <Navigate to={redirectTarget} replace />;
}
