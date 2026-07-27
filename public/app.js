// Helpers
const LS = {
  state: "tutela_kyb_state",
  offers: "tutela_offers",
  deals: "tutela_deals",
};
const qs = (sel, el=document) => el.querySelector(sel);

// Data
const DEFAULT_OFFERS = [
  { id:"#O-1001", commodity:"Crude Oil", type:"Spot",    price:"84.20 $/bbl", loc:"Fujairah",    status:"verified" },
  { id:"#O-1002", commodity:"Gold",      type:"Futures", price:"2,410 $/oz", loc:"Dubai",       status:"verified" },
  { id:"#O-1003", commodity:"Wheat",     type:"Spot",    price:"245 $/mt",   loc:"Jebel Ali",   status:"pending"  },
  { id:"#O-1004", commodity:"Aluminum",  type:"Futures", price:"2,380 $/mt", loc:"Khalifa Port",status:"verified" }
];

function getState(){ return localStorage.getItem(LS.state) || "unverified"; }
function setState(s){ localStorage.setItem(LS.state, s); }
function loadOffers(){
  const raw = localStorage.getItem(LS.offers);
  if(!raw){ localStorage.setItem(LS.offers, JSON.stringify(DEFAULT_OFFERS)); return [...DEFAULT_OFFERS]; }
  try{ return JSON.parse(raw); }catch{ return [...DEFAULT_OFFERS]; }
}
function saveOffers(arr){ localStorage.setItem(LS.offers, JSON.stringify(arr)); }

function toast(msg, ms=1800){
  const t = qs("#toast"); t.textContent = msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), ms);
}

// KYB theme + ring
function applyState(state){
  document.body.classList.remove("state-unverified","state-pending","state-verified");
  document.body.classList.add(`state-${state}`);

  const badge = qs("#stateBadge");
  const msg = qs("#kycMsg");
  const favicon = document.querySelector(link[rel=icon]);
  const logo = document.querySelector(".brand .logo");

  if(state==="unverified"){
    badge.textContent = "Unverified";
    msg.textContent = "Complete verification to unlock full platform features.";
    favicon.href = "assets/favicon-mono.svg";
    if(logo) logo.src = "assets/logo-mono.svg";
    setProgress(0, "amber");
  }else if(state==="pending"){
    badge.textContent = "Pending Review";
    msg.textContent = "Your documents are being reviewed. This usually takes a few minutes.";
    favicon.href = "assets/favicon-mono.svg";
    if(logo) logo.src = "assets/logo-mono.svg";
    setProgress(75, "amber");
  }else{
    badge.textContent = "Verified";
    msg.textContent = "Verification successful. You can start trading.";
    favicon.href = "assets/favicon-green.svg";
    if(logo) logo.src = "assets/logo-green.svg";
    setProgress(100, "green");
  }
  setState(state);
}

function setProgress(pct, tone="amber"){
  const circ = 2*Math.PI*60;
  const offset = circ - (circ * pct/100);
  const el = qs("#ringVal");
  el.style.strokeDashoffset = offset;
  el.style.stroke = tone==="green" ? "var(--ok)" : "var(--pending)";
  qs("#ringText").textContent = `${pct}%`;
}

// Offers render/sort/filter
let offers = loadOffers();
let sortDir = 0; // 0 none, 1 asc, -1 desc

function parsePrice(p){
  const m = (p||"").match(/[0-9]+(?:\.[0-9]+)?/);
  return m ? parseFloat(m[0]) : 0;
}

function renderOffers(){
  const list = qs("#offerList"); list.innerHTML = "";
  const q = (qs("#search")?.value||"").toLowerCase();
  const c = qs("#filterCommodity")?.value || "All Commodities";
  const t = qs("#filterType")?.value || "All Contracts";

  let rows = offers
    .filter(o => (c==="All Commodities" || o.commodity===c))
    .filter(o => (t==="All Contracts" || o.type===t))
    .filter(o => !q || Object.values(o).join(" ").toLowerCase().includes(q));

  if(sortDir!==0){
    rows = rows.slice().sort((a,b)=> sortDir * (parsePrice(a.price) - parsePrice(b.price)));
  }

  rows.forEach(o=>{
    const row = document.createElement("div");
    row.className = "item";
    
    // Create first div with offer details
    const detailsDiv = document.createElement("div");
    const idStrong = document.createElement("strong");
    idStrong.textContent = o.id;
    detailsDiv.appendChild(idStrong);
    detailsDiv.appendChild(document.createTextNode(` — ${o.commodity} • ${o.type} • ${o.loc}`));
    
    // Create second div with price and button
    const actionsDiv = document.createElement("div");
    actionsDiv.style.display = "flex";
    actionsDiv.style.gap = "8px";
    actionsDiv.style.alignItems = "center";
    
    const priceSpan = document.createElement("span");
    priceSpan.className = "price";
    priceSpan.textContent = o.price;
    
    const negotiateBtn = document.createElement("button");
    negotiateBtn.className = "btn btn-primary";
    negotiateBtn.setAttribute("data-neg", o.id);
    negotiateBtn.textContent = "Negotiate";
    
    actionsDiv.appendChild(priceSpan);
    actionsDiv.appendChild(negotiateBtn);
    
    row.appendChild(detailsDiv);
    row.appendChild(actionsDiv);
    list.appendChild(row);
  });

  list.querySelectorAll("[data-neg]").forEach(btn=>{
    btn.addEventListener("click", ()=> openNeg(btn.getAttribute("data-neg")));
  });
}

