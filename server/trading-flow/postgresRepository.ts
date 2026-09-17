import type { QueryResultRow } from "pg";

import { pool } from "../db.js";
import { lockAndRequireTradeMutation, type TradeMutationAction } from "../enforcement/guard.js";
import {
  createAcceptedCommercialTerms,
  fingerprintTradingOffer,
  isAuthoritativeContractRecord,
  isAuthoritativeOrderRecord,
  type AuthoritativeContractRecord,
  type AuthoritativeOrderRecord,
  type TradingOfferSnapshot,
} from "./contracts.js";
import type { TradingFlowRepository } from "./service.js";

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

interface OfferRow extends QueryResultRow {
  id: string;
  user_id: string;
  seller_org_id: string | null;
  status: string;
  commodity: string;
  quantity: string;
  min_quantity: string | null;
  unit: string;
  price_per_unit: string;
  currency: string | null;
  delivery_terms: string | null;
  payment_terms: string | null;
  specifications: string | null;
  valid_until: Date | string | null;
  offer_version: string | null;
}

export async function loadTradingOffer(offerId: string): Promise<TradingOfferSnapshot | null> {
  const result = await pool.query<OfferRow>(`
    SELECT offer.id, offer.user_id, offer.seller_org_id, offer.status::text,
           commodity.name AS commodity, offer.quantity::text,
           offer.min_quantity::text, offer.unit, offer.price_per_unit::text,
           offer.currency, offer.delivery_terms, offer.payment_terms,
           offer.specifications, offer.valid_until,
           to_char(COALESCE(offer.updated_at, offer.created_at) AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS offer_version
    FROM public.offers AS offer
    INNER JOIN public.commodities AS commodity ON commodity.id = offer.commodity_id
    WHERE offer.id = $1 AND offer.type = 'sell'
  `, [offerId]);
  const row = result.rows[0];
  const offerVersion = row?.offer_version ?? null;
  if (!row || !row.seller_org_id || !offerVersion) return null;
  const unsigned = {
    offerId: row.id,
    sellerUserId: row.user_id,
    sellerOrganizationId: row.seller_org_id,
    lifecycleStatus: row.status,
    commodity: row.commodity,
    availableQuantity: row.quantity,
    minimumQuantity: row.min_quantity,
    unit: row.unit,
    pricePerUnit: row.price_per_unit,
    currency: row.currency ?? "USD",
    deliveryTerms: row.delivery_terms,
    paymentTerms: row.payment_terms,
    specifications: row.specifications,
    validUntil: iso(row.valid_until),
    offerVersion,
  };
  return Object.freeze({ ...unsigned, offerFingerprint: fingerprintTradingOffer(unsigned) });
}

interface OrderRow extends QueryResultRow {
  id: string;
  offer_id: string | null;
  buyer_id: string;
  buyer_organization_id: string | null;
  seller_id: string;
  seller_organization_id: string | null;
  status: string | null;
  order_version: number | null;
  offer_version: string | null;
  offer_fingerprint: string | null;
  publication_eligibility_fingerprint: string | null;
  buyer_participation_eligibility_fingerprint: string | null;
  accepted_terms_version: number | null;
  accepted_terms_fingerprint: string | null;
  accepted_terms_snapshot: Record<string, unknown> | null;
  created_at: Date | string | null;
  accepted_at: Date | string | null;
  order_fingerprint: string | null;
}

