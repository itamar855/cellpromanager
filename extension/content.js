// Robust Content Script for CellManager Extension (v1.1)
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
    position: relative !important;
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
    // Look for the main chat area header
    const waHeader = document.querySelector("#main header") || 
                   document.querySelector('header[role="toolbar"]')?.parentElement ||
                   document.querySelector('div[data-testid="conversation-panel-header"]');
                   
    if (waHeader && !waHeader.querySelector(".crm-capture-btn")) {
      injectButton(waHeader, "WhatsApp");
    }
  } else if (isInstagram) {
    // Broad search for Instagram DM header
    const possibleHeaders = [
      document.querySelector('div[role="main"] header'),
      document.querySelector('div[role="presentation"] header'),
      document.querySelector('header[role="banner"]'),
      document.querySelector('div._aa61'),
      document.querySelector('div[style*="height: 75px"]'),
      document.querySelector('svg[aria-label="Expandir"]')?.closest('div')?.parentElement,
      document.querySelector('svg[aria-label="Informações"]')?.closest('div')?.parentElement,
      // Fallback: look for the element that contains the icons
      document.querySelector('svg[aria-label="Encaminhar"]') ? document.querySelector('svg[aria-label="Encaminhar"]').closest('div').parentElement : null
    ];

    for (const h of possibleHeaders) {
      if (h && h.offsetHeight > 40 && !h.querySelector(".crm-capture-btn")) {
        console.log("IG Header Found");
        injectButton(h, "Instagram");
        break;
      }
    }
  }
}

function injectButton(parent, platform) {
  const btn = document.createElement("button");
  btn.className = platform === "Instagram" ? "crm-capture-btn crm-capture-btn-instagram" : "crm-capture-btn";
  btn.innerText = "Enviar p/ CRM";
  
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Click CRM on ${platform}`);
    if (platform === "WhatsApp") {
       captureLeadWhatsApp(parent);
    } else {
       captureLeadInstagram(parent);
    }
  };

  // Improved injection strategy
  if (platform === "Instagram") {
    // For Instagram, we prepend to the leftmost container
    parent.prepend(btn);
  } else {
    // For WhatsApp, append to the main header or inside the button group
    const secondary = parent.querySelector('div[role="button"]') || parent;
    secondary.appendChild(btn);
  }
}

async function captureLeadWhatsApp(header) {
  try {
    const nameEl = header.querySelector('span[dir="auto"]') || header.querySelector('span');
    const name = nameEl ? nameEl.innerText.trim() : "Lead WhatsApp " + Date.now();
    const phone = name.replace(/\D/g, "").length >= 8 ? name : "";
    
    await sendToERP({ name, phone, source: "whatsapp", notes: "Via WhatsApp Web" });
  } catch (err) {
    alert("Erro ao extrair dados (WhatsApp): " + err.message);
  }
}

async function captureLeadInstagram(header) {
  try {
    // Get the name from the title or link in the header
    const nameEl = header.querySelector('span[role="link"]') || 
                  header.querySelector('span._ap32') ||
                  header.querySelector('span') ||
                  header.querySelector('div[role="button"] span');
                  
    const name = nameEl ? nameEl.innerText.trim() : "Lead Instagram " + Date.now();
    await sendToERP({ name, source: "instagram", notes: "Via Instagram Web" });
  } catch (err) {
    alert("Erro ao extrair dados (Instagram): " + err.message);
  }
}

async function sendToERP(leadData) {
  console.log("Sending Lead Data:", leadData);
  try {
    const settings = await chrome.storage.sync.get(["supabaseUrl", "supabaseKey"]);
    if (!settings.supabaseUrl || !settings.supabaseKey) {
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

// Global Observer to handle dynamic content
const observer = new MutationObserver(() => {
  findTarget();
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial call
setTimeout(findTarget, 2000);
