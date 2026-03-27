// Surgical Content Script for CellManager Extension (v1.2) - "The Clean One"
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
  .crm-capture-btn:hover { transform: scale(1.05); filter: brightness(1.1); box-shadow: 0 4px 10px rgba(0,0,0,0.2) !important; }
  .crm-capture-btn-instagram {
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888) !important;
  }
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
    // Only search in the main content area, avoiding sidebars and stories
    const mainArea = document.querySelector('div[role="main"]');
    if (!mainArea) return;

    // Look for the specific header of the active conversation
    const igHeader = mainArea.querySelector('header') || 
                     mainArea.querySelector('div[style*="height: 75px"]') ||
                     mainArea.querySelector('div[style*="height: 60px"]');

    // Extra precision: check if it contains the "Video Call" or "Informações" icons
    const conversationIcons = mainArea.querySelector('svg[aria-label="Direct"], svg[aria-label="Informações"], svg[aria-label="Expandir"]');
    const target = conversationIcons ? conversationIcons.closest('header') || conversationIcons.closest('div').parentElement : igHeader;

    if (target && !target.querySelector(".crm-capture-btn") && target.offsetHeight < 120) {
      // Final guard: Ensure it's not a sidebar item or a story
      const isSidebar = target.closest('div[role="navigation"]') || target.closest('div._aacz'); // common sidebar class
      if (!isSidebar) {
        injectButton(target, "Instagram");
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
    e.preventDefault();
    e.stopPropagation();
    if (platform === "WhatsApp") {
       captureLeadWhatsApp(parent);
    } else {
       captureLeadInstagram(parent);
    }
  };

  if (platform === "Instagram") {
    // Inject at the beginning of the header
    parent.prepend(btn);
  } else {
    // Append to the WhatsApp header (usually right-aligned)
    const secondary = parent.querySelector('div[role="button"]') || parent;
    secondary.appendChild(btn);
  }
}

async function captureLeadWhatsApp(header) {
  try {
    const nameEl = header.querySelector('span[dir="auto"]') || header.querySelector('span');
    const name = nameEl ? nameEl.innerText.trim() : "Lead WhatsApp";
    const phone = name.replace(/\D/g, "").length >= 8 ? name : "";
    
    await sendToERP({ name, phone, source: "whatsapp", notes: "Via WhatsApp Web" });
  } catch (err) {
    alert("Erro ao extrair dados: " + err.message);
  }
}

async function captureLeadInstagram(header) {
  try {
    const nameEl = header.querySelector('span[role="link"]') || 
                  header.querySelector('span._ap32') ||
                  header.querySelector('span');
                  
    const name = nameEl ? nameEl.innerText.trim() : "Lead Instagram";
    await sendToERP({ name, source: "instagram", notes: "Via Instagram Web" });
  } catch (err) {
    alert("Erro ao extrair dados: " + err.message);
  }
}

async function sendToERP(leadData) {
  try {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) {
      alert("⚠️ Erro de Extensão: Por favor, atualize esta página (F5).");
      return;
    }

    const settings = await chrome.storage.sync.get(["supabaseUrl", "supabaseKey"]);
    if (!settings?.supabaseUrl || !settings?.supabaseKey) {
      alert("⚠️ ERRO: Configure a URL e Chave do Supabase na extensão primeiro!");
      return;
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

    if (response.ok) {
      alert(`✅ Lead "${leadData.name}" enviado com sucesso!`);
    } else {
      const error = await response.json();
      alert("❌ Supabase: " + (error.message || JSON.stringify(error)));
    }
  } catch (err) {
    alert("❌ Erro de Conexão: " + err.message);
  }
}

const observer = new MutationObserver(() => {
  findTarget();
});

observer.observe(document.body, { childList: true, subtree: true });
setTimeout(findTarget, 2000);
