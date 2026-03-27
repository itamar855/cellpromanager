// Advanced Content Script for CellManager Extension (v1.5) - "The Messenger"
console.log("CellManager CRM Extension Activity");

const CONFIG = {
  supabaseUrl: "https://hzrqtolfbwnmmeliazmh.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cnF0b2xmYndubW1lbGlhem1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTI1MDEsImV4cCI6MjA4OTc4ODUwMX0.wQyORyhVI5FaUapc3uwsOV48VUQgvdj2_y0FXjYchAo"
};

// CSS Injection
const style = document.createElement('style');
style.textContent = `
  .crm-capture-btn {
    background: #25d366 !important;
    color: white !important;
    border: none !important;
    padding: 6px 14px !important;
    border-radius: 20px !important;
    cursor: pointer !important;
    font-size: 11px !important;
    font-weight: bold !important;
    margin: 5px 10px !important;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
    transition: all 0.2s !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    white-space: nowrap !important;
    z-index: 99999 !important;
  }
  .crm-capture-btn:hover { transform: scale(1.05); filter: brightness(1.1); }
  .crm-capture-btn-instagram { background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888) !important; }
`;
document.head.appendChild(style);

function findTarget() {
  const isWhatsApp = window.location.host.includes("whatsapp");
  const isInstagram = window.location.host.includes("instagram");

  if (isWhatsApp) {
    const waHeader = document.querySelector("#main header");
    if (waHeader && !waHeader.querySelector(".crm-capture-btn")) {
      injectButton(waHeader, "WhatsApp");
    }
  } else if (isInstagram) {
    const infoLabels = ["Informações", "Information", "Informações da conversa", "Conversation Information", "Expandir", "Expand"];
    for (const label of infoLabels) {
      const icon = document.querySelector(`svg[aria-label="${label}"]`);
      if (icon) {
        let current = icon.parentElement;
        for (let i = 0; i < 5; i++) {
          if (current && current.offsetHeight > 40 && current.offsetHeight < 120 && !current.closest('div[role="navigation"]')) {
            if (!current.querySelector(".crm-capture-btn")) injectButton(current, "Instagram");
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
  const nameEl = header.querySelector('span[dir="auto"]') || header.querySelector('span');
  const name = nameEl ? nameEl.innerText.trim() : "Lead WhatsApp";
  const phone = name.replace(/\D/g, "").length >= 8 ? name : "";
  
  const messages = extractMessagesWhatsApp();
  await sendToERP({ name, phone, source: "whatsapp", notes: "Sincronizado via WhatsApp Web" }, messages);
}

async function captureLeadInstagram(header) {
  try {
    let name = "Lead Instagram";
    
    // 1. Precise selectors for common IG layouts
    const specificSelectors = [
      'h2 span', // Desktop header Title
      'span[role="link"]', // Common name link
      'div[role="button"] span', // Interactive headers
      'a[href*="/"] span', // Link to profile
      'div._ab8w span' // Obfuscated IG class
    ];

    for (const selector of specificSelectors) {
      const el = header.querySelector(selector);
      if (el && el.innerText.trim().length > 1 && !el.innerText.includes("Sua conversa")) {
        name = el.innerText.trim();
        break;
      }
    }

    if (name === "Lead Instagram") {
      // 2. Broad search: find first span that is actually text and not a status/number
      const allSpans = Array.from(header.querySelectorAll('span'));
      const likelyName = allSpans.find(s => 
        s.innerText.length > 2 && 
        s.innerText.length < 40 && 
        !s.innerText.includes("Ativo") && 
        !s.innerText.includes("Online")
      );
      if (likelyName) name = likelyName.innerText.trim();
    }

    console.log("Captured IG Name:", name);
    const messages = extractMessagesInstagram();
    await sendToERP({ name, source: "instagram", notes: "Sincronizado via Instagram Web" }, messages);
  } catch (err) {
    alert("Erro ao extrair nome: " + err.message);
  }
}

function extractMessagesWhatsApp() {
  const msgEls = document.querySelectorAll('.message-in, .message-out');
  return Array.from(msgEls).slice(-15).map(el => {
    const content = el.querySelector('.copyable-text span')?.innerText || el.innerText;
    return {
      content: content.trim(),
      sender: el.classList.contains('message-out') ? 'me' : 'lead',
      created_at: new Date().toISOString()
    };
  });
}

function extractMessagesInstagram() {
  const msgEls = document.querySelectorAll('div[role="row"]');
  return Array.from(msgEls).slice(-15).map(el => {
    const isMe = el.querySelector('div[style*="align-items: flex-end"]') || el.innerText.includes("Você enviou");
    return {
      content: el.innerText.split('\n')[0].trim(),
      sender: isMe ? 'me' : 'lead',
      created_at: new Date().toISOString()
    };
  });
}

async function sendToERP(leadData, messages = []) {
  try {
    const url = CONFIG.supabaseUrl;
    const key = CONFIG.supabaseKey;

    // 1. Upsert Lead (find by name/phone or create)
    const leadRes = await fetch(`${url}/rest/v1/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": key, "Authorization": `Bearer ${key}`, "Prefer": "return=representation" },
      body: JSON.stringify(leadData)
    });

    if (!leadRes.ok) throw new Error("Falha ao salvar lead");
    const [savedLead] = await leadRes.json();

    // 2. Save Messages
    if (messages.length > 0) {
      const msgData = messages.map(m => ({ ...m, lead_id: savedLead.id }));
      await fetch(`${url}/rest/v1/lead_messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": key, "Authorization": `Bearer ${key}` },
        body: JSON.stringify(msgData)
      });
    }

    alert(`✅ Lead "${leadData.name}" e conversa sincronizados!`);
  } catch (err) {
    alert("❌ Erro: " + err.message);
  }
}

// Manual capture from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "manualCapture") {
    const isWhatsApp = window.location.host.includes("whatsapp");
    const isInstagram = window.location.host.includes("instagram");
    if (isWhatsApp) { const h = document.querySelector("#main header"); if (h) captureLeadWhatsApp(h); }
    else if (isInstagram) { const h = document.querySelector('div[role="main"] header') || document.querySelector('div[role="dialog"] header'); if (h) captureLeadInstagram(h); }
  }
});

const observer = new MutationObserver(() => findTarget());
observer.observe(document.body, { childList: true, subtree: true });
setTimeout(findTarget, 2000);
