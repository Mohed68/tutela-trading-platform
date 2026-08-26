import type { DemoId } from "./ids.js";

export type DemoAssuranceLevel =
  | "documentary"
  | "source_confirmed"
  | "independently_inspected";

export interface DemoAuthorityPresentation {
  readonly simulation: true;
  readonly canonicalAuthority: false;
  readonly organizationVerification: "Verified — Simulation";
  readonly trust: "Established — Simulation";
  readonly tradingEligibility: "Eligible — Simulation";
}

export interface DemoOrganizationFixture {
  readonly organizationId: DemoId<"org">;
  readonly legalName: string;
  readonly fictional: true;
  readonly role: "buyer" | "seller" | "buyer_seller";
  readonly sector: string;
  readonly jurisdiction: string;
  readonly headquarters: string;
  readonly authorityPresentation: DemoAuthorityPresentation;
}

export interface DemoOfferFixture {
  readonly offerId: DemoId<"offer">;
  readonly commodity: string;
  readonly category: "energy" | "chemicals" | "metals" | "agriculture";
  readonly side: "buy" | "sell";
  readonly organizationId: DemoId<"org">;
  readonly quantity: string;
  readonly unit: string;
  readonly pricePerUnit: string;
  readonly currency: "USD";
  readonly location: string;
  readonly origin: string | null;
  readonly destination: string | null;
  readonly incoterm: string;
  readonly paymentTerms: string;
  readonly minimumQuantity: string;
  readonly specifications: Readonly<Record<string, string>>;
  readonly assuranceLevel: DemoAssuranceLevel;
  readonly assuranceLabel: "Documentary" | "Source Confirmed" | "Independently Inspected";
  readonly status: "active";
  readonly validityWindowDays: number;
  readonly simulation: true;
  readonly productionAuthority: false;
}

const AUTHORITY_PRESENTATION: DemoAuthorityPresentation = Object.freeze({
  simulation: true,
  canonicalAuthority: false,
  organizationVerification: "Verified — Simulation",
  trust: "Established — Simulation",
  tradingEligibility: "Eligible — Simulation",
});

function organization(
  fixture: Omit<DemoOrganizationFixture, "fictional" | "authorityPresentation">,
): DemoOrganizationFixture {
  return Object.freeze({
    ...fixture,
    fictional: true,
    authorityPresentation: AUTHORITY_PRESENTATION,
  });
}

export const DEMO_ORGANIZATIONS: readonly DemoOrganizationFixture[] =
  Object.freeze([
    organization({ organizationId: "demo:org:aster-gulf-energy", legalName: "Aster Gulf Energy Trading", role: "seller", sector: "Energy and petroleum", jurisdiction: "United Arab Emirates", headquarters: "Dubai" }),
    organization({ organizationId: "demo:org:northstar-meridian-procurement", legalName: "Northstar Meridian Procurement", role: "buyer", sector: "Energy procurement", jurisdiction: "Singapore", headquarters: "Singapore" }),
    organization({ organizationId: "demo:org:cedarbridge-chemicals", legalName: "Cedarbridge Fertilizers & Chemicals", role: "buyer_seller", sector: "Fertilizers and chemicals", jurisdiction: "Netherlands", headquarters: "Rotterdam" }),
    organization({ organizationId: "demo:org:atlas-vale-metals", legalName: "Atlas Vale Metals Trading", role: "buyer_seller", sector: "Industrial and precious metals", jurisdiction: "Switzerland", headquarters: "Geneva" }),
    organization({ organizationId: "demo:org:prairie-horizon-agri", legalName: "Prairie Horizon Agri Exports", role: "seller", sector: "Grains and oilseeds", jurisdiction: "Canada", headquarters: "Winnipeg" }),
    organization({ organizationId: "demo:org:solstice-soft-commodities", legalName: "Solstice Foods & Soft Commodities", role: "buyer_seller", sector: "Food and soft commodities", jurisdiction: "Brazil", headquarters: "São Paulo" }),
  ]);

function offer(
  fixture: Omit<DemoOfferFixture, "status" | "simulation" | "productionAuthority" | "specifications"> & {
    specifications: Record<string, string>;
  },
): DemoOfferFixture {
  return Object.freeze({
    ...fixture,
    specifications: Object.freeze({ ...fixture.specifications }),
    status: "active",
    simulation: true,
    productionAuthority: false,
  });
}

