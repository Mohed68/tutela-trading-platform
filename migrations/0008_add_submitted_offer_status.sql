-- Phase 5C additive private-submission lifecycle boundary.
--
-- This adds one enum value only. It does not change the default offer status,
-- rewrite an existing row, or submit a legacy offer.

ALTER TYPE public.offer_status
  ADD VALUE IF NOT EXISTS 'submitted';
