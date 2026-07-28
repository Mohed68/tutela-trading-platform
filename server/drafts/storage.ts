import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "../db.js";
import {
  draftOfferUnitSchema,
} from "../../shared/draftValidation.js";
import type {
  CreateDraftOfferRequest,
  DeleteDraftOfferResponse,
  DraftOfferDetailDto,
  DraftOfferOptionsDto,
  DraftOfferSummaryDto,
  OwnerPrivateOfferDetailDto,
  OwnerPrivateOfferSummaryDto,
  SubmittedOfferDetailDto,
  UpdateDraftOfferRequest,
} from "../../shared/drafts.js";
import type { SubmittedOfferVerificationSnapshot } from "../../shared/verification.js";
import {
  VERIFICATION_SNAPSHOT_SCHEMA_VERSION,
} from "../verification/policy.js";
import { queueVerificationAttempt } from "../verification/repository.js";
import {
  PHASE_5B_DRAFT_CURRENCY,
  phase5bDraftUnitsForCommodity,
} from "./policy.js";

interface DraftRow extends QueryResultRow {
  id: string;
  offer_type: "buy" | "sell";
  commodity_id: string;
  commodity_name: string;
  commodity_category: string;
  quantity: string;
  unit: string;
  price_per_unit: string;
  currency: string | null;
  location: string;
  status: string | null;
  valid_until: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

export interface DraftCommodity {
  id: string;
  name: string;
  category: string;
}

export class DraftDependencyConflictError extends Error {
  constructor() {
    super("DRAFT_HAS_DEPENDENCIES");
    this.name = "DraftDependencyConflictError";
  }
}

function isoTimestamp(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_STORED_DRAFT_TIMESTAMP");
  }
  return date.toISOString();
}

function toPrivateOfferDto(row: DraftRow): OwnerPrivateOfferDetailDto {
  if (
    (row.status !== "draft" && row.status !== "submitted") ||
    row.currency !== PHASE_5B_DRAFT_CURRENCY
  ) {
    throw new Error("INVALID_STORED_DRAFT_AUTHORITY");
  }

  return {
    id: row.id,
    offerType: row.offer_type,
    commodity: {
      id: row.commodity_id,
      name: row.commodity_name,
      category: row.commodity_category,
    },
    quantity: {
      value: row.quantity,
      unit: draftOfferUnitSchema.parse(row.unit),
    },
    pricing: {
      amountPerUnit: row.price_per_unit,
      currency: PHASE_5B_DRAFT_CURRENCY,
    },
    location: row.location,
    status: row.status,
    visibility: {
      state: "private",
    },
    validUntil: isoTimestamp(row.valid_until),
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),
  };
}

function toDraftDto(row: DraftRow): DraftOfferDetailDto {
  const offer = toPrivateOfferDto(row);
  if (offer.status !== "draft") {
    throw new Error("EXPECTED_DRAFT_OFFER");
  }
  return offer;
}

function toSubmittedDto(row: DraftRow): SubmittedOfferDetailDto {
  const offer = toPrivateOfferDto(row);
  if (offer.status !== "submitted") {
    throw new Error("EXPECTED_SUBMITTED_OFFER");
  }
  return offer;
}

const DRAFT_PROJECTION = `
  offer.id,
  offer.type::text AS offer_type,
  commodity.id AS commodity_id,
  commodity.name AS commodity_name,
  commodity.type::text AS commodity_category,
  offer.quantity::text,
  offer.unit,
  offer.price_per_unit::text,
  offer.currency,
  offer.location,
  offer.status::text,
  offer.valid_until,
  offer.created_at,
  offer.updated_at
`;

export async function getDraftCommodity(
  commodityId: string,
): Promise<DraftCommodity | undefined> {
  const result = await pool.query<{
    id: string;
    name: string;
    category: string;
  }>(
    `
      SELECT id, name, type::text AS category
      FROM public.commodities
      WHERE id = $1
    `,
    [commodityId],
  );
  return result.rows[0];
}

export async function getDraftOfferOptions(): Promise<DraftOfferOptionsDto> {
  const result = await pool.query<{
    id: string;
    name: string;
    category: string;
  }>(`
    SELECT id, name, type::text AS category
    FROM public.commodities
    ORDER BY name
  `);

  return {
    currency: PHASE_5B_DRAFT_CURRENCY,
    commodities: result.rows.map((commodity) => ({
      ...commodity,
      units: phase5bDraftUnitsForCommodity(commodity.name),
    })),
  };
}

export async function listOwnedDraftOffers(
  ownerId: string,
): Promise<DraftOfferSummaryDto[]> {
  const result = await pool.query<DraftRow>(
    `
      SELECT ${DRAFT_PROJECTION}
      FROM public.offers AS offer
      INNER JOIN public.commodities AS commodity
        ON commodity.id = offer.commodity_id
      WHERE offer.user_id = $1
        AND offer.status::text = 'draft'
      ORDER BY offer.created_at DESC, offer.id
    `,
    [ownerId],
  );
  return result.rows.map(toDraftDto);
}

