// Content Script for WhatsApp and Instagram
console.log("CellManager Extension Loaded");

function addCaptureButton() {
  const isWhatsApp = window.location.host.includes("whatsapp");
  const isInstagram = window.location.host.includes("instagram");

  if (isWhatsApp) {
    // WhatsApp logic
    const header = document.querySelector("#main header");
    if (header && !header.querySelector(".crm-capture-btn")) {
      const btn = document.createElement("button");
      btn.className = "crm-capture-btn";
      btn.innerText = "Enviar p/ CRM";
      btn.onclick = () => captureLeadWhatsApp(header);
      header.appendChild(btn);
    }
  } else if (isInstagram) {
    // Instagram logic
    const directHeader = document.querySelector('header[role="banner"]') || document.querySelector('div[role="main"] header');
    if (directHeader && !directHeader.querySelector(".crm-capture-btn")) {
      const btn = document.createElement("button");
      btn.className = "crm-capture-btn crm-capture-btn-instagram";
      btn.innerText = "Enviar p/ CRM";
      btn.onclick = () => captureLeadInstagram(directHeader);
      directHeader.appendChild(btn);
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
