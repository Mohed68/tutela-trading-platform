-- Phase 5B additive private-draft lifecycle authority.
--
-- This adds one enum value only. It does not change the default offer status,
-- rewrite an existing row, or assign draft to a legacy offer.

ALTER TYPE public.offer_status
  ADD VALUE IF NOT EXISTS 'draft';
