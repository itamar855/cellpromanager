// CellManager CRM Extension (v2.2) - "The Ultra-Resilient Messenger"
console.log("%c CRM: Extension v2.2 Loaded ", "background: #25d366; color: white; font-weight: bold;");

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
  const isIG = window.location.host.includes("instagram");

  if (isWA) {
    const waHeader = document.querySelector("#main header");
    if (waHeader) {
      const currentName = (waHeader.querySelector('span[dir="auto"]') || waHeader.querySelector('span'))?.innerText.trim();
      if (!waHeader.querySelector(".crm-capture-btn")) injectButton(waHeader, "WhatsApp");
      
      const isMatch = activeLead.id && (activeLead.name === currentName || currentName?.includes(activeLead.name) || activeLead.name?.includes(currentName));
      if (isMatch) {
        setupAutoSyncWhatsApp();
      }
    }
  } else if (isIG) {
    const infoLabels = ["Informações", "Information", "Informações da conversa", "Conversation Information", "Expandir", "Expand"];
    for (const label of infoLabels) {
      const icon = document.querySelector(`svg[aria-label="${label}"]`);
      if (icon) {
        let current = icon.parentElement;
        for (let i = 0; i < 5; i++) {
          if (current && current.offsetHeight > 40 && current.offsetHeight < 120 && !current.closest('div[role="navigation"]')) {
            const currentName = current.innerText.trim().split('\n')[0];
            if (!current.querySelector(".crm-capture-btn")) injectButton(current, "Instagram");
            
            const isMatch = activeLead.id && (activeLead.name === currentName || currentName.includes(activeLead.name));
            if (isMatch) {
              setupAutoSyncInstagram();
            } else if (autoSyncObserver) {
              autoSyncObserver.disconnect();
            }
            return;
          }
          current = current?.parentElement;
        }
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
  const name = (header.querySelector('span[dir="auto"]') || header.querySelector('span'))?.innerText.trim() || "Lead WhatsApp";
  console.log("CRM: Capturing lead", name);
  
  let phone = "";
  // Strategy 1: Look for JID in data-id of messages
  const anyMsg = document.querySelector('[data-id*="@c.us"]');
  const dataId = anyMsg?.getAttribute('data-id') || "";
  const jidMatch = dataId.match(/(\d{10,})@/);

  if (jidMatch) {
    phone = jidMatch[1];
    console.log("CRM: Phone found in JID:", phone);
  } else {
    // Strategy 2: Look for digits in name
    const digitsInName = name.replace(/\D/g, "");
    if (digitsInName.length >= 10) phone = digitsInName;
    else {
      // Strategy 3: Search entire page text for a phone number
      const allText = document.body.innerText;
      const phoneMatch = allText.match(/\d{2} ?9?\d{8}/); // Brazilian phone regex approx
      if (phoneMatch) phone = phoneMatch[0].replace(/\D/g, "");
    }
  }

  console.log("CRM: Finalized phone extraction:", phone || "NOT FOUND");

  const messages = extractMessagesWhatsApp();
  await sendToERP({ name, phone, source: "whatsapp", notes: "Sincronizado via WhatsApp Web" }, messages);
  setupAutoSyncWhatsApp();
}

async function captureLeadInstagram(header) {
  try {
    let name = header.innerText.trim().split('\n')[0] || "Lead Instagram";
    const messages = extractMessagesInstagram();
    await sendToERP({ name, source: "instagram", notes: "Sincronizado via Instagram Web" }, messages);
    setupAutoSyncInstagram();
  } catch (err) { console.error("Erro IG:", err); }
}

function extractMessagesWhatsApp() {
  const msgEls = document.querySelectorAll('.message-in, .message-out');
  return Array.from(msgEls).slice(-25).map(el => {
    const content = (el.querySelector('.copyable-text span')?.innerText || el.innerText).trim();
    return { content, sender: el.classList.contains('message-out') ? 'me' : 'lead', created_at: new Date().toISOString() };
  });
}

function extractMessagesInstagram() {
  const msgEls = document.querySelectorAll('div[role="row"]');
  return Array.from(msgEls).slice(-25).map(el => {
    const content = el.innerText.split('\n')[0].trim();
    const isMe = el.querySelector('div[style*="align-items: flex-end"]') || el.innerText.includes("Você enviou");
    return { content, sender: isMe ? 'me' : 'lead', created_at: new Date().toISOString() };
  });
}

async function sendToERP(leadData, messages = []) {
  try {
    const baseUrl = CONFIG.supabaseUrl;
    const apiKey = CONFIG.supabaseKey;
    const headers = { "Content-Type": "application/json", "apikey": apiKey, "Authorization": `Bearer ${apiKey}` };

    console.log("CRM: Searching for existing lead...", leadData.name);
    // Use ilike and handle the potential for multiple matches or or-conditions
    let queryUrl = `${baseUrl}/rest/v1/leads?name=ilike.${encodeURIComponent(leadData.name)}&select=id`;
    if (leadData.phone && leadData.phone.length > 5) {
      queryUrl = `${baseUrl}/rest/v1/leads?or=(name.ilike.${encodeURIComponent(leadData.name)},phone.eq.${encodeURIComponent(leadData.phone)})&select=id`;
    }
    
    const checkRes = await fetch(queryUrl, { headers });
    const existingLeads = await checkRes.json();
    
    let savedLead;
    if (Array.isArray(existingLeads) && existingLeads.length > 0) {
      console.log("CRM: Lead found, updating...", existingLeads[0].id);
      const updateRes = await fetch(`${baseUrl}/rest/v1/leads?id=eq.${existingLeads[0].id}`, {
        method: "PATCH",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify(leadData)
      });
      const updated = await updateRes.json();
      savedLead = updated[0];
    } else {
      console.log("CRM: Lead not found, creating new...");
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
    alert(`✅ Sincronizado com CRM: ${leadData.name}`);
  } catch (err) { 
    console.error("CRM: Error in sendToERP", err);
    alert("❌ Erro CRM: " + err.message); 
  }
}

function setupAutoSyncWhatsApp() {
  if (autoSyncObserver) autoSyncObserver.disconnect();
  const main = document.querySelector('#main');
  if (!main) return;

  console.log("CRM: Auto-Sync Observer active for", activeLead.name);
  autoSyncObserver = new MutationObserver((mutations) => {
    if (!activeLead.id) return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) {
          if (node.classList.contains('message-in') || node.classList.contains('message-out')) {
            syncSingle(node, 'wa');
          } else {
            const children = node.querySelectorAll('.message-in, .message-out');
            children.forEach(c => syncSingle(c, 'wa'));
          }
        }
      }
    }
  });

  autoSyncObserver.observe(main, { childList: true, subtree: true });
}

