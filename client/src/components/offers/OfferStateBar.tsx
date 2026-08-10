import { useCountdown } from "@/hooks/useCountdown";
import { Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { marketStore, type Reservation, type Negotiation } from "@/lib/marketStore";
import { useEffect, useState } from "react";

interface OfferStateBarProps {
  offerId: string;
  buyerId?: string;
  onProceedToContracting?: (reservationId?: string) => void;
}

export function OfferStateBar({ offerId, buyerId, onProceedToContracting }: OfferStateBarProps) {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [negotiation, setNegotiation] = useState<Negotiation | null>(null);

  useEffect(() => {
    if (!buyerId) return;

    const updateState = () => {
      const reservations = marketStore.reservations();
      const negotiations = marketStore.negotiations();

      // Find active reservation
      const activeRes = reservations.find(r => 
        r.offerId === offerId && 
        r.buyerId === buyerId && 
        r.status === "active" &&
        new Date(r.expiresAt).getTime() > Date.now()
      );

      // Find open/accepted negotiation
      const activeNeg = negotiations.find(n => 
        n.offerId === offerId && 
        n.buyerId === buyerId && 
        (n.status === "open" || n.status === "accepted")
      );

      setReservation(activeRes || null);
      setNegotiation(activeNeg || null);

      // Clean up expired items
      if (activeRes && new Date(activeRes.expiresAt).getTime() <= Date.now()) {
        const updatedReservations = reservations.map(r => 
          r.id === activeRes.id ? { ...r, status: "expired" as const } : r
        );
        marketStore.saveReservations(updatedReservations);
        setReservation(null);
      }

      if (activeNeg && activeNeg.status === "open" && new Date(activeNeg.expiresAt).getTime() <= Date.now()) {
        const updatedNegotiations = negotiations.map(n => 
          n.id === activeNeg.id ? { ...n, status: "expired" as const } : n
        );
        marketStore.saveNegotiations(updatedNegotiations);
        setNegotiation(null);
      }
    };

    updateState();
    const interval = setInterval(updateState, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [offerId, buyerId]);

  const reservationCountdown = useCountdown(reservation?.expiresAt || "");
  const negotiationCountdown = useCountdown(negotiation?.expiresAt || "");

  // Auto-accepted negotiation
  if (negotiation?.status === "accepted" && negotiation.decision?.autoAccepted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-900">Accepted (Auto)</span>
            <span className="text-sm text-green-700">— proceed to contracting</span>
          </div>
          {onProceedToContracting && (
            <Button 
              onClick={() => onProceedToContracting()}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Proceed to Contracting
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Active reservation
  if (reservation && !reservationCountdown.done) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-orange-600" />
            <span className="font-medium text-orange-900">
              Reserved {reservationCountdown.label}
            </span>
            <span className="text-sm text-orange-700">
              — Complete contracting before expiry
            </span>
          </div>
          {onProceedToContracting && (
            <Button 
              onClick={() => onProceedToContracting(reservation.id)}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Complete Contracting
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Open negotiation
  if (negotiation?.status === "open" && !negotiationCountdown.done) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-900">
            Negotiation Round {negotiation.round}
          </span>
          <span className="text-sm text-blue-700">
            — awaiting seller (expires in {negotiationCountdown.label})
          </span>
        </div>
      </div>
    );
  }

  return null;
}
