import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Calendar, Clock, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface DeliveryTermsSummaryProps {
  offer: {
    deliveryTerms?: string;
    location: string;
    validUntil?: string;
    paymentTerms?: string;
  };
  incoterm?: string;
  deliveryWindow?: {
    start: string;
    end: string;
  };
  laytime?: {
    loading?: number;
    discharge?: number;
  };
  demurrage?: number;
}

export function DeliveryTermsSummary({ 
  offer, 
  incoterm = "FOB", 
  deliveryWindow,
  laytime,
  demurrage 
}: DeliveryTermsSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const windowStart = deliveryWindow?.start || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = deliveryWindow?.end || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardContent className="p-4">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          {/* Summary Line - Always Visible */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm font-medium text-blue-900">
              <MapPin className="h-4 w-4" />
              <span>{incoterm}</span>
              <span>•</span>
              <span>{offer.location}</span>
              <span>•</span>
              <span>{formatDate(windowStart)} to {formatDate(windowEnd)}</span>
            </div>
            
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-blue-700 hover:text-blue-900">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          {/* Detailed Information - Collapsible */}
          <CollapsibleContent className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-blue-200">
              {/* Delivery Terms */}
              <div className="space-y-3">
                <h4 className="font-medium text-blue-900 text-sm">Delivery Terms</h4>
                
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <div className="text-xs text-blue-600">Incoterm & Location</div>
                    <div className="text-sm font-medium">{incoterm} {offer.location}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <div className="text-xs text-blue-600">Delivery Window</div>
                    <div className="text-sm">{formatDate(windowStart)} - {formatDate(windowEnd)}</div>
                  </div>
                </div>

                {offer.deliveryTerms && (
                  <div className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                    {offer.deliveryTerms}
                  </div>
                )}
              </div>

              {/* Laytime & Commercial Terms */}
              <div className="space-y-3">
                <h4 className="font-medium text-blue-900 text-sm">Commercial Terms</h4>
                
                {laytime && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <div className="text-xs text-blue-600">Laytime</div>
                      <div className="text-sm">
                        {laytime.loading && `Loading: ${laytime.loading}h`}
                        {laytime.loading && laytime.discharge && " • "}
                        {laytime.discharge && `Discharge: ${laytime.discharge}h`}
                      </div>
                    </div>
                  </div>
                )}

                {demurrage && (
                  <div className="flex items-start gap-2">
                    <DollarSign className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <div className="text-xs text-blue-600">Demurrage</div>
                      <div className="text-sm">${demurrage.toLocaleString()}/day</div>
                    </div>
                  </div>
                )}

                {offer.paymentTerms && (
                  <div className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                    <strong>Payment:</strong> {offer.paymentTerms}
                  </div>
                )}

                {offer.validUntil && (
                  <div className="text-xs text-orange-700 bg-orange-100 p-2 rounded">
                    <strong>Valid Until:</strong> {formatDate(offer.validUntil)}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}