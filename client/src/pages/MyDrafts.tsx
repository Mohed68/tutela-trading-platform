import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FilePenLine, LockKeyhole, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  CreateDraftOfferRequest,
  DraftOfferDetailDto,
  DraftOfferOptionsDto,
  DraftOfferUnit,
  UpdateDraftOfferRequest,
} from "@shared/drafts";

interface DraftFormState {
  offerType: "buy" | "sell";
  commodityId: string;
  quantity: string;
  unit: DraftOfferUnit | "";
  amountPerUnit: string;
  location: string;
  validUntil: string;
}

const EMPTY_FORM: DraftFormState = {
  offerType: "sell",
  commodityId: "",
  quantity: "",
  unit: "",
  amountPerUnit: "",
  location: "",
  validUntil: "",
};

function localDateTime(value: string | null): string {
  return value ? value.slice(0, 16) : "";
}

function DraftForm({
  options,
  initial,
  submitLabel,
  pending,
  onCancel,
  onSubmit,
}: {
  options: DraftOfferOptionsDto;
  initial: DraftFormState;
  submitLabel: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (state: DraftFormState) => void;
}) {
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);

  const selectedCommodity = options.commodities.find(
    (commodity) => commodity.id === form.commodityId,
  );

  const update = <Key extends keyof DraftFormState>(
    key: Key,
    value: DraftFormState[Key],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.unit) return;
    onSubmit(form);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="draft-type">Offer type</Label>
          <select
            id="draft-type"
            className="tutela-form-select w-full"
            value={form.offerType}
            onChange={(event) =>
              update("offerType", event.target.value === "buy" ? "buy" : "sell")
            }
          >
            <option value="sell">Sell</option>
            <option value="buy">Buy</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="draft-commodity">Commodity</Label>
          <select
            id="draft-commodity"
            required
            className="tutela-form-select w-full"
            value={form.commodityId}
            onChange={(event) => {
              const commodity = options.commodities.find(
                (item) => item.id === event.target.value,
              );
              setForm((current) => ({
                ...current,
                commodityId: event.target.value,
                unit: commodity?.units[0] ?? "",
              }));
            }}
          >
            <option value="">Select a commodity</option>
            {options.commodities.map((commodity) => (
              <option key={commodity.id} value={commodity.id}>
                {commodity.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="draft-quantity">Quantity</Label>
          <Input
            id="draft-quantity"
            required
            inputMode="decimal"
            pattern="(?:0|[1-9][0-9]{0,12})(?:\.[0-9]{1,2})?"
            value={form.quantity}
            onChange={(event) => update("quantity", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="draft-unit">Unit</Label>
          <select
            id="draft-unit"
            required
            className="tutela-form-select w-full"
            value={form.unit}
            disabled={!selectedCommodity}
            onChange={(event) =>
              update(
                "unit",
                selectedCommodity?.units.find(
                  (unit) => unit === event.target.value,
                ) ?? "",
              )
            }
          >
            <option value="">Select a unit</option>
            {selectedCommodity?.units.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="draft-price">Price per unit</Label>
          <Input
            id="draft-price"
            required
            inputMode="decimal"
            pattern="(?:0|[1-9][0-9]{0,12})(?:\.[0-9]{1,2})?"
            value={form.amountPerUnit}
            onChange={(event) => update("amountPerUnit", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="draft-currency">Currency</Label>
          <Input
            id="draft-currency"
            value={options.currency}
            readOnly
            aria-readonly="true"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="draft-location">Location</Label>
          <Input
            id="draft-location"
            required
            maxLength={255}
            value={form.location}
            onChange={(event) => update("location", event.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="draft-valid-until">Valid until (optional)</Label>
          <Input
            id="draft-valid-until"
            type="datetime-local"
            value={form.validUntil}
            onChange={(event) => update("validUntil", event.target.value)}
          />
        </div>
      </div>
      <p className="text-sm text-neutral-500">
        This saves a private draft only. It does not submit, verify, activate,
        or publish the offer.
      </p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !form.unit}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function MyDrafts() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<DraftOfferDetailDto | null>(null);
  const [editing, setEditing] = useState(false);

  const optionsQuery = useQuery<DraftOfferOptionsDto>({
    queryKey: ["/api/drafts/options"],
  });
  const draftsQuery = useQuery<DraftOfferDetailDto[]>({
    queryKey: ["/api/drafts"],
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/overview"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async (form: DraftFormState) => {
      if (!form.unit || !optionsQuery.data) {
        throw new Error("Draft options are unavailable.");
      }
      const request: CreateDraftOfferRequest = {
        offerType: form.offerType,
        commodityId: form.commodityId,
        quantity: form.quantity,
        unit: form.unit,
        amountPerUnit: form.amountPerUnit,
        currency: optionsQuery.data.currency,
        location: form.location,
        ...(form.validUntil
          ? { validUntil: new Date(form.validUntil).toISOString() }
          : {}),
      };
      const response = await apiRequest("POST", "/api/drafts", request);
      return (await response.json()) as DraftOfferDetailDto;
    },
    onSuccess: async (draft) => {
      setCreateOpen(false);
      setSelected(draft);
      await refresh();
      toast({ title: "Draft saved", description: "Your offer remains private." });
    },
    onError: () =>
      toast({
        title: "Unable to save draft",
        description: "Review the fields and try again.",
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: async (form: DraftFormState) => {
      if (!selected || !form.unit || !optionsQuery.data) {
        throw new Error("Draft is unavailable.");
      }
      const request: UpdateDraftOfferRequest = {
        offerType: form.offerType,
        commodityId: form.commodityId,
        quantity: form.quantity,
        unit: form.unit,
        amountPerUnit: form.amountPerUnit,
        currency: optionsQuery.data.currency,
        location: form.location,
        validUntil: form.validUntil
          ? new Date(form.validUntil).toISOString()
          : null,
      };
      const response = await apiRequest(
        "PATCH",
        `/api/drafts/${encodeURIComponent(selected.id)}`,
        request,
      );
      return (await response.json()) as DraftOfferDetailDto;
    },
    onSuccess: async (draft) => {
      setSelected(draft);
      setEditing(false);
      await refresh();
      toast({ title: "Draft updated" });
    },
    onError: () =>
      toast({
        title: "Unable to update draft",
        description: "Review the fields and try again.",
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (draftId: string) => {
      await apiRequest("DELETE", `/api/drafts/${encodeURIComponent(draftId)}`);
    },
    onSuccess: async () => {
      setSelected(null);
      setEditing(false);
      await refresh();
      toast({ title: "Draft deleted" });
    },
    onError: () =>
      toast({
        title: "Unable to delete draft",
        description: "The draft was not deleted.",
        variant: "destructive",
      }),
  });

  const editInitial = useMemo<DraftFormState | null>(
    () =>
      selected
        ? {
            offerType: selected.offerType,
            commodityId: selected.commodity.id,
            quantity: selected.quantity.value,
            unit: selected.quantity.unit,
            amountPerUnit: selected.pricing.amountPerUnit,
            location: selected.location,
            validUntil: localDateTime(selected.validUntil),
          }
        : null,
    [selected],
  );

  const loading = optionsQuery.isLoading || draftsQuery.isLoading;
  const failed = optionsQuery.isError || draftsQuery.isError;
  const drafts = draftsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">My Drafts</h1>
          <p className="mt-2 text-neutral-600">
            Private offer drafts visible only to your account.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          disabled={!optionsQuery.data}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Draft
        </Button>
      </div>

      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Drafts are private and unpublished. No submission, verification, or
          marketplace publication occurs from this page.
        </p>
      </div>

      {loading && <p className="text-neutral-600">Loading drafts…</p>}
      {failed && (
        <Card>
          <CardContent className="py-8 text-center text-neutral-700">
            Drafts are temporarily unavailable. Please try again.
          </CardContent>
        </Card>
      )}
      {!loading && !failed && drafts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FilePenLine className="mx-auto mb-4 h-10 w-10 text-neutral-400" />
            <h2 className="text-lg font-semibold">No drafts yet</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Create a private draft when you are ready to prepare an offer.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {drafts.map((draft) => (
          <Card key={draft.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{draft.commodity.name}</CardTitle>
                <Badge variant="secondary">Draft</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-neutral-500">Type</dt>
                  <dd className="font-medium capitalize">{draft.offerType}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Quantity</dt>
                  <dd className="font-medium">
                    {draft.quantity.value} {draft.quantity.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Price</dt>
                  <dd className="font-medium">
                    {draft.pricing.amountPerUnit} {draft.pricing.currency}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Location</dt>
                  <dd className="font-medium">{draft.location}</dd>
                </div>
              </dl>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSelected(draft)}
              >
                View Draft
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Draft</DialogTitle>
            <DialogDescription>
              Prepare private commercial values without publishing an offer.
            </DialogDescription>
          </DialogHeader>
          {optionsQuery.data && (
            <DraftForm
              options={optionsQuery.data}
              initial={EMPTY_FORM}
              submitLabel="Save Draft"
              pending={createMutation.isPending}
              onCancel={() => setCreateOpen(false)}
              onSubmit={(form) => createMutation.mutate(form)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setEditing(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Draft" : "Draft Detail"}</DialogTitle>
            <DialogDescription>
              Private and unpublished. Only your account can access this draft.
            </DialogDescription>
          </DialogHeader>
          {selected && !editing && (
            <div className="space-y-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-neutral-500">Commodity</dt>
                  <dd className="font-medium">{selected.commodity.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Offer type</dt>
                  <dd className="font-medium capitalize">{selected.offerType}</dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Quantity</dt>
                  <dd className="font-medium">
                    {selected.quantity.value} {selected.quantity.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Price</dt>
                  <dd className="font-medium">
                    {selected.pricing.amountPerUnit}{" "}
                    {selected.pricing.currency}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Location</dt>
                  <dd className="font-medium">{selected.location}</dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Valid until</dt>
                  <dd className="font-medium">
                    {selected.validUntil
                      ? new Date(selected.validUntil).toLocaleString()
                      : "Not set"}
                  </dd>
                </div>
              </dl>
              <DialogFooter>
                <Button
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Delete this private draft? This cannot be undone.",
                      )
                    ) {
                      deleteMutation.mutate(selected.id);
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Draft
                </Button>
                <Button onClick={() => setEditing(true)}>
                  <FilePenLine className="mr-2 h-4 w-4" />
                  Edit Draft
                </Button>
              </DialogFooter>
            </div>
          )}
          {selected && editing && optionsQuery.data && editInitial && (
            <DraftForm
              options={optionsQuery.data}
              initial={editInitial}
              submitLabel="Save Changes"
              pending={updateMutation.isPending}
              onCancel={() => setEditing(false)}
              onSubmit={(form) => updateMutation.mutate(form)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