export async function listOwnedPrivateOffers(
  ownerId: string,
): Promise<OwnerPrivateOfferSummaryDto[]> {
  const result = await pool.query<DraftRow>(
    `
      SELECT ${DRAFT_PROJECTION}
      FROM public.offers AS offer
      INNER JOIN public.commodities AS commodity
        ON commodity.id = offer.commodity_id
      WHERE offer.user_id = $1
        AND offer.status::text IN ('draft', 'submitted')
      ORDER BY offer.created_at DESC, offer.id
    `,
    [ownerId],
  );
  return result.rows.map(toPrivateOfferDto);
}

export async function getOwnedDraftOffer(
  ownerId: string,
  draftId: string,
): Promise<DraftOfferDetailDto | undefined> {
  const result = await pool.query<DraftRow>(
    `
      SELECT ${DRAFT_PROJECTION}
      FROM public.offers AS offer
      INNER JOIN public.commodities AS commodity
        ON commodity.id = offer.commodity_id
      WHERE offer.id = $1
        AND offer.user_id = $2
        AND offer.status::text = 'draft'
    `,
    [draftId, ownerId],
  );
  return result.rows[0] ? toDraftDto(result.rows[0]) : undefined;
}

export async function getOwnedPrivateOffer(
  ownerId: string,
  offerId: string,
): Promise<OwnerPrivateOfferDetailDto | undefined> {
  const result = await pool.query<DraftRow>(
    `
      SELECT ${DRAFT_PROJECTION}
      FROM public.offers AS offer
      INNER JOIN public.commodities AS commodity
        ON commodity.id = offer.commodity_id
      WHERE offer.id = $1
        AND offer.user_id = $2
        AND offer.status::text IN ('draft', 'submitted')
    `,
    [offerId, ownerId],
  );
  return result.rows[0] ? toPrivateOfferDto(result.rows[0]) : undefined;
}

