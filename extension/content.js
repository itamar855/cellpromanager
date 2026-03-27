// CellManager CRM Extension (v5.0) - "The Command Center"
console.log("%c CRM: Extension v5.0 Command-Center Loaded ", "background: #128C7E; color: white; font-weight: bold;");

const CONFIG = {
  supabaseUrl: "https://hzrqtolfbwnmmeliazmh.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cnF0b2xmYndubW1lbGlhem1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTI1MDEsImV4cCI6MjA4OTc4ODUwMX0.wQyORyhVI5FaUapc3uwsOV48VUQgvdj2_y0FXjYchAo"
};

let activeLead = { id: null, name: "" };
let lastSyncedText = "";
let isSwitching = false;

function setStatus(msg) {
  console.log(`CRM: ${msg}`);
  chrome.storage.local.set({ automationStatus: msg });
}

async function initSession() {
  const stored = await chrome.storage.local.get(['activeLeadId', 'activeLeadName']);
  if (stored.activeLeadId) {
    activeLead.id = stored.activeLeadId;
    activeLead.name = stored.activeLeadName;
  }
  setStatus("Sistema Pronto");
  startResponsePolling();
  setInterval(findTarget, 2000);
}

function findTarget() {
  const waHeader = document.querySelector("#main header");
  if (waHeader && !waHeader.querySelector(".crm-capture-btn")) {
      const btn = document.createElement("button");
      btn.className = "crm-capture-btn";
      btn.style.cssText = "background: #128C7E; color: white; border: none; padding: 6px 14px; border-radius: 20px; cursor: pointer; font-size: 11px; font-weight: bold; margin: 5px 10px;";
      btn.innerText = "Enviar p/ CRM";
      btn.onclick = (e) => { e.preventDefault(); captureLeadWhatsApp(waHeader); };
      (waHeader.querySelector('div[role="button"]') || waHeader).appendChild(btn);
  }
  if (waHeader) setupAutoSyncWhatsApp();
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

function sanitizeName(name) {
  if (!name) return "";
  return name.replace(/[^\x20-\x7E]/g, "").trim(); 
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
  } catch (err) { console.error(err); }
}

function setupAutoSyncWhatsApp() {
  const main = document.querySelector('#main');
  if (!main || main.dataset.crmObserved) return;
  main.dataset.crmObserved = "true";
  new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) {
          if (node.classList.contains('message-in') || node.classList.contains('message-out')) syncSingle(node);
          else node.querySelectorAll('.message-in, .message-out').forEach(c => syncSingle(c));
        }
      }
    }
  }).observe(main, { childList: true, subtree: true });
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
      chrome.storage.local.set({ queueCount: pending.length });

      if (pending && pending.length > 0) {
        const msg = pending[0];
        const leadRes = await fetch(`${CONFIG.supabaseUrl}/rest/v1/leads?id=eq.${msg.lead_id}&select=name,phone`, {
          headers: { "apikey": CONFIG.supabaseKey, "Authorization": `Bearer ${CONFIG.supabaseKey}` }
        });
        const leadInfo = (await leadRes.json())[0];
        if (!leadInfo) return;

        setStatus(`Processando lead: ${leadInfo.name}`);

        if (await checkIfLeadIsOpenStrict(msg.lead_id, leadInfo.name)) {
           setStatus("Chat Aberto. Enviando...");
           if (await injectAndSendWhatsApp(msg.content)) {
             await markAsSent(msg.id);
             await updateLeadStatus(msg.lead_id, { has_unread: false });
             setStatus("Mensagem Enviada!");
             setTimeout(() => setStatus("Sistema Pronto"), 2000);
           }
        } else {
           setStatus("Chat Fechado. Buscando...");
           await hyperSwitch(leadInfo);
        }
      }
    } catch (e) { console.error(e); }
  }, 4000);
}

async function checkIfLeadIsOpenStrict(id, name) {
  const header = document.querySelector("#main header");
  if (!header) return false;
  const current = (header.querySelector('span[title]') || header.querySelector('span[dir="auto"]'))?.innerText.trim();
  return sanitizeName(current) === sanitizeName(name) || current?.includes(name);
}

async function markAsSent(id) {
  await fetch(`${CONFIG.supabaseUrl}/rest/v1/lead_responses?id=eq.${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", "apikey": CONFIG.supabaseKey, "Authorization": `Bearer ${CONFIG.supabaseKey}` },
    body: JSON.stringify({ status: 'sent' })
  });
}

// v5.0 Hyper Switch: The most aggressive way to open a chat
async function hyperSwitch(lead) {
  if (isSwitching) return;
  isSwitching = true;
  try {
    const query = lead.phone || lead.name;
    setStatus(`Buscando por: ${query}`);

    // Find and click search
    const searchBtn = document.querySelector('button[aria-label="Pesquisar"]') || document.querySelector('span[data-icon="search"]')?.closest('button');
    if (searchBtn) searchBtn.click();
    await new Promise(r => setTimeout(r, 500));

    const searchBar = document.querySelector('div[contenteditable="true"][data-tab="3"]') || 
                      document.querySelector('div[role="textbox"]');
    
    if (searchBar) {
      searchBar.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, query);
      searchBar.dispatchEvent(new Event('input', { bubbles: true }));
      
      await new Promise(r => setTimeout(r, 2000));

      const sidebar = document.querySelector('#pane-side');
      const row = sidebar?.querySelector(`div[role="row"]`); // Click the first result!
      if (row) {
        row.click();
        setStatus("Contato localizado!");
        activeLead = { id: lead.id, name: lead.name };
        chrome.storage.local.set({ activeLeadId: lead.id, activeLeadName: lead.name });
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  } catch (e) { console.error(e); }
  isSwitching = false;
}

async function injectAndSendWhatsApp(text) {
  const footer = document.querySelector('#main footer');
  const input = footer?.querySelector('div[contenteditable="true"]');
  if (!input) return false;

  input.focus();
  document.execCommand('insertText', false, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  
  return new Promise(resolve => {
    setTimeout(() => {
      const sendBtn = footer.querySelector('span[data-icon="send"]')?.closest('button') || footer.querySelector('[data-testid="send"]');
      if (sendBtn) {
        sendBtn.click();
        resolve(true);
      } else {
        const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
        input.dispatchEvent(ev);
        resolve(true);
      }
    }, 1000);
  });
}

initSession();
