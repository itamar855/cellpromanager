// CellManager CRM Extension (v3.0) - "The Ghost Sender"
console.log("%c CRM: Extension v3.0 Ghost-Mode Loaded ", "background: #25d366; color: white; font-weight: bold;");

const CONFIG = {
  supabaseUrl: "https://hzrqtolfbwnmmeliazmh.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cnF0b2xmYndubW1lbGlhem1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTI1MDEsImV4cCI6MjA4OTc4ODUwMX0.wQyORyhVI5FaUapc3uwsOV48VUQgvdj2_y0FXjYchAo"
};

let activeLead = { id: null, name: "" };
let lastSyncedText = "";
let autoSyncObserver = null;
let responsePolling = null;
let isSwitching = false;

const style = document.createElement('style');
style.textContent = `
  .crm-capture-btn { background: #25d366 !important; color: white !important; border: none !important; padding: 6px 14px !important; border-radius: 20px !important; cursor: pointer !important; font-size: 11px !important; font-weight: bold !important; margin: 5px 10px !important; z-index: 99999 !important; }
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

function sanitizeName(name) {
  if (!name) return "";
  return name.replace(/[^\x20-\x7E]/g, "").trim(); 
}

async function initSession() {
  const stored = await chrome.storage.local.get(['activeLeadId', 'activeLeadName']);
  if (stored.activeLeadId) {
    activeLead.id = stored.activeLeadId;
    activeLead.name = stored.activeLeadName;
  }
  startResponsePolling();
  setInterval(findTarget, 2000);
}

function findTarget() {
  if (window.location.host.includes("whatsapp")) {
    const waHeader = document.querySelector("#main header");
    if (waHeader) {
      const currentName = (waHeader.querySelector('span[title]') || waHeader.querySelector('span[dir="auto"]') || waHeader.querySelector('span'))?.innerText.trim();
      if (currentName) {
        if (!waHeader.querySelector(".crm-capture-btn")) injectButton(waHeader, "WhatsApp");
        setupAutoSyncWhatsApp();
      }
    }
  }
}

function injectButton(parent, platform) {
  const btn = document.createElement("button");
  btn.className = "crm-capture-btn";
  btn.innerText = "Enviar p/ CRM";
  btn.onclick = (e) => { e.preventDefault(); captureLeadWhatsApp(parent); };
  (parent.querySelector('div[role="button"]') || parent).appendChild(btn);
}

async function captureLeadWhatsApp(header) {
  const rawName = (header.querySelector('span[title]') || header.querySelector('span[dir="auto"]') || header.querySelector('span'))?.innerText.trim() || "Lead WhatsApp";
  const name = sanitizeName(rawName);
  const phone = getWAContactId();
  const messages = extractMessagesWhatsApp();
  await sendToERP({ name, phone, source: "whatsapp", notes: "Sincronizado via WhatsApp Web" }, messages);
}

function getWAContactId() {
  const anyMsg = document.querySelector('[data-id*="@c.us"]');
  const dataId = anyMsg?.getAttribute('data-id') || "";
  const match = dataId.match(/(\d{10,})@/);
  return match ? match[1] : "";
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
    const headers = { "Content-Type": "application/json", "apikey": CONFIG.supabaseKey, "Authorization": `Bearer ${CONFIG.supabaseKey}` };
    const queryUrl = leadData.phone 
      ? `${CONFIG.supabaseUrl}/rest/v1/leads?or=(name.ilike.${encodeURIComponent('%'+leadData.name+'%')},phone.eq.${leadData.phone})&select=id`
      : `${CONFIG.supabaseUrl}/rest/v1/leads?name=ilike.${encodeURIComponent('%'+leadData.name+'%')}&select=id`;
    
    const res = await fetch(queryUrl, { headers });
    const existing = await res.json();
    
    let saved;
    if (existing.length > 0) {
      const upd = await fetch(`${CONFIG.supabaseUrl}/rest/v1/leads?id=eq.${existing[0].id}`, {
        method: "PATCH", headers: { ...headers, "Prefer": "return=representation" }, body: JSON.stringify(leadData)
      });
      saved = (await upd.json())[0];
    } else {
      const cre = await fetch(`${CONFIG.supabaseUrl}/rest/v1/leads`, {
        method: "POST", headers: { ...headers, "Prefer": "return=representation" }, body: JSON.stringify(leadData)
      });
      saved = (await cre.json())[0];
    }

    activeLead = { id: saved.id, name: leadData.name };
    chrome.storage.local.set({ activeLeadId: saved.id, activeLeadName: leadData.name });

    if (messages.length > 0) {
      lastSyncedText = messages[messages.length - 1].content;
      await fetch(`${CONFIG.supabaseUrl}/rest/v1/lead_messages`, {
        method: "POST", headers, body: JSON.stringify(messages.map(m => ({ ...m, lead_id: saved.id })))
      });
    }
  } catch (err) { console.error(err); }
}

function setupAutoSyncWhatsApp() {
  if (autoSyncObserver) autoSyncObserver.disconnect();
  const main = document.querySelector('#main');
  if (!main) return;
  autoSyncObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) {
          if (node.classList.contains('message-in') || node.classList.contains('message-out')) syncSingle(node);
          else node.querySelectorAll('.message-in, .message-out').forEach(c => syncSingle(c));
        }
      }
    }
  });
  autoSyncObserver.observe(main, { childList: true, subtree: true });
}

async function syncSingle(el) {
  if (!activeLead.id) return;
  const content = (el.querySelector('.copyable-text span') || el.querySelector('span[dir="ltr"]') || el).innerText.trim();
  const sender = el.classList.contains('message-out') ? 'me' : 'lead';
  if (!content || content === lastSyncedText) return;
  lastSyncedText = content;
  
  await fetch(`${CONFIG.supabaseUrl}/rest/v1/lead_messages`, {
    method: "POST", headers: { "Content-Type": "application/json", "apikey": CONFIG.supabaseKey, "Authorization": `Bearer ${CONFIG.supabaseKey}` },
    body: JSON.stringify({ lead_id: activeLead.id, content, sender, created_at: new Date().toISOString() })
  });
  showIndicator();
  if (sender === 'lead') await updateLeadStatus(activeLead.id, { has_unread: true });
}

async function updateLeadStatus(id, data) {
  await fetch(`${CONFIG.supabaseUrl}/rest/v1/leads?id=eq.${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", "apikey": CONFIG.supabaseKey, "Authorization": `Bearer ${CONFIG.supabaseKey}` },
    body: JSON.stringify(data)
  });
}