export async function createOwnedDraftOffer(
  ownerId: string,
  request: CreateDraftOfferRequest,
): Promise<DraftOfferDetailDto> {
  const result = await pool.query<DraftRow>(
    `
      WITH inserted AS (
        INSERT INTO public.offers (
          user_id,
          commodity_id,
          type,
          quantity,
          unit,
          price_per_unit,
          currency,
          location,
          status,
          valid_until
        )
        VALUES (
          $1,
          $2,
          $3::public.offer_type,
          $4::numeric(15,2),
          $5,
          $6::numeric(15,2),
          $7,
          $8,
          'draft'::public.offer_status,
          $9
        )
        RETURNING *
      )
      SELECT
        inserted.id,
        inserted.type::text AS offer_type,
        commodity.id AS commodity_id,
        commodity.name AS commodity_name,
        commodity.type::text AS commodity_category,
        inserted.quantity::text,
        inserted.unit,
        inserted.price_per_unit::text,
        inserted.currency,
        inserted.location,
        inserted.status::text,
        inserted.valid_until,
        inserted.created_at,
        inserted.updated_at
      FROM inserted
      INNER JOIN public.commodities AS commodity
        ON commodity.id = inserted.commodity_id
    `,
    [
      ownerId,
      request.commodityId,
      request.offerType,
      request.quantity,
      request.unit,
      request.amountPerUnit,
      request.currency,
      request.location,
      request.validUntil ? new Date(request.validUntil) : null,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("DRAFT_INSERT_DID_NOT_RETURN_ROW");
  return toDraftDto(row);
}

export async function updateOwnedDraftOffer(
  ownerId: string,
  draftId: string,
  request: UpdateDraftOfferRequest,
): Promise<DraftOfferDetailDto | undefined> {
  const assignments: string[] = [];
  const values: Array<string | Date | null> = [];
  const add = (assignment: string, value: string | Date | null) => {
    values.push(value);
    assignments.push(`${assignment} = $${values.length}`);
  };

  if (request.offerType !== undefined) {
    add("type", request.offerType);
  }
  if (request.commodityId !== undefined) {
    add("commodity_id", request.commodityId);
  }
  if (request.quantity !== undefined) {
    add("quantity", request.quantity);
  }
  if (request.unit !== undefined) {
    add("unit", request.unit);
  }
  if (request.amountPerUnit !== undefined) {
    add("price_per_unit", request.amountPerUnit);
  }
  if (request.currency !== undefined) {
    add("currency", request.currency);
  }
  if (request.location !== undefined) {
    add("location", request.location);
  }
  if (request.validUntil !== undefined) {
    add(
      "valid_until",
      request.validUntil === null ? null : new Date(request.validUntil),
    );
  }
  if (assignments.length === 0) {
    throw new Error("EMPTY_DRAFT_UPDATE");
  }

  values.push(draftId, ownerId);
  const draftIdParameter = values.length - 1;
  const ownerIdParameter = values.length;
  const result = await pool.query<DraftRow>(
    `
      WITH updated AS (
        UPDATE public.offers
        SET
          ${assignments.join(",\n          ")},
          updated_at = now()
        WHERE id = $${draftIdParameter}
          AND user_id = $${ownerIdParameter}
          AND status::text = 'draft'
        RETURNING *
      )
      SELECT
        updated.id,
        updated.type::text AS offer_type,
        commodity.id AS commodity_id,
        commodity.name AS commodity_name,
        commodity.type::text AS commodity_category,
        updated.quantity::text,
        updated.unit,
        updated.price_per_unit::text,
        updated.currency,
        updated.location,
        updated.status::text,
        updated.valid_until,
        updated.created_at,
        updated.updated_at
      FROM updated
      INNER JOIN public.commodities AS commodity
        ON commodity.id = updated.commodity_id
    `,
    values,
  );
  return result.rows[0] ? toDraftDto(result.rows[0]) : undefined;
}

export async function submitOwnedDraftOffer(
  ownerId: string,
  draftId: string,
): Promise<SubmittedOfferDetailDto | undefined> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<DraftRow>(
      `
        WITH submitted AS (
          UPDATE public.offers
          SET
            status = 'submitted'::public.offer_status,
            updated_at = now()
          WHERE id = $1
            AND user_id = $2
            AND status::text = 'draft'
          RETURNING *
        )
        SELECT
          submitted.id,
          submitted.type::text AS offer_type,
          commodity.id AS commodity_id,
          commodity.name AS commodity_name,
          commodity.type::text AS commodity_category,
          submitted.quantity::text,
          submitted.unit,
          submitted.price_per_unit::text,
          submitted.currency,
          submitted.location,
          submitted.status::text,
          submitted.valid_until,
          submitted.created_at,
          submitted.updated_at
        FROM submitted
        INNER JOIN public.commodities AS commodity
          ON commodity.id = submitted.commodity_id
      `,
      [draftId, ownerId],
    );
    const row = result.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
    } else {
      const nextRevision = (
        await client.query<{ revision: number }>(
          `
            SELECT (COALESCE(max(revision), 0) + 1)::int AS revision
            FROM public.offer_submission_revisions
            WHERE offer_id = $1
          `,
          [draftId],
        )
      ).rows[0].revision;
      const submittedRecordVersion = isoTimestamp(row.updated_at);
      if (!submittedRecordVersion) {
        throw new Error("SUBMITTED_RECORD_VERSION_REQUIRED");
      }
      const snapshot: SubmittedOfferVerificationSnapshot = {
        snapshotSchemaVersion: VERIFICATION_SNAPSHOT_SCHEMA_VERSION,
        offerId: row.id,
        submissionRevision: nextRevision,
        submittedRecordVersion,
        offerType: row.offer_type,
        commodity: {
          id: row.commodity_id,
          name: row.commodity_name,
          category: row.commodity_category,
        },
        quantity: row.quantity,
        unit: row.unit,
        amountPerUnit: row.price_per_unit,
        currency: row.currency,
        location: row.location,
        validUntil: isoTimestamp(row.valid_until),
        lifecycleStatus: "submitted",
      };
      await queueVerificationAttempt(client, snapshot);
      await client.query("COMMIT");
      return toSubmittedDto(row);
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const existing = await getOwnedPrivateOffer(ownerId, draftId);
  return existing?.status === "submitted" ? existing : undefined;
}

async function dependentRowCount(
  client: PoolClient,
  draftId: string,
): Promise<number> {
  const result = await client.query<{ count: number }>(
    `
      SELECT (
        (SELECT count(*) FROM public.offer_verifications WHERE offer_id = $1)
        +
        (SELECT count(*) FROM public.contracts WHERE offer_id = $1)
      )::int AS count
    `,
    [draftId],
  );
  return result.rows[0].count;
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23503"
  );
}

export async function deleteOwnedDraftOffer(
  ownerId: string,
  draftId: string,
): Promise<DeleteDraftOfferResponse | undefined> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{ id: string }>(
      `
        SELECT id
        FROM public.offers
        WHERE id = $1
          AND user_id = $2
          AND status::text = 'draft'
        FOR UPDATE
      `,
      [draftId, ownerId],
    );
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      return undefined;
    }

    if ((await dependentRowCount(client, draftId)) > 0) {
      await client.query("ROLLBACK");
      throw new DraftDependencyConflictError();
    }

    const deleted = await client.query<{ id: string }>(
      `
        DELETE FROM public.offers
        WHERE id = $1
          AND user_id = $2
          AND status::text = 'draft'
        RETURNING id
      `,
      [draftId, ownerId],
    );
    if (!deleted.rows[0]) {
      await client.query("ROLLBACK");
      return undefined;
    }
    await client.query("COMMIT");
    return { id: deleted.rows[0].id, deleted: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isForeignKeyViolation(error)) {
      throw new DraftDependencyConflictError();
    }
    throw error;
  } finally {
    client.release();
  }
}
