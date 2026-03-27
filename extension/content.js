// CellManager CRM Extension (v7.1) - "The Brute Force"
console.log("%c CRM: Extension v7.1 Brute Loaded ", "background: #128C7E; color: white; font-weight: bold;");

const CONFIG = {
  supabaseUrl: "https://hzrqtolfbwnmmeliazmh.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cnF0b2xmYndubW1lbGlhem1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTI1MDEsImV4cCI6MjA4OTc4ODUwMX0.wQyORyhVI5FaUapc3uwsOV48VUQgvdj2_y0FXjYchAo"
};

let activeLead = { id: null, name: "" };
let lastSyncedText = "";
let isWorking = false; // Improved state lock
let lastAttemptedLeadId = null;
let retryCount = 0;

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
    if (isWorking) return;
    try {
      const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/lead_responses?status=eq.pending&order=created_at.asc`, {
        headers: { "apikey": CONFIG.supabaseKey, "Authorization": `Bearer ${CONFIG.supabaseKey}` }
      });
      const pending = await res.json();
      chrome.storage.local.set({ queueCount: pending.length });

      if (pending && pending.length > 0) {
        const msg = pending[0];
        
        // Anti-infinity: If we've tried this lead too many times, skip it for now
        if (msg.lead_id === lastAttemptedLeadId && retryCount > 5) {
            setStatus("Pausando busca por lead problemático...");
            setTimeout(() => { retryCount = 0; lastAttemptedLeadId = null; }, 10000);
            return;
        }

        const leadRes = await fetch(`${CONFIG.supabaseUrl}/rest/v1/leads?id=eq.${msg.lead_id}&select=name,phone`, {
          headers: { "apikey": CONFIG.supabaseKey, "Authorization": `Bearer ${CONFIG.supabaseKey}` }
        });
        const leadInfo = (await leadRes.json())[0];
        if (!leadInfo) return;

        if (await checkIfLeadIsOpenStrict(msg.lead_id, leadInfo.name)) {
           isWorking = true;
           setStatus("Enviando...");
           if (await injectAndSendWhatsApp(msg.content)) {
             await markAsSent(msg.id);
             await updateLeadStatus(msg.lead_id, { has_unread: false });
             setStatus("Mensagem Enviada!");
             lastAttemptedLeadId = null;
             retryCount = 0;
           }
           isWorking = false;
        } else {
           await robustSwitch(leadInfo);
        }
      }
    } catch (e) { console.error(e); }
  }, 4500);
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

async function robustSwitch(lead) {
  if (isWorking) return;
  isWorking = true;
  lastAttemptedLeadId = lead.id;
  retryCount++;

  try {
    const query = lead.phone || lead.name;
    setStatus(`Buscando: ${query} (Tentativa ${retryCount})`);

    // 1. WAKE-UP CALL: Force React to render the input
    const searchIcon = document.querySelector('span[data-icon="search"]') || 
                       document.querySelector('span[data-icon="chat"]');
    if (searchIcon) {
        let clickable = searchIcon.closest('button, [role="button"]') || searchIcon.parentElement;
        if (clickable) {
             clickable.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
             clickable.click();
        }
    }
    
    // Fallback Wake-up: find the placeholder text div and click
    try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while(node = walker.nextNode()) {
            if(node.nodeValue.includes('Pesquisar') || node.nodeValue.includes('nova conversa') || node.nodeValue.includes('Search')) {
                node.parentElement.click();
                node.parentElement.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
            }
        }
    } catch(e) {}

    await new Promise(r => setTimeout(r, 800));

    // BRUTE FORCE SELECTOR: Probe all input candidates and try pasting text
    const footer = document.querySelector('#main footer, footer.x1nqdnnd'); // WhatsApp main footer
    const allCandidates = Array.from(document.querySelectorAll('[contenteditable="true"], [role="textbox"], input, [data-lexical-editor="true"]'));
    const validInputs = allCandidates.filter(el => !footer || !footer.contains(el));
    
    let foundAndTyped = false;

    for (let el of validInputs) {
        if (el.offsetWidth === 0 && el.offsetHeight === 0 && !el.getBoundingClientRect().width) continue; 
        try {
            el.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            document.execCommand('insertText', false, query);
            el.dispatchEvent(new Event('input', { bubbles: true }));

            // Test if the element aggressively accepted the string
            if ((el.textContent && el.textContent.includes(query)) || (el.value && el.value.includes(query))) {
                foundAndTyped = true;
                break;
            }
        } catch(e) {}
    }

    if (foundAndTyped) {
      await new Promise(r => setTimeout(r, 2000));

      const sidebar = document.querySelector('#pane-side') || document.querySelector('#side');
      if (sidebar) {
        // Click the first physically visible row
        const rows = Array.from(sidebar.querySelectorAll('[role="row"], [role="button"], ._ak8l, ._ak8o'))
                          .filter(el => el.offsetHeight > 0 && el.innerText.trim().length > 0);
        
        if (rows.length > 0) {
          rows[0].click();
          setStatus("Chat localizado!");
          activeLead = { id: lead.id, name: lead.name };
          chrome.storage.local.set({ activeLeadId: lead.id, activeLeadName: lead.name });
          await new Promise(r => setTimeout(r, 1500));
        } else {
          setStatus("Não encontrado na busca.");
        }
      }
      
      // Clear search UI gently
      const clearBtn = document.querySelector('button[aria-label="Cancelar pesquisa"]') || document.querySelector('span[data-icon="x-alt"]')?.closest('button') || document.querySelector('span[data-icon="x-alt"]');
      if (clearBtn) clearBtn.click();
      
    } else {
        setStatus("Barra de busca não encontrada.");
    }
  } catch (e) { console.error(e); }
  isWorking = false;
}

async function injectAndSendWhatsApp(text) {
  // GEOMETRIC SELECTOR: The chat input is ALWAYS the rightmost visible input!
  const allInputs = Array.from(document.querySelectorAll('[contenteditable="true"], input[type="text"]'))
                         .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && el.getBoundingClientRect().left >= 0);
  allInputs.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  
  // Rightmost is the chat input
  const input = allInputs.length > 0 ? allInputs[allInputs.length - 1] : null;

  if (!input) return false;

  input.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  document.execCommand('insertText', false, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  
  await new Promise(r => setTimeout(r, 1000));
  const sendBtn = document.querySelector('span[data-icon="send"]')?.closest('button') || document.querySelector('[data-testid="send"]');
  if (sendBtn) {
    sendBtn.click();
    return true;
  } else {
    const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
    input.dispatchEvent(ev);
    return true;
  }
}

initSession();
