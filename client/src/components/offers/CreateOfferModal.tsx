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
  quantity: z.string().min(1, "Quantity is required").refine((value) => parseFloat(value) > 0, {
    message: "Quantity must be greater than 0",
  }),
  unit: z.string().min(1, "Unit is required"),
  pricePerUnit: z.string().min(1, "Price per unit is required"),
  currency: z.string().default("USD"),
  location: z.string().min(1, "Location is required"),
  validUntil: z.string().optional(),
  minQuantity: z.string().optional(),
  deliveryTerms: z.string().optional(),
  paymentTerms: z.string().optional(),
  pricingMode: z.enum(["fixed", "negotiable", "indicative"]),
  visibilityMode: z.enum(["public", "semi_anonymous", "full_anonymous"]),
  identityRevealStage: z.enum(["marketplace", "negotiation", "commercial_alignment", "contracting"]),
  paymentMethod: z.enum(["LC", "SBLC", "CAD", "Escrow", "TT"]),
  shippingMethod: z.enum(["bulk", "container", "tanker", "truck", "rail"]),
  incoterm: z.enum(["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"]),
}).superRefine((data, ctx) => {
  const price = parseFloat(data.pricePerUnit);
  if ((data.pricingMode === "fixed" || data.pricingMode === "negotiable") && !(price > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Price must be greater than 0 for fixed and negotiable offers",
      path: ["pricePerUnit"],
    });
  }

  if (data.minQuantity && parseFloat(data.minQuantity) < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Minimum quantity cannot be negative",
      path: ["minQuantity"],
    });
  }
});

interface CreateOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  commodities: any[];
}

export default function CreateOfferModal({ isOpen, onClose, commodities }: CreateOfferModalProps) {
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
      pricingMode: "fixed",
      visibilityMode: "semi_anonymous",
      identityRevealStage: "commercial_alignment",
      paymentMethod: "LC",
      shippingMethod: "bulk",
      incoterm: "FOB",
    },
  });

  const createOfferMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createOfferSchema>) => {
      const paymentTerms = [data.paymentMethod, data.paymentTerms].filter(Boolean).join(" - ");
      const deliveryTerms = [`${data.incoterm} / ${data.shippingMethod}`, data.deliveryTerms]
        .filter(Boolean)
        .join(" - ");
      // Commercial model fields are currently mapped into legacy offer fields until backend schema supports persisted commercial metadata.
      const payload = {
        commodityId: data.commodityId,
        type: data.type,
        unit: data.unit,
        currency: data.currency,
        location: data.location,
        paymentTerms,
        deliveryTerms,
        quantity: parseFloat(data.quantity),
        pricePerUnit: parseFloat(data.pricePerUnit),
        minQuantity: data.minQuantity ? parseFloat(data.minQuantity) : undefined,
        validUntil: data.validUntil ? new Date(data.validUntil).toISOString() : undefined,
      };
      const response = await apiRequest("POST", "/api/offers", payload);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Offer Created",
        description: "Your commodity offer has been created successfully.",
      });
      onClose();
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/offers/search"] });
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

  const pricingModes = [
    { value: "fixed", label: "Fixed" },
    { value: "negotiable", label: "Negotiable" },
    { value: "indicative", label: "Indicative" },
  ];

  const visibilityModes = [
    { value: "public", label: "Public" },
    { value: "semi_anonymous", label: "Semi Anonymous" },
    { value: "full_anonymous", label: "Full Anonymous" },
  ];

  const identityRevealStages = [
    { value: "marketplace", label: "Marketplace" },
    { value: "negotiation", label: "Negotiation" },
    { value: "commercial_alignment", label: "Commercial Alignment" },
    { value: "contracting", label: "Contracting" },
  ];

  const paymentMethods = ["LC", "SBLC", "CAD", "Escrow", "TT"];
  const shippingMethods = ["bulk", "container", "tanker", "truck", "rail"];
  const incoterms = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"];

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
            <section className="space-y-4 rounded-lg border border-slate-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Basic Offer</h3>
                <p className="text-xs text-slate-500">Core commodity, quantity, price, and location details.</p>
              </div>

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
                      <p className="text-xs text-slate-500">Required while the legacy backend still requires price.</p>
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
            </section>

            <section className="space-y-4 rounded-lg border border-slate-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Commercial Model</h3>
                <p className="text-xs text-slate-500">Pricing mode controls buyer actions. Visibility controls identity exposure.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="pricingMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pricing Mode</FormLabel>
                      <FormControl>
                        <select className="tutela-form-select" {...field}>
                          {pricingModes.map((mode) => (
                            <option key={mode.value} value={mode.value}>
                              {mode.label}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <p className="text-xs text-slate-500">Fixed, negotiable, or indicative.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="visibilityMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visibility Mode</FormLabel>
                      <FormControl>
                        <select className="tutela-form-select" {...field}>
                          {visibilityModes.map((mode) => (
                            <option key={mode.value} value={mode.value}>
                              {mode.label}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <p className="text-xs text-slate-500">Controls what buyers see.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="identityRevealStage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identity Reveal Stage</FormLabel>
                      <FormControl>
                        <select className="tutela-form-select" {...field}>
                          {identityRevealStages.map((stage) => (
                            <option key={stage.value} value={stage.value}>
                              {stage.label}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <p className="text-xs text-slate-500">When company identity may be disclosed.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-slate-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Trade Terms</h3>
                <p className="text-xs text-slate-500">Structured terms are mapped into legacy payment and delivery text.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <FormControl>
                        <select className="tutela-form-select" {...field}>
                          {paymentMethods.map((method) => (
                            <option key={method} value={method}>
                              {method}
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
                  name="shippingMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shipping Method</FormLabel>
                      <FormControl>
                        <select className="tutela-form-select" {...field}>
                          {shippingMethods.map((method) => (
                            <option key={method} value={method}>
                              {method}
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
                  name="incoterm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incoterm</FormLabel>
                      <FormControl>
                        <select className="tutela-form-select" {...field}>
                          {incoterms.map((incoterm) => (
                            <option key={incoterm} value={incoterm}>
                              {incoterm}
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
                name="paymentTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional payment details..."
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deliveryTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Port, timing, inspection, or delivery notes..."
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4 rounded-lg border border-slate-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Validity</h3>
                <p className="text-xs text-slate-500">Optional commercial limits for the offer.</p>
              </div>

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
            </section>
            
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