export const DEMO_OFFER_CATALOG: readonly DemoOfferFixture[] = Object.freeze([
  offer({ offerId:"demo:offer:wti-houston", commodity:"WTI Crude Oil", category:"energy", side:"sell", organizationId:"demo:org:aster-gulf-energy", quantity:"50000", unit:"barrel", pricePerUnit:"78.45", currency:"USD", location:"Houston, USA", origin:"Houston, USA", destination:null, incoterm:"FOB", paymentTerms:"Irrevocable documentary credit at sight", minimumQuantity:"1000", specifications:{grade:"WTI",sulfur:"0.24% max",gravity:"39.6 API"}, assuranceLevel:"documentary", assuranceLabel:"Documentary", validityWindowDays:45 }),
  offer({ offerId:"demo:offer:brent-rotterdam", commodity:"Brent Crude Oil", category:"energy", side:"sell", organizationId:"demo:org:aster-gulf-energy", quantity:"25000", unit:"barrel", pricePerUnit:"82.20", currency:"USD", location:"Rotterdam, Netherlands", origin:"North Sea", destination:"Rotterdam, Netherlands", incoterm:"CIF", paymentTerms:"Documentary credit at sight", minimumQuantity:"5000", specifications:{grade:"Brent Blend",sulfur:"0.37% max",gravity:"38.3 API"}, assuranceLevel:"source_confirmed", assuranceLabel:"Source Confirmed", validityWindowDays:38 }),
  offer({ offerId:"demo:offer:natural-gas-henry-hub", commodity:"Natural Gas", category:"energy", side:"buy", organizationId:"demo:org:northstar-meridian-procurement", quantity:"50000", unit:"MMBtu", pricePerUnit:"2.85", currency:"USD", location:"Henry Hub, USA", origin:null, destination:"Henry Hub, USA", incoterm:"DAP", paymentTerms:"Monthly invoice, net 15", minimumQuantity:"10000", specifications:{benchmark:"Henry Hub",transport:"Firm pipeline capacity",quality:"Pipeline specification"}, assuranceLevel:"documentary", assuranceLabel:"Documentary", validityWindowDays:32 }),
  offer({ offerId:"demo:offer:base-oil-group-ii", commodity:"Base Oil Group II", category:"energy", side:"sell", organizationId:"demo:org:aster-gulf-energy", quantity:"8000", unit:"metric_ton", pricePerUnit:"930.00", currency:"USD", location:"Jebel Ali, UAE", origin:"Rotterdam, Netherlands", destination:"Jebel Ali, UAE", incoterm:"CFR", paymentTerms:"20% advance, 80% against shipping documents", minimumQuantity:"500", specifications:{grade:"Group II 500N",viscosity:"95-105 cSt at 40°C",packing:"Bulk"}, assuranceLevel:"source_confirmed", assuranceLabel:"Source Confirmed", validityWindowDays:50 }),
  offer({ offerId:"demo:offer:fuel-oil-singapore", commodity:"Fuel Oil", category:"energy", side:"buy", organizationId:"demo:org:northstar-meridian-procurement", quantity:"12000", unit:"metric_ton", pricePerUnit:"485.00", currency:"USD", location:"Singapore", origin:null, destination:"Singapore", incoterm:"CIF", paymentTerms:"Irrevocable LC, 30 days", minimumQuantity:"2000", specifications:{grade:"RMG 380",sulfur:"0.5% max",standard:"ISO 8217"}, assuranceLevel:"documentary", assuranceLabel:"Documentary", validityWindowDays:28 }),
  offer({ offerId:"demo:offer:bitumen-jebel-ali", commodity:"Bitumen", category:"energy", side:"sell", organizationId:"demo:org:aster-gulf-energy", quantity:"6000", unit:"metric_ton", pricePerUnit:"410.00", currency:"USD", location:"Jebel Ali, UAE", origin:"UAE", destination:null, incoterm:"FOB", paymentTerms:"Confirmed LC at sight", minimumQuantity:"1000", specifications:{grade:"60/70 penetration",packing:"Bulk vessel",standard:"ASTM D946"}, assuranceLevel:"independently_inspected", assuranceLabel:"Independently Inspected", validityWindowDays:42 }),
  offer({ offerId:"demo:offer:urea-mombasa", commodity:"Urea 46%", category:"chemicals", side:"sell", organizationId:"demo:org:cedarbridge-chemicals", quantity:"10000", unit:"metric_ton", pricePerUnit:"355.00", currency:"USD", location:"Mombasa, Kenya", origin:"Mersin, Türkiye", destination:"Mombasa, Kenya", incoterm:"CFR", paymentTerms:"Confirmed LC at sight", minimumQuantity:"1000", specifications:{nitrogen:"46% minimum",form:"Granular",packing:"50 kg bags"}, assuranceLevel:"documentary", assuranceLabel:"Documentary", validityWindowDays:55 }),
  offer({ offerId:"demo:offer:methanol-busan", commodity:"Methanol", category:"chemicals", side:"buy", organizationId:"demo:org:cedarbridge-chemicals", quantity:"7500", unit:"metric_ton", pricePerUnit:"315.00", currency:"USD", location:"Busan, South Korea", origin:null, destination:"Busan, South Korea", incoterm:"CFR", paymentTerms:"LC at sight after source confirmation", minimumQuantity:"1500", specifications:{purity:"99.85% minimum",standard:"IMPCA",delivery:"Chemical tanker"}, assuranceLevel:"source_confirmed", assuranceLabel:"Source Confirmed", validityWindowDays:36 }),
  offer({ offerId:"demo:offer:copper-cathode-shanghai", commodity:"Copper Cathode", category:"metals", side:"sell", organizationId:"demo:org:atlas-vale-metals", quantity:"250", unit:"metric_ton", pricePerUnit:"8450.00", currency:"USD", location:"Shanghai, China", origin:"Dar es Salaam, Tanzania", destination:"Shanghai, China", incoterm:"CIF", paymentTerms:"30% deposit, 70% against inspection and documents", minimumQuantity:"25", specifications:{grade:"LME Grade A",purity:"99.99%",packing:"Strapped bundles"}, assuranceLevel:"independently_inspected", assuranceLabel:"Independently Inspected", validityWindowDays:40 }),
  offer({ offerId:"demo:offer:aluminum-vancouver", commodity:"Aluminum Ingots", category:"metals", side:"sell", organizationId:"demo:org:atlas-vale-metals", quantity:"2500", unit:"metric_ton", pricePerUnit:"2180.00", currency:"USD", location:"Vancouver, Canada", origin:"Canada", destination:null, incoterm:"FOB", paymentTerms:"Documentary credit at sight", minimumQuantity:"100", specifications:{grade:"A7 / LME Grade A",purity:"99.7%",form:"T-bar ingots"}, assuranceLevel:"source_confirmed", assuranceLabel:"Source Confirmed", validityWindowDays:48 }),
  offer({ offerId:"demo:offer:gold-london", commodity:"Gold Bullion", category:"metals", side:"buy", organizationId:"demo:org:atlas-vale-metals", quantity:"100", unit:"400_oz_bar", pricePerUnit:"775000.00", currency:"USD", location:"London, United Kingdom", origin:null, destination:"London, United Kingdom", incoterm:"EXW", paymentTerms:"Wire transfer T+2 against allocated title", minimumQuantity:"10", specifications:{purity:"995.0 minimum",standard:"LBMA Good Delivery",custody:"Allocated vault"}, assuranceLevel:"source_confirmed", assuranceLabel:"Source Confirmed", validityWindowDays:24 }),
  offer({ offerId:"demo:offer:silver-new-york", commodity:"Silver Bullion", category:"metals", side:"sell", organizationId:"demo:org:atlas-vale-metals", quantity:"500", unit:"1000_oz_bar", pricePerUnit:"23500.00", currency:"USD", location:"New York, USA", origin:"USA", destination:null, incoterm:"EXW", paymentTerms:"Delivery versus payment", minimumQuantity:"50", specifications:{purity:"999 fine",standard:"COMEX deliverable",custody:"Warehouse warrant"}, assuranceLevel:"independently_inspected", assuranceLabel:"Independently Inspected", validityWindowDays:30 }),
  offer({ offerId:"demo:offer:wheat-kansas-city", commodity:"Hard Red Winter Wheat", category:"agriculture", side:"sell", organizationId:"demo:org:prairie-horizon-agri", quantity:"5000", unit:"metric_ton", pricePerUnit:"285.00", currency:"USD", location:"Kansas City, USA", origin:"Kansas, USA", destination:null, incoterm:"FOB", paymentTerms:"Cash against documents within 7 days", minimumQuantity:"500", specifications:{grade:"No. 2 HRW",protein:"12.5% minimum",moisture:"14% max"}, assuranceLevel:"documentary", assuranceLabel:"Documentary", validityWindowDays:46 }),
  offer({ offerId:"demo:offer:soybeans-chicago", commodity:"Soybeans", category:"agriculture", side:"buy", organizationId:"demo:org:solstice-soft-commodities", quantity:"10000", unit:"metric_ton", pricePerUnit:"445.00", currency:"USD", location:"Chicago, USA", origin:null, destination:"Santos, Brazil", incoterm:"CIF", paymentTerms:"Irrevocable LC at sight", minimumQuantity:"1000", specifications:{grade:"No. 1 non-GMO",protein:"35% minimum",moisture:"14% max"}, assuranceLevel:"source_confirmed", assuranceLabel:"Source Confirmed", validityWindowDays:35 }),
  offer({ offerId:"demo:offer:arabica-bogota", commodity:"Arabica Coffee", category:"agriculture", side:"sell", organizationId:"demo:org:solstice-soft-commodities", quantity:"100", unit:"60_kg_bag", pricePerUnit:"195.00", currency:"USD", location:"Bogotá, Colombia", origin:"Colombia", destination:null, incoterm:"FOB", paymentTerms:"50% on confirmation, 50% against shipping documents", minimumQuantity:"20", specifications:{grade:"Specialty Arabica",cupping:"82+",packing:"GrainPro-lined bags"}, assuranceLevel:"documentary", assuranceLabel:"Documentary", validityWindowDays:44 }),
]);
