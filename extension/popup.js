document.addEventListener("DOMContentLoaded", () => {
  const urlEl = document.getElementById("url");
  const keyEl = document.getElementById("key");
  const saveBtn = document.getElementById("save");
  const statusEl = document.getElementById("status");

  // Load saved settings
  chrome.storage.sync.get(["supabaseUrl", "supabaseKey"], (data) => {
    if (data.supabaseUrl) urlEl.value = data.supabaseUrl;
    if (data.supabaseKey) keyEl.value = data.supabaseKey;
  });

  saveBtn.addEventListener("click", () => {
    const supabaseUrl = urlEl.value.trim();
    const supabaseKey = keyEl.value.trim();

    if (!supabaseUrl || !supabaseKey) {
      alert("Por favor, preencha todos os campos.");
      return;
    }

    chrome.storage.sync.set({ supabaseUrl, supabaseKey }, () => {
      statusEl.style.display = "block";
      setTimeout(() => { statusEl.style.display = "none"; }, 2000);
    });
  });
});