// Negotiation modal
function openNeg(id){
  if(getState()!=="verified"){ toast("Complete KYB first"); return; }
  qs("#negOfferId").textContent = id;
  qs("#negQty").value = "";
  qs("#negPrice").value = "";
  qs("#negTerm").value = "FOB";
  qs("#negNote").value = "";
  qs("#negModal").classList.remove("hidden");
}
function closeNeg(){ qs("#negModal").classList.add("hidden"); }

function submitNeg(e){
  e.preventDefault();
  const id = qs("#negOfferId").textContent;
  const deal = {
    offerId: id,
    qty: parseFloat(qs("#negQty").value||"0"),
    price: (qs("#negPrice").value||"").trim(),
    term: qs("#negTerm").value,
    note: (qs("#negNote").value||"").trim(),
    ts: new Date().toISOString()
  };
  const raw = localStorage.getItem(LS.deals);
  const arr = raw ? JSON.parse(raw) : [];
  arr.push(deal);
  localStorage.setItem(LS.deals, JSON.stringify(arr));
  toast("Counteroffer sent");
  closeNeg();
}

// Create Offer modal
function openCreate(){
  if(getState()!=="verified"){
    toast("Will be saved as Draft until verified");
  }
  qs("#cCommodity").value = "Crude Oil";
  qs("#cType").value = "Spot";
  qs("#cPrice").value = "";
  qs("#cLoc").value = "";
  qs("#createModal").classList.remove("hidden");
}
function closeCreate(){ qs("#createModal").classList.add("hidden"); }

function submitCreate(e){
  e.preventDefault();
  const id = "#O-" + (Math.floor(Math.random()*9000)+1000);
  const obj = {
    id,
    commodity: qs("#cCommodity").value,
    type: qs("#cType").value,
    price: (qs("#cPrice").value||"").trim(),
    loc: (qs("#cLoc").value||"").trim(),
    status: getState()==="verified" ? "verified" : "draft"
  };
  offers = [obj, ...offers];
  saveOffers(offers);
  renderOffers();
  toast(obj.status==="draft" ? "Saved as Draft" : "Offer published");
  closeCreate();
}

// KYB actions
function simulateQuick(){
  applyState("pending");
  let p = 75;
  const timer = setInterval(()=>{ p = Math.min(99, p+4); setProgress(p,"amber"); }, 180);
  setTimeout(()=>{ clearInterval(timer); applyState("verified"); }, 2800);
}
function resetAll(){
  localStorage.removeItem(LS.state);
  localStorage.removeItem(LS.offers);
  localStorage.removeItem(LS.deals);
  offers = loadOffers();
  applyState("unverified");
  renderOffers();
  toast("Reset complete");
}
function submitDocs(){
  const files = qs("#kybFiles").files;
  if(!files || files.length===0){ toast("Please upload the required documents"); return; }
  applyState("pending");
  setTimeout(()=> applyState("verified"), 2500);
  toast("Documents received — under review");
}

// Init
document.addEventListener("DOMContentLoaded", ()=>{
  offers = loadOffers();
  applyState(getState());
  renderOffers();

  ["filterCommodity","filterType","search"].forEach(id=>{
    const el = qs("#"+id); if(el) el.addEventListener("input", renderOffers);
  });
  qs("#sortPrice").addEventListener("click", ()=>{
    sortDir = (sortDir===0?1: (sortDir===1?-1:0));
    toast(sortDir===1 ? "Price ↑" : sortDir===-1 ? "Price ↓" : "Sort cleared");
    renderOffers();
  });

  qs("#overlayCta").addEventListener("click", ()=>{
    document.getElementById("kybFiles").scrollIntoView({behavior:"smooth"});
  });

  qs("#btnSubmitDocs").addEventListener("click", submitDocs);
  qs("#btnStart").addEventListener("click", simulateQuick);
  qs("#btnReset").addEventListener("click", resetAll);

  qs("#negForm").addEventListener("submit", submitNeg);
  qs("#negClose").addEventListener("click", closeNeg);
  qs("#negCancel").addEventListener("click", closeNeg);

  qs("#btnCreateOffer").addEventListener("click", openCreate);
  qs("#createForm").addEventListener("submit", submitCreate);
  qs("#createClose").addEventListener("click", closeCreate);
  qs("#createCancel").addEventListener("click", closeCreate);
});
