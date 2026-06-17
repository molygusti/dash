const navButtons = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const peerCountEl = document.getElementById('peer-count');
const gateway = 'ws://${window.location.hostname}/ws';
let webSocket = null;

function openWebSocket() {
  console.log('Membuka koneksi WebSocket...');
  webSocket = new WebSocket(gateway);

  webSocket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    if (data.uptime !== undefined) document getElementById('uptime').textContent = data.uptime;
    if (data.temp !== undefined) document.getElementById('temp').textContent = data.temp;
  };

  webSocket.onclose = () => setTimeout(openWebSocket, 1000);
}

function setActivePage(pageId) {
  pages.forEach((page) => {
    page.classList.toggle('hidden', page.id !== `page-${pageId}`);
  });
  navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.page === pageId);
  });
}

async function handleNavClick(event) {
  const button = event.currentTarget;
  const pageId = button.dataset.page;
  setActivePage(pageId);

  const payload = { button_id: button.id };
  try {
    const response = await fetch('/navbar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      // 1. Ambil data JSON respons dari ESP32
      const data = await response.json(); 
      
      // 2. Jika user menekan tombol home, perbarui angka peer-count
      if (button.id === 'nav-home') { // Sesuaikan 'home-btn' dengan id tombol home kamu
        const peerCountElement = document.getElementById('peer-count');
        const peerActiveElement = document.getElementById('peer-active');
        if (peerCountElement && data.peer_count !== undefined) {
          peerCountElement.textContent = data.peer_count;
        }
        if (peerActiveElement && data.peer_active !== undefined) {
          peerActiveElement.textContent = data.peer_active;
        }
      } else if (button.id === 'nav-device') { // Sesuaikan 'home-btn' dengan id tombol home kamu
        // Daftar perangkat
      } else if (button.id === 'nav-config') { // Sesuaikan 'home-btn' dengan id tombol home kamu
        const form = document.getElementById('config-form');
        if (form) {
          if (data.ip) form.ip.value = data.ip;
          if (data.gateway) form.gateway.value = data.gateway;
          if (data.netmask) form.netmask.value = data.netmask;
          if (data.mac_address) form.mac_address.value = data.mac_address;
          if (data.ssid) form.ssid.value = data.ssid;
        }
      } else if (button.id === 'nav-update') { // Sesuaikan 'home-btn' dengan id tombol home kamu
        const form = document.getElementById('update-form');
        if (form) {
          if (data.server_ip) form.server_ip.value = data.server_ip;
          if (data.server_port) form.server_port.value = data.server_port;
          if (data.server_path) form.server_path.value = data.server_path;
        }
      }
    }
  } catch (error) {
    console.warn('Gagal mengirim nav action:', error);
  }
}

async function handlePeerSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const mac_address = form.mac_address.value.trim();
  const device_name = form.device_name.value.trim();

  if (!mac_address || !device_name) return;

  try {
    const response = await fetch('/api/add-peer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mac_address, device_name }),
    });

    if (response.ok) {
      const result = await response.json();
      peerCountEl.textContent = result.peer_count ?? parseInt(peerCountEl.textContent, 10) + 1;
      form.reset();
      alert('Peer berhasil ditambahkan.');
    } else {
      const error = await response.text();
      alert(`Gagal menambahkan peer: ${error}`);
    }
  } catch (error) {
    console.error('Error menambahkan peer:', error);
    alert('Terjadi kesalahan saat menambahkan peer.');
  }
}

async function handleFileUpload(event) {
    const fileInput = document.getElementById('fileInput');
    if (fileInput.files.length === 0) {
        alert('Silakan pilih file terlebih dahulu!');
        return;
    }

    const file = fileInput.files[0];

    try {
        // Kirim langsung isi file sebagai body (bukan FormData)
        const response = await fetch('/update-web-server', {
            method: 'POST',
            headers: {
                // Kita selipkan nama file di custom header agar ESP32 tahu namanya
                'X-File-Name': file.name, 
                'Content-Type': 'application/octet-stream'
            },
            body: file // Mengirimkan file murni secara biner/teks
        });

        if (response.ok) {
            alert('Pembaruan Web Sukses!');
        } else {
            alert('Gagal mengunggah file.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function handleUpdateSubmit(event) {
    event.preventDefault();
    const form = event.target;
    try {
        const response = await fetch('/update', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

async function init() {
  navButtons.forEach((button) => button.addEventListener('click', handleNavClick));

  try {
    const response = await fetch('/navbar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ button_id: 'nav-home' }), // Pura-pura menekan tombol home
    });
    if (response.ok) {
      const data = await response.json();
      document.getElementById('peer-count').textContent = data.peer_count;
    }
  } catch (err) {
    console.warn("Gagal load data awal:", err);
  }

  const peerForm = document.getElementById('peer-form');
  const configForm = document.getElementById('config-form');

  peerForm.addEventListener('submit', handlePeerSubmit);

  configForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const payload = {
      ip: form.ip.value.trim(),
      gateway: form.gateway.value.trim(),
      netmask: form.netmask.value.trim(),
      mac_address: form.mac_address.value.trim(),
      ssid: form.ssid.value.trim(),
      pass_ssid: form.pass_ssid.value,
    };

    try {
      const response = await fetch('/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert('Konfigurasi tersimpan.');
      } else {
        const text = await response.text();
        alert(`Gagal menyimpan konfigurasi: ${text}`);
      }
    } catch (error) {
      console.error('Error menyimpan konfigurasi:', error);
      alert('Terjadi kesalahan saat menyimpan konfigurasi.');
    }
  });
}

init();
openWebSocket();