function hydrateOrder(row: OrderRow | undefined): AuthoritativeOrderRecord | null {
  if (
    !row || !row.offer_id || !row.buyer_organization_id || !row.seller_organization_id ||
    !row.order_version || !row.offer_version || !row.offer_fingerprint ||
    !row.publication_eligibility_fingerprint || !row.buyer_participation_eligibility_fingerprint ||
    row.accepted_terms_version !== 1 || !row.accepted_terms_fingerprint ||
    !row.accepted_terms_snapshot || !row.order_fingerprint ||
    !["created", "accepted", "cancelled"].includes(row.status ?? "")
  ) return null;
  const snapshot = row.accepted_terms_snapshot;
  if (
    typeof snapshot.quantity !== "string" || typeof snapshot.unit !== "string" ||
    typeof snapshot.pricePerUnit !== "string" || typeof snapshot.totalAmount !== "string" ||
    typeof snapshot.currency !== "string"
  ) return null;
  const terms = createAcceptedCommercialTerms({
    termsVersion: 1,
    quantity: snapshot.quantity,
    unit: snapshot.unit,
    pricePerUnit: snapshot.pricePerUnit,
    totalAmount: snapshot.totalAmount,
    currency: snapshot.currency,
    deliveryTerms: typeof snapshot.deliveryTerms === "string" ? snapshot.deliveryTerms : null,
    paymentTerms: typeof snapshot.paymentTerms === "string" ? snapshot.paymentTerms : null,
    specifications: typeof snapshot.specifications === "string" ? snapshot.specifications : null,
  });
  if (terms.termsFingerprint !== row.accepted_terms_fingerprint) return null;
  const createdAt = iso(row.created_at);
  if (!createdAt) return null;
  const order = Object.freeze({
    orderId: row.id,
    offerId: row.offer_id,
    buyerUserId: row.buyer_id,
    buyerOrganizationId: row.buyer_organization_id,
    sellerUserId: row.seller_id,
    sellerOrganizationId: row.seller_organization_id,
    status: row.status as "created" | "accepted" | "cancelled",
    orderVersion: row.order_version,
    offerVersion: row.offer_version,
    offerFingerprint: row.offer_fingerprint,
    publicationEligibilityFingerprint: row.publication_eligibility_fingerprint,
    buyerParticipationEligibilityFingerprint: row.buyer_participation_eligibility_fingerprint,
    terms,
    createdAt,
    acceptedAt: iso(row.accepted_at),
    orderFingerprint: row.order_fingerprint,
  });
  return isAuthoritativeOrderRecord(order) ? order : null;
}

export async function listCanonicalOrdersForUser(userId:string):Promise<AuthoritativeOrderRecord[]>{
  const result=await pool.query<OrderRow>(`SELECT ${ORDER_COLUMNS} FROM public.orders
    WHERE buyer_id=$1 OR seller_id=$1 ORDER BY created_at DESC,id DESC`,[userId]);
  return result.rows.map(hydrateOrder).filter((value):value is AuthoritativeOrderRecord=>value!==null);
}

interface ContractRow extends QueryResultRow {
  id:string;order_id:string|null;offer_id:string;buyer_id:string;buyer_organization_id:string|null;
  seller_id:string;seller_organization_id:string|null;status:string|null;contract_version:number|null;
  accepted_order_version:number|null;accepted_order_fingerprint:string|null;accepted_terms_version:number|null;
  accepted_terms_fingerprint:string|null;contract_fingerprint:string|null;created_at:Date|string|null;
  quantity:string;unit:string;price_per_unit:string;total_amount:string;currency:string;
  delivery_terms:string|null;payment_terms:string|null;specifications:string|null;
  accepted_terms_snapshot: Record<string, unknown> | null;
  source_order_fingerprint: string | null;
  snapshot_matches_contract: boolean;
}
function hydrateContract(row:ContractRow|undefined):AuthoritativeContractRecord|null{
  if(!row||!row.order_id||!row.buyer_organization_id||!row.seller_organization_id||row.status!=="draft"||!row.snapshot_matches_contract||
    row.contract_version!==1||!row.accepted_order_version||!row.accepted_order_fingerprint||row.accepted_terms_version!==1||
    !row.accepted_terms_fingerprint||!row.contract_fingerprint)return null;
  const snapshot = row.accepted_terms_snapshot;
  if (!snapshot || row.source_order_fingerprint !== row.accepted_order_fingerprint ||
    typeof snapshot.quantity !== "string" || typeof snapshot.unit !== "string" ||
    typeof snapshot.pricePerUnit !== "string" || typeof snapshot.totalAmount !== "string" ||
    typeof snapshot.currency !== "string") return null;
  const terms=createAcceptedCommercialTerms({termsVersion:1,quantity:snapshot.quantity,unit:snapshot.unit,pricePerUnit:snapshot.pricePerUnit,
    totalAmount:snapshot.totalAmount,currency:snapshot.currency,
    deliveryTerms:typeof snapshot.deliveryTerms === "string" ? snapshot.deliveryTerms : null,
    paymentTerms:typeof snapshot.paymentTerms === "string" ? snapshot.paymentTerms : null,
    specifications:typeof snapshot.specifications === "string" ? snapshot.specifications : null});
  if(terms.termsFingerprint!==row.accepted_terms_fingerprint)return null;
  const createdAt=iso(row.created_at);if(!createdAt)return null;
  const value=Object.freeze({contractId:row.id,orderId:row.order_id,offerId:row.offer_id,buyerUserId:row.buyer_id,
    buyerOrganizationId:row.buyer_organization_id,sellerUserId:row.seller_id,sellerOrganizationId:row.seller_organization_id,
    status:"draft" as const,contractVersion:1,acceptedOrderVersion:row.accepted_order_version,
    acceptedOrderFingerprint:row.accepted_order_fingerprint,terms,createdAt,contractFingerprint:row.contract_fingerprint});
  return isAuthoritativeContractRecord(value)?value:null;
}
const CONTRACT_COLUMNS=`contract.id,contract.order_id,contract.offer_id,contract.buyer_id,contract.buyer_organization_id,
  contract.seller_id,contract.seller_organization_id,contract.status,contract.contract_version,contract.accepted_order_version,
  contract.accepted_order_fingerprint,contract.accepted_terms_version,contract.accepted_terms_fingerprint,contract.contract_fingerprint,
  to_char(contract.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
  source.accepted_terms_snapshot,source.order_fingerprint AS source_order_fingerprint,
  (contract.quantity=(source.accepted_terms_snapshot->>'quantity')::numeric
    AND contract.price_per_unit=(source.accepted_terms_snapshot->>'pricePerUnit')::numeric
    AND contract.total_amount=(source.accepted_terms_snapshot->>'totalAmount')::numeric
    AND contract.currency=source.accepted_terms_snapshot->>'currency'
    AND contract.delivery_terms IS NOT DISTINCT FROM source.accepted_terms_snapshot->>'deliveryTerms'
    AND contract.payment_terms IS NOT DISTINCT FROM source.accepted_terms_snapshot->>'paymentTerms'
    AND contract.specifications IS NOT DISTINCT FROM source.accepted_terms_snapshot->>'specifications') AS snapshot_matches_contract,
  contract.quantity::text,contract.price_per_unit::text,contract.total_amount::text,
  contract.currency,contract.delivery_terms,contract.payment_terms,contract.specifications`;
