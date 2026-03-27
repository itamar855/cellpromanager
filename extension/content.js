// CellManager CRM Extension (v2.3) - "The Multi-Strategy Phone Hunter"
console.log("%c CRM: Extension v2.3 Loaded ", "background: #25d366; color: white; font-weight: bold;");

const CONFIG = {
  supabaseUrl: "https://hzrqtolfbwnmmeliazmh.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cnF0b2xmYndubW1lbGlhem1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTI1MDEsImV4cCI6MjA4OTc4ODUwMX0.wQyORyhVI5FaUapc3uwsOV48VUQgvdj2_y0FXjYchAo"
};

let activeLead = { id: null, name: "" };
let lastSyncedText = "";
let autoSyncObserver = null;

const style = document.createElement('style');
style.textContent = `
  .crm-capture-btn { background: #25d366 !important; color: white !important; border: none !important; padding: 6px 14px !important; border-radius: 20px !important; cursor: pointer !important; font-size: 11px !important; font-weight: bold !important; margin: 5px 10px !important; z-index: 99999 !important; }
  .crm-capture-btn-instagram { background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888) !important; }
  .crm-sync-indicator { position: fixed; top: 10px; right: 80px; background: rgba(37, 211, 102, 0.9); color: white; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: bold; z-index: 10000; display: none; }
`;
document.head.appendChild(style);

const syncIndicator = document.createElement('div');
syncIndicator.className = 'crm-sync-indicator';
syncIndicator.innerText = '✓ Sincronizado';
document.body.appendChild(syncIndicator);

function showIndicator() {
  syncIndicator.style.display = 'block';
  setTimeout(() => syncIndicator.style.display = 'none', 1500);
}

// Helper to remove invisible characters/emojis for cleaner matching
function sanitizeName(name) {
  return name.replace(/[^\x20-\x7E]/g, "").trim(); 
}

async function initSession() {
  const stored = await chrome.storage.local.get(['activeLeadId', 'activeLeadName']);
  if (stored.activeLeadId) {
    activeLead.id = stored.activeLeadId;
    activeLead.name = stored.activeLeadName;
    console.log("CRM: Session restored for", activeLead.name);
    findTarget();
  }
}

function findTarget() {
  const isWA = window.location.host.includes("whatsapp");
  if (isWA) {
    const waHeader = document.querySelector("#main header");
    if (waHeader) {
      const currentName = (waHeader.querySelector('span[dir="auto"]') || waHeader.querySelector('span'))?.innerText.trim();
      const cleanCurrent = sanitizeName(currentName);
      const cleanStored = sanitizeName(activeLead.name);
      
      if (!waHeader.querySelector(".crm-capture-btn")) injectButton(waHeader, "WhatsApp");
      
      const isMatch = activeLead.id && (cleanCurrent === cleanStored || cleanCurrent.includes(cleanStored) || cleanStored.includes(cleanCurrent));
      if (isMatch) {
        setupAutoSyncWhatsApp();
      }
    }
  }
}

function injectButton(parent, platform) {
  const btn = document.createElement("button");
  btn.className = platform === "Instagram" ? "crm-capture-btn crm-capture-btn-instagram" : "crm-capture-btn";
  btn.innerText = "Enviar p/ CRM";
  btn.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    platform === "WhatsApp" ? captureLeadWhatsApp(parent) : captureLeadInstagram(parent);
  };
  if (platform === "Instagram") parent.prepend(btn);
  else (parent.querySelector('div[role="button"]') || parent).appendChild(btn);
}

async function captureLeadWhatsApp(header) {
  const rawName = (header.querySelector('span[dir="auto"]') || header.querySelector('span'))?.innerText.trim() || "Lead WhatsApp";
  const name = sanitizeName(rawName);
  console.log("CRM: Capturing sanitized name:", name);
  
  let phone = "";
  // Look for phone in message JID
  const anyMsg = document.querySelector('[data-id*="@c.us"]');
  const dataId = anyMsg?.getAttribute('data-id') || "";
  const jidMatch = dataId.match(/(\d{10,})@/);
  if (jidMatch) phone = jidMatch[1];
  else if (name.replace(/\D/g, "").length >= 10) phone = name.replace(/\D/g, "");

  console.log("CRM: Captured phone:", phone);

  const messages = extractMessagesWhatsApp();
  await sendToERP({ name, phone, source: "whatsapp", notes: "Sincronizado via WhatsApp Web" }, messages);
  setupAutoSyncWhatsApp();
}

