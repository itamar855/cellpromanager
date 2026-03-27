// Content Script for WhatsApp and Instagram
console.log("CellManager Extension Loaded");

function addCaptureButton() {
  const isWhatsApp = window.location.host.includes("whatsapp");
  const isInstagram = window.location.host.includes("instagram");

  if (isWhatsApp) {
    // WhatsApp logic
    const header = document.querySelector("#main header") || document.querySelector('header[role="toolbar"]').parentElement;
    if (header && !header.querySelector(".crm-capture-btn")) {
      const btn = document.createElement("button");
      btn.className = "crm-capture-btn";
      btn.innerText = "Enviar p/ CRM";
      btn.style.zIndex = "9999";
      btn.onclick = (e) => { e.stopPropagation(); captureLeadWhatsApp(header); };
      header.appendChild(btn);
    }
  } else if (isInstagram) {
    // Instagram logic - look for any header in the DM area
    const directHeader = document.querySelector('div[role="main"] header') || 
                       document.querySelector('div[style*="height: 75px"]') || 
                       document.querySelector('div._aa61') ||
                       document.querySelector('div[role="presentation"] header'); // Added common modal header
    
    // Find based on icons in the header (Expand, Info, etc)
    const iconsInHeader = document.querySelector('svg[aria-label="Expandir"]') || 
                         document.querySelector('svg[aria-label="Informações"]') ||
                         document.querySelector('svg[aria-label="Conversation Information"]');
    
    const target = iconsInHeader ? iconsInHeader.closest('div').parentElement : directHeader;

    if (target && !target.querySelector(".crm-capture-btn")) {
      const btn = document.createElement("button");
      btn.className = "crm-capture-btn crm-capture-btn-instagram";
      btn.innerText = "CRM";
      btn.style.marginRight = "10px";
      btn.style.padding = "2px 8px";
      btn.style.height = "24px";
      btn.style.zIndex = "9999";
      btn.onclick = (e) => { e.stopPropagation(); captureLeadInstagram(target); };
      
      // Inject next to the icons or at the start
      if (iconsInHeader) {
        iconsInHeader.closest('div').prepend(btn);
      } else {
        target.prepend(btn);
      }
    }
  }
}

async function captureLeadWhatsApp(header) {
  const nameElement = header.querySelector('span[dir="auto"]');
  const name = nameElement ? nameElement.innerText : "Lead WhatsApp";
  const phone = name.replace(/\D/g, "").length >= 8 ? name : ""; // Attempt to extract phone if name is a phone number

  const leadData = { name, phone, source: "whatsapp", notes: "Capturado via Extensão" };
  await sendToERP(leadData);
}

async function captureLeadInstagram(header) {
  const nameElement = header.querySelector('span'); // Simplified logic for demo
  const name = nameElement ? nameElement.innerText : "Lead Instagram";
  const leadData = { name, source: "instagram", notes: "Capturado via Extensão" };
  await sendToERP(leadData);
}

async function sendToERP(leadData) {
  const settings = await chrome.storage.sync.get(["supabaseUrl", "supabaseKey"]);
  if (!settings.supabaseUrl || !settings.supabaseKey) {
    alert("Por favor, configure sua URL e Chave do Supabase na extensão!");
    return;
  }

  try {
    const response = await fetch(`${settings.supabaseUrl}/rest/v1/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": settings.supabaseKey,
        "Authorization": `Bearer ${settings.supabaseKey}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(leadData)
    });

    if (response.ok) {
      alert(`Lead ${leadData.name} enviado com sucesso!`);
    } else {
      const error = await response.json();
      alert("Erro ao enviar lead: " + error.message);
    }
  } catch (err) {
    alert("Erro de conexão: " + err.message);
  }
}

// Check for chat changes periodically
setInterval(addCaptureButton, 2000);