export async function listCanonicalContractsForUser(userId:string):Promise<AuthoritativeContractRecord[]>{
  const result=await pool.query<ContractRow>(`SELECT ${CONTRACT_COLUMNS} FROM public.contracts contract
    JOIN public.orders source ON source.id=contract.order_id WHERE contract.buyer_id=$1 OR contract.seller_id=$1
    ORDER BY contract.created_at DESC,contract.id DESC`,[userId]);
  return result.rows.map(hydrateContract).filter((value):value is AuthoritativeContractRecord=>value!==null);
}
export async function loadCanonicalContractForUser(contractId:string,userId:string):Promise<AuthoritativeContractRecord|null>{
  const result=await pool.query<ContractRow>(`SELECT ${CONTRACT_COLUMNS} FROM public.contracts contract JOIN public.orders source ON source.id=contract.order_id
    WHERE contract.id=$1 AND (contract.buyer_id=$2 OR contract.seller_id=$2)`,[contractId,userId]);return hydrateContract(result.rows[0]);
}

const ORDER_COLUMNS = `id, offer_id, buyer_id, buyer_organization_id,
  seller_id, seller_organization_id, status, order_version, offer_version,
  offer_fingerprint, publication_eligibility_fingerprint,
  buyer_participation_eligibility_fingerprint, accepted_terms_version,
  accepted_terms_fingerprint, accepted_terms_snapshot,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
  accepted_at,
  order_fingerprint`;

function guardedWriter(action:TradeMutationAction, record:{buyerUserId:string;buyerOrganizationId:string;sellerUserId:string;sellerOrganizationId:string}) {
  return {async query<T extends QueryResultRow>(sql:string,values:unknown[]){
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      await lockAndRequireTradeMutation(client,action,[
        {scope:"USER",subjectId:record.buyerUserId},{scope:"ORGANIZATION",subjectId:record.buyerOrganizationId},
        {scope:"USER",subjectId:record.sellerUserId},{scope:"ORGANIZATION",subjectId:record.sellerOrganizationId},
      ]);
      const result=await client.query<T>(sql,values);
      await client.query("COMMIT");return result;
    }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
  }};
}

