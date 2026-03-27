// Balanced Content Script for CellManager Extension (v1.4)
console.log("CellManager CRM Extension Activity");

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
    // Search for header by analyzing all headers in the main/dialog areas
    const possibleHeaders = [
      ...document.querySelectorAll('div[role="main"] header'),
      ...document.querySelectorAll('div[role="dialog"] header'),
      ...document.querySelectorAll('div[role="presentation"] header')
    ];

    // Localized labels for the Info icon
    const infoLabels = [
      "Informações", "Information", "Informações da conversa", "Conversation Information",
      "Expandir", "Expand", "Ver detalhes", "Details", "Voltar", "Back"
    ];

    infoLabels.forEach(label => {
      const icon = document.querySelector(`svg[aria-label="${label}"]`);
      if (icon) {
        let current = icon.parentElement;
        for (let i = 0; i < 5; i++) {
          if (current && current.offsetHeight > 40 && current.offsetHeight < 150) {
            if (!current.closest('div[role="navigation"]') && !current.querySelector('._aacz')) {
              possibleHeaders.push(current);
            }
          }
          current = current?.parentElement;
        }
      }
    });

    for (const h of possibleHeaders) {
      if (h && h.offsetHeight > 30 && h.offsetHeight < 150 && !h.querySelector(".crm-capture-btn")) {
        console.log("IG Header Candidate:", h);
        injectButton(h, "Instagram");
        break; // Only one button per page
      }
    }
  }
}

function injectButton(parent, platform) {
  if (parent.querySelector(".crm-capture-btn")) return;
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
  await sendToERP({ name, phone, source: "whatsapp", notes: "Via WhatsApp Web" });
}

async function captureLeadInstagram(header) {
  try {
    let name = "Lead Instagram";
    
    // Attempt multiple strategies to find the name
    const selectors = [
      'span[role="link"]',
      'h2 span',
      'a[href*="/"] span',
      'div[role="button"] span',
      'span[dir="auto"]'
    ];

    for (const selector of selectors) {
      const el = header.querySelector(selector);
      if (el && el.innerText.trim().length > 1) {
        name = el.innerText.trim();
        break;
      }
    }

    if (name === "Lead Instagram") {
      // Fallback: search for any bold span or specific IG classes
      const boldSpan = header.querySelector('span[style*="font-weight: 600"]') || header.querySelector('span._ap32');
      if (boldSpan) name = boldSpan.innerText.trim();
    }

    console.log("Captured IG Name:", name);
    await sendToERP({ name, source: "instagram", notes: "Via Instagram Web" });
  } catch (err) {
    alert("Erro ao extrair nome: " + err.message);
  }
}

// Support for manual capture from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "manualCapture") {
    console.log("Manual Capture Triggered");
    const isWhatsApp = window.location.host.includes("whatsapp");
    const isInstagram = window.location.host.includes("instagram");
    
    if (isWhatsApp) {
      const header = document.querySelector("#main header");
      if (header) captureLeadWhatsApp(header);
      else alert("Aba do WhatsApp aberta, mas conversa não encontrada.");
    } else if (isInstagram) {
      // Find ANY header
      const header = document.querySelector('div[role="main"] header') || document.querySelector('div[role="dialog"] header');
      if (header) captureLeadInstagram(header);
      else alert("Aba do Instagram aberta, mas conversa não encontrada.");
    }
  }
});

async function sendToERP(leadData) {
  try {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) {
      alert("⚠️ Erro de Extensão: Atualize (F5) esta página."); return;
    }
    const settings = await chrome.storage.sync.get(["supabaseUrl", "supabaseKey"]);
    if (!settings?.supabaseUrl || !settings?.supabaseKey) {
      alert("⚠️ ERRO: Configure a URL e Chave na extensão!"); return;
    }
    const response = await fetch(`${settings.supabaseUrl.trim()}/rest/v1/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": settings.supabaseKey.trim(),
        "Authorization": `Bearer ${settings.supabaseKey.trim()}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(leadData)
    });
    if (response.ok) alert(`✅ Lead "${leadData.name}" enviado com sucesso!`);
    else { const error = await response.json(); alert("❌ Supabase: " + (error.message || JSON.stringify(error))); }
  } catch (err) { alert("❌ Erro de Conexão: " + err.message); }
}

const observer = new MutationObserver(() => { findTarget(); });
observer.observe(document.body, { childList: true, subtree: true });
setTimeout(findTarget, 2000);
