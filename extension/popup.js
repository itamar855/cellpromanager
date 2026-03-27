document.addEventListener("DOMContentLoaded", () => {
  const urlEl = document.getElementById("url");
  const keyEl = document.getElementById("key");
  const saveBtn = document.getElementById("save");
  const testBtn = document.getElementById("test");
  const statusEl = document.getElementById("status");

  function showStatus(msg, type) {
    statusEl.innerText = msg;
    statusEl.className = `status ${type}`;
    setTimeout(() => { statusEl.className = "status"; }, 4000);
  }

  // Load saved settings
  chrome.storage.sync.get(["supabaseUrl", "supabaseKey"], (data) => {
    if (data.supabaseUrl) urlEl.value = data.supabaseUrl;
    if (data.supabaseKey) keyEl.value = data.supabaseKey;
  });

  saveBtn.addEventListener("click", () => {
    const supabaseUrl = urlEl.value.trim().replace(/\/$/, "");
    const supabaseKey = keyEl.value.trim();

    if (!supabaseUrl || !supabaseKey) {
      showStatus("Preencha todos os campos", "error");
      return;
    }

    chrome.storage.sync.set({ supabaseUrl, supabaseKey }, () => {
      showStatus("Configurações salvas!", "success");
    });
  });

  testBtn.addEventListener("click", async () => {
    const url = urlEl.value.trim().replace(/\/$/, "");
    const key = keyEl.value.trim();
    
    if (!url || !key) {
      showStatus("Configure a URL e Chave primeiro!", "error");
      return;
    }

    showStatus("Testando conexão...", "success");

    try {
      const response = await fetch(`${url}/rest/v1/leads?limit=1`, {
        method: "GET",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${key}`
        }
      });

      if (response.ok) {
        showStatus("Conexão OK! Banco de dados acessível.", "success");
      } else {
        const err = await response.json();
        showStatus(`Falha: ${err.message || 'Erro RLS'}`, "error");
      }
    } catch (err) {
      showStatus(`Erro de rede: ${err.message}`, "error");
    }
  });
});