export const postgresTradingFlowRepository: TradingFlowRepository = Object.freeze({
  loadOffer: loadTradingOffer,
  async insertOrder(order: AuthoritativeOrderRecord) {
    const result = await guardedWriter("order.create",order).query<OrderRow>(`
      INSERT INTO public.orders (
        id, contract_id, offer_id, buyer_id, seller_id,
        buyer_organization_id, seller_organization_id, commodity, quantity,
        unit, price_per_unit, total_amount, currency, status,
        offer_version, offer_fingerprint, publication_eligibility_fingerprint,
        buyer_participation_eligibility_fingerprint, accepted_terms_version,
        accepted_terms_fingerprint, accepted_terms_snapshot, order_version,
        order_fingerprint, accepted_at, created_at, updated_at
      )
      SELECT $1, NULL, offer.id, $2, offer.user_id, $3::text, $4::text, commodity.name,
             $5::numeric, $6, $7::numeric, $8::numeric, $9, 'created',
             $10::text, $11, $12, $13, 1, $14, $15::jsonb, 1, $16, NULL, $17::timestamptz, $17::timestamptz
      FROM public.offers AS offer
      INNER JOIN public.commodities AS commodity ON commodity.id = offer.commodity_id
      WHERE offer.id = $18
        AND offer.user_id = $19
        AND offer.seller_org_id = $4::text
        AND to_char(COALESCE(offer.updated_at, offer.created_at) AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') = $10::text
      RETURNING ${ORDER_COLUMNS}
    `, [
      order.orderId, order.buyerUserId, order.buyerOrganizationId,
      order.sellerOrganizationId, order.terms.quantity, order.terms.unit,
      order.terms.pricePerUnit, order.terms.totalAmount, order.terms.currency,
      order.offerVersion, order.offerFingerprint,
      order.publicationEligibilityFingerprint,
      order.buyerParticipationEligibilityFingerprint,
      order.terms.termsFingerprint, JSON.stringify(order.terms),
      order.orderFingerprint, order.createdAt, order.offerId, order.sellerUserId,
    ]);
    return hydrateOrder(result.rows[0]);
  },
  async loadOrder(orderId: string) {
    const result = await pool.query<OrderRow>(`SELECT ${ORDER_COLUMNS} FROM public.orders WHERE id = $1`, [orderId]);
    return hydrateOrder(result.rows[0]);
  },
  async acceptOrder({ previousOrderFingerprint, acceptedOrder }: Readonly<{
    previousOrderFingerprint: string;
    acceptedOrder: AuthoritativeOrderRecord;
  }>) {
    const result = await guardedWriter("order.accept",acceptedOrder).query<OrderRow>(`
      UPDATE public.orders
      SET status = 'accepted', order_version = $1, accepted_at = $2::timestamptz,
          order_fingerprint = $3, updated_at = $2::timestamptz
      WHERE id = $4 AND status = 'created' AND order_fingerprint = $5
      RETURNING ${ORDER_COLUMNS}
    `, [acceptedOrder.orderVersion, acceptedOrder.acceptedAt,
      acceptedOrder.orderFingerprint, acceptedOrder.orderId, previousOrderFingerprint]);
    return hydrateOrder(result.rows[0]);
  },
  async insertContract(contract: AuthoritativeContractRecord) {
    const result = await guardedWriter("contract.create",contract).query<QueryResultRow>(`
      INSERT INTO public.contracts (
        id, order_id, offer_id, buyer_id, seller_id,
        buyer_organization_id, seller_organization_id, quantity, price_per_unit,
        total_amount, currency, status, payment_terms, delivery_terms,
        specifications, contract_version, accepted_order_version,
        accepted_order_fingerprint, accepted_terms_version,
        accepted_terms_fingerprint, contract_fingerprint, created_at, updated_at
      )
      SELECT $1, source.id, source.offer_id, source.buyer_id, source.seller_id,
             source.buyer_organization_id, source.seller_organization_id,
             source.quantity, source.price_per_unit, source.total_amount,
             source.currency, 'draft',
             source.accepted_terms_snapshot ->> 'paymentTerms',
             source.accepted_terms_snapshot ->> 'deliveryTerms',
             source.accepted_terms_snapshot ->> 'specifications',
             1, source.order_version, source.order_fingerprint,
             source.accepted_terms_version, source.accepted_terms_fingerprint,
             $2, $3::timestamptz, $3::timestamptz
      FROM public.orders AS source
      WHERE source.id = $4 AND source.status = 'accepted'
        AND source.order_version = $5 AND source.order_fingerprint = $6
      ON CONFLICT (order_id) DO NOTHING
      RETURNING id
    `, [contract.contractId, contract.contractFingerprint, contract.createdAt,
      contract.orderId, contract.acceptedOrderVersion, contract.acceptedOrderFingerprint]);
    return result.rows[0] && isAuthoritativeContractRecord(contract) ? contract : null;
  },
});