function setupAutoSyncInstagram() {
  if (autoSyncObserver) autoSyncObserver.disconnect();
  const chat = document.querySelector('div[role="main"]') || document.body;
  
  autoSyncObserver = new MutationObserver((mutations) => {
    if (!activeLead.id) return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) {
          const row = node.getAttribute('role') === 'row' ? node : node.querySelector('div[role="row"]');
          if (row) syncSingle(row, 'ig');
        }
      }
    }
  });
  autoSyncObserver.observe(chat, { childList: true, subtree: true });
}

async function syncSingle(el, platform) {
  if (!activeLead.id) return;
  
  let content = "", sender = "lead";
  if (platform === 'wa') {
    const contentEl = el.querySelector('.copyable-text span');
    content = (contentEl ? contentEl.innerText : el.innerText).trim();
    sender = el.classList.contains('message-out') ? 'me' : 'lead';
  } else {
    const contentText = el.innerText.split('\n')[0].trim();
    content = contentText;
    sender = (el.querySelector('div[style*="align-items: flex-end"]') || el.innerText.includes("Você enviou")) ? 'me' : 'lead';
  }

  if (!content || content === lastSyncedText) return;
  lastSyncedText = content;
  
  console.log("CRM: Auto-syncing message...", content);
  
  try {
    const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/lead_messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": CONFIG.supabaseKey, "Authorization": `Bearer ${CONFIG.supabaseKey}` },
      body: JSON.stringify({ lead_id: activeLead.id, content, sender, created_at: new Date().toISOString() })
    });
    if (res.ok) {
      showIndicator();
      console.log("CRM: Sync success");
    }
  } catch (err) { console.error("CRM: Auto-sync error", err); }
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "manualCapture") {
     findTarget(); 
     const waHeader = document.querySelector("#main header");
     if (waHeader) captureLeadWhatsApp(waHeader);
  }
});

const mainObserver = new MutationObserver(() => findTarget());
mainObserver.observe(document.body, { childList: true, subtree: true });
initSession();
setTimeout(findTarget, 2000);
