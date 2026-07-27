import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

const createOfferSchema = z.object({
  commodityId: z.string().min(1, "Commodity is required"),
  type: z.enum(["buy", "sell"], { required_error: "Offer type is required" }),
  quantity: z.string().min(1, "Quantity is required"),
  unit: z.string().min(1, "Unit is required"),
  pricePerUnit: z.string().min(1, "Price per unit is required"),
  currency: z.string().default("USD"),
  location: z.string().min(1, "Location is required"),
  validUntil: z.string().optional(),
  minQuantity: z.string().optional(),
  deliveryTerms: z.string().optional(),
  paymentTerms: z.string().optional(),
});

interface CreateOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  commodities: any[];
  onOfferCreated?: (offer: any) => void;
}

export default function CreateOfferModal({ isOpen, onClose, commodities, onOfferCreated }: CreateOfferModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof createOfferSchema>>({
    resolver: zodResolver(createOfferSchema),
    defaultValues: {
      commodityId: "",
      type: "sell",
      quantity: "",
      unit: "",
      pricePerUnit: "",
      currency: "USD",
      location: "",
      validUntil: "",
      minQuantity: "",
      deliveryTerms: "",
      paymentTerms: "",
    },
  });

  const createOfferMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createOfferSchema>) => {
      const payload = {
        ...data,
        quantity: parseFloat(data.quantity),
        pricePerUnit: parseFloat(data.pricePerUnit),
        minQuantity: data.minQuantity ? parseFloat(data.minQuantity) : undefined,
        validUntil: data.validUntil ? new Date(data.validUntil).toISOString() : undefined,
      };
      const response = await apiRequest("POST", "/api/offers", payload);
      return response.json();
    },
    onSuccess: (createdOffer) => {
      toast({
        title: "Offer Created",
        description: "Your commodity offer has been created successfully. Document verification is required to activate trading.",
      });
      onClose();
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/offers"] });
      
      // Automatically trigger document verification process
      if (onOfferCreated) {
        onOfferCreated(createdOffer);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create offer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const units = [
    { value: "BBL", label: "BBL (Barrels)" },
    { value: "MT", label: "MT (Metric Tons)" },
    { value: "KG", label: "KG (Kilograms)" },
    { value: "OZ", label: "OZ (Ounces)" },
    { value: "LB", label: "LB (Pounds)" },
    { value: "GAL", label: "GAL (Gallons)" },
  ];

  const currencies = [
    { value: "USD", label: "USD" },
    { value: "EUR", label: "EUR" },
    { value: "GBP", label: "GBP" },
    { value: "JPY", label: "JPY" },
  ];

  const onSubmit = (data: z.infer<typeof createOfferSchema>) => {
    createOfferMutation.mutate(data);
  };

  const handleClose = () => {
    onClose();
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Commodity Offer</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="commodityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commodity *</FormLabel>
                    <FormControl>
                      <select className="tutela-form-select" {...field}>
                        <option value="">Select Commodity</option>
                        {commodities.map((commodity) => (
                          <option key={commodity.id} value={commodity.id}>
                            {commodity.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Offer Type *</FormLabel>
                    <FormControl>
                      <select className="tutela-form-select" {...field}>
                        <option value="buy">Buy</option>
                        <option value="sell">Sell</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="1000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit *</FormLabel>
                    <FormControl>
                      <select className="tutela-form-select" {...field}>
                        <option value="">Select Unit</option>
                        {units.map((unit) => (
                          <option key={unit.value} value={unit.value}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pricePerUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per Unit *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="72.50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <select className="tutela-form-select" {...field}>
                        {currencies.map((currency) => (
                          <option key={currency.value} value={currency.value}>
                            {currency.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location *</FormLabel>
                  <FormControl>
                    <Input placeholder="Houston, TX" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="validUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid Until</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="deliveryTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Terms</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="FOB Houston, delivery within 30 days..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="paymentTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Terms</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Letter of Credit, Net 30 days..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createOfferMutation.isPending}
                className="tutela-btn-primary"
              >
                {createOfferMutation.isPending ? "Creating..." : "Create Offer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
