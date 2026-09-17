import { useState } from "react";
import { useMutation,useQueryClient } from "@tanstack/react-query";
import { Dialog,DialogContent,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Card,CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
interface Props{offer:any;isOpen:boolean;onClose():void}
export default function PlaceOrderModal({offer,isOpen,onClose}:Props){
  const[quantity,setQuantity]=useState(""),[confirmed,setConfirmed]=useState(false);const{toast}=useToast(),query=useQueryClient();
  const available=Number(offer?.quantity?.value??offer?.quantity),minimum=Number(offer?.terms?.minimumQuantity??1),price=Number(offer?.pricing?.amountPerUnit??offer?.price),amount=Number(quantity)*price;
  const valid=Number(quantity)>=minimum&&Number(quantity)<=available&&Number(quantity)>0;
  const mutation=useMutation({mutationFn:()=>apiRequest("POST","/api/orders",{offerId:offer.id,quantity}),onSuccess:async()=>{await query.invalidateQueries({queryKey:["/api/orders"]});toast({title:"Order created",description:"The seller can now review and accept this authoritative V2 order."});onClose();},onError:(error)=>toast({title:"Order not created",description:error instanceof Error?error.message:"Your Organization is not currently eligible for this order.",variant:"destructive"})});
  if (!offer) return null;
  return <Dialog open={isOpen} onOpenChange={onClose}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Place V2 order</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-sm text-neutral-600">TUTELA will recheck the seller publication, your Organization participation, the offer version, validity, quantity and enforcement state on the server.</p><div><Label htmlFor="order-quantity">Quantity ({offer.quantity?.unit??offer.unit})</Label><Input id="order-quantity" inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder={`${minimum}–${available}`}/><p className="mt-1 text-xs text-neutral-500">Minimum {minimum} · Available {available}</p></div><Card><CardContent className="space-y-2 pt-5 text-sm"><div className="flex justify-between"><span>Unit price</span><strong>{price.toLocaleString()} {offer.pricing?.currency??offer.currency}</strong></div><div className="flex justify-between"><span>Estimated total</span><strong>{Number.isFinite(amount)?amount.toLocaleString():"—"} {offer.pricing?.currency??offer.currency}</strong></div><p className="text-xs text-neutral-500">The backend calculates and fingerprints the decimal-safe accepted terms; this display is informational.</p></CardContent></Card><label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={value=>setConfirmed(value===true)}/><span>I confirm the published offer terms and requested quantity.</span></label><Button className="w-full" disabled={!valid||!confirmed||mutation.isPending} onClick={()=>mutation.mutate()}>{mutation.isPending?"Creating order…":"Create order"}</Button></div></DialogContent></Dialog>;
}