function startResponsePolling() {
  setInterval(async () => {
    if (isSwitching) return;
    try {
      const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/lead_responses?status=eq.pending&order=created_at.asc`, {
        headers: { "apikey": CONFIG.supabaseKey, "Authorization": `Bearer ${CONFIG.supabaseKey}` }
      });
      const pending = await res.json();
      if (pending && pending.length > 0) {
        const msg = pending[0];
        const leadRes = await fetch(`${CONFIG.supabaseUrl}/rest/v1/leads?id=eq.${msg.lead_id}&select=name`, {
          headers: { "apikey": CONFIG.supabaseKey, "Authorization": `Bearer ${CONFIG.supabaseKey}` }
        });
        const targetName = (await leadRes.json())[0]?.name;
        if (!targetName) return;

        if (await checkIfLeadIsOpenStrict(msg.lead_id, targetName)) {
           if (await injectAndSendWhatsApp(msg.content)) {
             await markAsSent(msg.id);
             await updateLeadStatus(msg.lead_id, { has_unread: false });
           }
        } else {
           console.log("CRM: Not in target chat. Attempting ghost-search for", targetName);
           await robustGhostSwitch(msg.lead_id, targetName);
        }
      }
    } catch (e) { console.error("Poll Error", e); }
  }, 5000);
}

async function checkIfLeadIsOpenStrict(id, name) {
  const header = document.querySelector("#main header");
  if (!header) return false;
  const current = (header.querySelector('span[title]') || header.querySelector('span[dir="auto"]'))?.innerText.trim();
  const cleanCurrent = sanitizeName(current);
  const cleanTarget = sanitizeName(name);
  return cleanCurrent === cleanTarget || cleanCurrent.includes(cleanTarget);
}

async function markAsSent(id) {
  await fetch(`${CONFIG.supabaseUrl}/rest/v1/lead_responses?id=eq.${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", "apikey": CONFIG.supabaseKey, "Authorization": `Bearer ${CONFIG.supabaseKey}` },
    body: JSON.stringify({ status: 'sent' })
  });
}

// v3.0 Ghost Switch: Use search bar to switch chats reliably
async function robustGhostSwitch(id, name) {
  if (isSwitching) return;
  isSwitching = true;
  try {
    // 1. Click Search Bar
    const searchBar = document.querySelector('div[contenteditable="true"][data-tab="3"]');
    if (!searchBar) { isSwitching = false; return; }
    
    searchBar.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, name);
    searchBar.dispatchEvent(new Event('input', { bubbles: true }));

    // 2. Wait for results and click
    await new Promise(r => setTimeout(r, 2000));
    const results = document.querySelector('#pane-side');
    const row = results?.querySelector(`span[title="${name}"], span[title*="${name}"]`);
    if (row) {
      row.closest('div[role="row"]')?.click();
      console.log("CRM: Found and clicked contact!");
      activeLead = { id, name };
      chrome.storage.local.set({ activeLeadId: id, activeLeadName: name });
      // Clear search
      const clearBtn = document.querySelector('span[data-icon="x-alt"]');
      if (clearBtn) clearBtn.click();
    } else {
      console.log("CRM: Lead not found in search results.");
    }
  } catch (e) { console.error(e); }
  isSwitching = false;
}

async function injectAndSendWhatsApp(text) {
  const footer = document.querySelector('#main footer');
  const input = footer?.querySelector('div[contenteditable="true"]');
  if (!input) return false;
  input.focus();
  input.innerHTML = ""; 
  document.execCommand('insertText', false, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return new Promise(resolve => {
    setTimeout(() => {
      const sendBtn = footer.querySelector('[data-testid="send"]') || footer.querySelector('button span[data-icon="send"]')?.closest('button');
      if (sendBtn) { sendBtn.click(); resolve(true); }
      else { 
        const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
        input.dispatchEvent(ev); resolve(true); 
      }
    }, 1000); // 1s delay for ghost mode safety
  });
}

initSession();
