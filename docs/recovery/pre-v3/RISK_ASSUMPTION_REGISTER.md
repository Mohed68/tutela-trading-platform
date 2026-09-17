# Pre-V3 Risk and Assumption Register

| Item | Disposition |
| --- | --- |
| Email delivery dependency | Resend remains an external availability dependency; requests stay non-enumerating and failed delivery tokens are removed. A 15-second network timeout bounds calls. |
| UI TOTP refresh hint | Any countdown is informational only. Server time/counter verification remains authoritative and replay protection is preserved. |
| Evidence files | Only structured metadata/assertions and references exist. Protected binary document storage is deferred. |
| Enforcement/read separation | Enforcement blocks supported new mutations only. Historical reads deliberately remain accessible to participants and authorized operators. |
| Multiple active Organizations | Current-context resolution fails closed on ambiguity; command routes do not silently select an arbitrary membership. |
| Marketplace inventory | Current V2 does not decrement available quantity across orders. Inventory reservation/netting is a V3 architecture decision, so the UI must not imply reservation or settlement. |
| Contract lifecycle | Only immutable draft creation is current. Signing/binding/CP/payment/settlement are deferred. |
| Admin projections | Bounded safe metadata only; no raw evidence payloads, credentials, sessions or secrets. |
