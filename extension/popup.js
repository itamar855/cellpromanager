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
    // ... logic remains
  });

  const manualBtn = document.getElementById("manual");
  manualBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: "manualCapture" });
      showStatus("Solicitando captura...", "success");
    }
  });
});
