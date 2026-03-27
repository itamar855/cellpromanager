async function updateUI() {
  const data = await chrome.storage.local.get(['activeLeadId', 'activeLeadName', 'automationStatus', 'queueCount']);
  
  document.getElementById('active-lead-name').innerText = data.activeLeadName || 'Nenhum';
  document.getElementById('active-lead-id').innerText = data.activeLeadId ? `ID: ${data.activeLeadId.slice(0,8)}...` : 'Nenhum lead monitorado';
  document.getElementById('automation-status').innerText = data.automationStatus || 'Aguardando comando...';
  document.getElementById('queue-count').innerText = data.queueCount || '0';

  const progress = document.getElementById('progress-fill');
  if (data.automationStatus && data.automationStatus.includes('Enviando')) {
    progress.style.width = '70%';
  } else if (data.automationStatus && data.automationStatus.includes('Busca')) {
    progress.style.width = '40%';
  } else {
    progress.style.width = '0%';
  }
}

document.getElementById('open-whatsapp').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://web.whatsapp.com' });
});

setInterval(updateUI, 1000);
updateUI();
