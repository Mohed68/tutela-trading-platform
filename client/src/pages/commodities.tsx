import { Navigate, useLocation } from "react-router-dom";
import { ROUTES } from "@/config/routes";

export default function CommoditiesRedirect() {
  const { search } = useLocation();
  const hasQuery = ROUTES.commodities.includes("?");
  const redirectTarget = search
    ? `${ROUTES.commodities}${hasQuery ? "&" : "?"}${search.slice(1)}`
    : ROUTES.commodities;

  return <Navigate to={redirectTarget} replace />;
}