async function captureLeadInstagram(header) {
  // Instagram logic
}

function extractMessagesWhatsApp() {
  const msgEls = document.querySelectorAll('.message-in, .message-out');
  return Array.from(msgEls).slice(-25).map(el => {
    const content = (el.querySelector('.copyable-text span')?.innerText || el.innerText).trim();
    return { content, sender: el.classList.contains('message-out') ? 'me' : 'lead', created_at: new Date().toISOString() };
  });
}

async function sendToERP(leadData, messages = []) {
  try {
    const baseUrl = CONFIG.supabaseUrl;
    const apiKey = CONFIG.supabaseKey;
    const headers = { "Content-Type": "application/json", "apikey": apiKey, "Authorization": `Bearer ${apiKey}` };

    console.log("CRM: Upserting lead...", leadData.name);
    
    // Strategy: Search by phone (most unique) OR name (fuzzy)
    let queryUrl = `${baseUrl}/rest/v1/leads?name=ilike.${encodeURIComponent('%' + leadData.name + '%')}&select=id`;
    if (leadData.phone) {
      queryUrl = `${baseUrl}/rest/v1/leads?or=(name.ilike.${encodeURIComponent('%' + leadData.name + '%')},phone.eq.${encodeURIComponent(leadData.phone)})&select=id`;
    }
    
    const checkRes = await fetch(queryUrl, { headers });
    const existingLeads = await checkRes.json();
    
    let savedLead;
    if (Array.isArray(existingLeads) && existingLeads.length > 0) {
      const bestMatch = existingLeads[0];
      console.log("CRM: Match found!", bestMatch.id);
      const updateRes = await fetch(`${baseUrl}/rest/v1/leads?id=eq.${bestMatch.id}`, {
        method: "PATCH",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify(leadData)
      });
      const updated = await updateRes.json();
      savedLead = updated[0];
    } else {
      console.log("CRM: No match, creating new lead");
      const createRes = await fetch(`${baseUrl}/rest/v1/leads`, {
        method: "POST",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify(leadData)
      });
      if (!createRes.ok) throw new Error("Erro API: " + await createRes.text());
      const created = await createRes.json();
      savedLead = created[0];
    }

    activeLead.id = savedLead.id;
    activeLead.name = leadData.name;
    chrome.storage.local.set({ activeLeadId: savedLead.id, activeLeadName: leadData.name });

    if (messages.length > 0) {
      lastSyncedText = messages[messages.length - 1].content;
      await fetch(`${baseUrl}/rest/v1/lead_messages`, {
        method: "POST",
        headers,
        body: JSON.stringify(messages.map(m => ({ ...m, lead_id: savedLead.id })))
      });
    }
    alert(`✅ CRM: Sincronizado ${leadData.name}`);
  } catch (err) { alert("❌ Erro: " + err.message); }
}

function setupAutoSyncWhatsApp() {
  if (autoSyncObserver) autoSyncObserver.disconnect();
  const main = document.querySelector('#main');
  if (!main) return;

  console.log("CRM: Auto-Sync Observer started");
  autoSyncObserver = new MutationObserver((mutations) => {
    if (!activeLead.id) return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) {
          if (node.classList.contains('message-in') || node.classList.contains('message-out')) {
            syncSingle(node, 'wa');
          } else {
            node.querySelectorAll('.message-in, .message-out').forEach(c => syncSingle(c, 'wa'));
          }
        }
      }
    }
  });
  autoSyncObserver.observe(main, { childList: true, subtree: true });
}

async function syncSingle(el, platform) {
  if (!activeLead.id) return;
  const contentEl = el.querySelector('.copyable-text span') || el.querySelector('span[dir="ltr"]');
  const content = (contentEl ? contentEl.innerText : el.innerText).trim();
  const sender = el.classList.contains('message-out') ? 'me' : 'lead';

  if (!content || content === lastSyncedText) return;
  lastSyncedText = content;
  
  console.log("CRM: Syncing...", content);
  try {
    const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/lead_messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": CONFIG.supabaseKey, "Authorization": `Bearer ${CONFIG.supabaseKey}` },
      body: JSON.stringify({ lead_id: activeLead.id, content, sender, created_at: new Date().toISOString() })
    });
    if (res.ok) showIndicator();
  } catch (err) { console.error("CRM: Error", err); }
}

chrome.runtime.onMessage.addListener((r) => { if (r.action === "manualCapture") findTarget(); });
initSession();
setInterval(findTarget, 5000);
