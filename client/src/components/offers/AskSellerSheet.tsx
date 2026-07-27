import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface AskSellerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  offer: {
    id: string;
    commodity?: string;
    specifications?: any;
    seller?: string;
    location: string;
  };
  buyerId?: string;
}

export function AskSellerSheet({ 
  isOpen, 
  onClose, 
  offer, 
  buyerId 
}: AskSellerSheetProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxLength = 250;
  const remainingChars = maxLength - message.length;

  const handleSubmit = async () => {
    if (!buyerId) {
      toast({
        title: "Authentication Required",
        description: "Please verify your account to continue",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter a message for the seller",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // In a real implementation, this would send to an API
      // For now, we'll just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Store in localStorage for demo purposes
      const messages = JSON.parse(localStorage.getItem('seller_messages') || '[]');
      const newMessage = {
        id: crypto.randomUUID(),
        offerId: offer.id,
        buyerId,
        message: message.trim(),
        timestamp: new Date().toISOString(),
        status: 'sent'
      };
      
      localStorage.setItem('seller_messages', JSON.stringify([...messages, newMessage]));

      toast({
        title: "Message Sent",
        description: "Your message has been sent to the seller",
      });

      setMessage("");
      onClose();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Send Failed",
        description: "Unable to send your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            <span>Ask Seller</span>
          </SheetTitle>
          <SheetDescription>
            Send a quick message to {offer.seller || "the seller"} about this offer
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-4">
          {/* Offer Context */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm font-medium">
              {(typeof offer.commodity === 'string' ? offer.commodity : (offer.commodity as any)?.name) || offer.specifications?.grade || "Commodity"}
            </div>
            <div className="text-xs text-gray-600">
              {offer.seller} • {offer.location}
            </div>
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">Your Message</Label>
            <Textarea
              id="message"
              placeholder="e.g., Can you provide additional specifications? What is your delivery timeline flexibility?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={maxLength}
              rows={6}
              className="resize-none"
            />
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">
                Keep it brief and specific
              </span>
              <span className={remainingChars < 20 ? "text-orange-600" : "text-gray-500"}>
                {remainingChars} characters remaining
              </span>
            </div>
          </div>

          {/* Guidelines */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-xs font-medium text-blue-900 mb-1">
              Good questions to ask:
            </div>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Additional technical specifications</li>
              <li>• Delivery timeline flexibility</li>
              <li>• Volume discounts availability</li>
              <li>• Quality certifications</li>
            </ul>
          </div>
        </div>

        <SheetFooter className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!message.trim() || isSubmitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}