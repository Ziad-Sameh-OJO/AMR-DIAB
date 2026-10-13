// Admin Panel Client Logic
let allKeys = [];
let currentFilter = 'all';

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  t.style.display = 'flex';
  setTimeout(() => {
    t.style.display = 'none';
  }, 3000);
}

// Format date relative or concise
function formatExpiry(iso) {
  if (!iso) return 'Lifetime';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return '<span style="color:#f87171;">Expired</span>';
  const days = Math.floor(diff / (24 * 3600 * 1000));
  const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
  if (days > 365) return 'Lifetime';
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

// Fetch and render overview statistics
async function loadOverview() {
  try {
    const res = await fetch('/api/admin/overview');
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('stat-total-keys').innerText = data.totalKeys;
    document.getElementById('stat-active-keys').innerText = data.activeKeys;
    document.getElementById('stat-unbound-keys').innerText = data.unboundKeys;
    document.getElementById('stat-connected-users').innerText = `${data.totalUsers} users`;
    
    const maintEl = document.getElementById('stat-maintenance-status');
    if (data.maintenance && data.maintenance.enabled) {
      maintEl.innerText = 'ON (Paused)';
      maintEl.style.color = '#f59e0b';
    } else {
      maintEl.innerText = 'OFF (Normal)';
      maintEl.style.color = '#10b981';
    }

    // Set maintenance form
    const mToggle = document.getElementById('maint-toggle');
    const mAllowed = document.getElementById('maint-allowed');
    const mMsg = document.getElementById('maint-msg');
    if (mToggle && data.maintenance) {
      mToggle.checked = !!data.maintenance.enabled;
      mAllowed.value = (data.maintenance.allowed_logins || []).join(', ');
      mMsg.value = data.maintenance.message || '';
    }

    // Render nodes
    const nodesList = document.getElementById('nodes-list');
    if (nodesList && data.nodes) {
      nodesList.innerHTML = data.nodes.map(n => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#09090b; border:1px solid var(--card-border); border-radius:8px; font-size:11px;">
          <div>
            <span style="font-size:13px; margin-right:4px;">${n.flag}</span>
            <span style="font-weight:700; color:#fff;">${n.name}</span>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <span style="color:#10b981; font-weight:600;">${n.ping}ms</span>
            <span style="color:#8a8a8e;">${n.users || 0} active</span>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Failed to load overview:', e);
  }
}

// Fetch and render keys table
async function loadKeys() {
  try {
    const res = await fetch('/api/admin/keys');
    if (!res.ok) return;
    const data = await res.json();
    allKeys = data.keys || [];
    renderKeysTable();
  } catch (e) {
    console.error('Failed to load keys:', e);
  }
}

function renderKeysTable() {
  const tbody = document.getElementById('keys-tbody');
  if (!tbody) return;

  const search = (document.getElementById('key-search').value || '').trim().toLowerCase();

  const filtered = allKeys.filter(k => {
    // Search match
    const matchSearch = !search || 
      k.key.toLowerCase().includes(search) || 
      (k.bound_hwid && k.bound_hwid.toLowerCase().includes(search)) ||
      (k.note && k.note.toLowerCase().includes(search));

    if (!matchSearch) return false;

    // Filter tab
    const isExpired = new Date(k.expires_at).getTime() <= Date.now();
    if (currentFilter === 'active') return k.status === 'active' && !isExpired;
    if (currentFilter === 'unbound') return !k.bound_hwid && k.status === 'active';
    if (currentFilter === 'expired') return isExpired;
    if (currentFilter === 'revoked') return k.status === 'revoked';
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:#8a8a8e;">No license keys match the selected filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(k => {
    const isExpired = new Date(k.expires_at).getTime() <= Date.now();
    let badgeClass = 'badge-active';
    let badgeLabel = 'Active';

    if (k.status === 'revoked') {
      badgeClass = 'badge-revoked';
      badgeLabel = 'Revoked';
    } else if (isExpired) {
      badgeClass = 'badge-expired';
      badgeLabel = 'Expired';
    } else if (!k.bound_hwid) {
      badgeClass = 'badge-unbound';
      badgeLabel = 'Unbound';
    }

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <code style="font-weight:700; color:#fff; font-size:12px;">${k.key}</code>
            <button onclick="copyText('${k.key}')" class="btn-action" style="padding:2px 5px;" title="Copy Key">📋</button>
          </div>
        </td>
        <td>
          <span class="badge ${badgeClass}">${badgeLabel}</span>
        </td>
        <td>
          ${k.bound_hwid 
            ? `<div><span style="font-size:11px; font-weight:700; color:#fff;">${k.device_model || 'Unknown Device'}</span><br/><span style="font-size:10px; color:#8a8a8e;">${k.bound_hwid}</span></div>` 
            : `<span style="color:#60a5fa; font-size:11px;">(Ready for binding)</span>`
          }
        </td>
        <td style="font-size:11px;">
          ${formatExpiry(k.expires_at)}
        </td>
        <td style="font-size:11px; color:#8a8a8e;">
          ${k.note || '—'}
        </td>
        <td style="text-align:right;">
          <div class="action-group" style="justify-content:flex-end;">
            ${k.bound_hwid ? `<button onclick="unbindKey('${k.key}')" class="btn-action" title="Reset HWID lock">Unbind HWID</button>` : ''}
            <button onclick="extendKey('${k.key}')" class="btn-action" title="Extend 30 Days">+30d</button>
            <button onclick="toggleKeyStatus('${k.key}')" class="btn-action" style="${k.status === 'revoked' ? 'color:#34d399;' : 'color:#f87171;'}">
              ${k.status === 'revoked' ? 'Reactivate' : 'Revoke'}
            </button>
            <button onclick="deleteKey('${k.key}')" class="btn-action btn-admin-danger">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Copy helper
window.copyText = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied to clipboard: ${text}`);
  }).catch(() => {
    showToast(`Key: ${text}`);
  });
};

// Key Actions
window.unbindKey = async function(key) {
  try {
    const res = await fetch(`/api/admin/keys/${encodeURIComponent(key)}/unbind`, { method: 'POST' });
    if (res.ok) {
      showToast(`Device lock removed for ${key}`);
      loadKeys();
      loadOverview();
    }
  } catch (e) {
    showToast('Failed to unbind device');
  }
};

window.extendKey = async function(key) {
  try {
    const res = await fetch(`/api/admin/keys/${encodeURIComponent(key)}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 30 })
    });
    if (res.ok) {
      showToast(`Extended ${key} by 30 days`);
      loadKeys();
      loadOverview();
    }
  } catch (e) {
    showToast('Failed to extend key');
  }
};

window.toggleKeyStatus = async function(key) {
  try {
    const res = await fetch(`/api/admin/keys/${encodeURIComponent(key)}/toggle-status`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      showToast(`Key status updated to: ${data.status}`);
      loadKeys();
      loadOverview();
    }
  } catch (e) {
    showToast('Failed to change key status');
  }
};

window.deleteKey = async function(key) {
  if (!confirm(`Are you sure you want to permanently delete license ${key}?`)) return;
  try {
    const res = await fetch(`/api/admin/keys/${encodeURIComponent(key)}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`Deleted key ${key}`);
      loadKeys();
      loadOverview();
    }
  } catch (e) {
    showToast('Failed to delete key');
  }
};

// Event Listeners Setup
document.addEventListener('DOMContentLoaded', () => {
  loadOverview();
  loadKeys();

  // Search input
  const searchInput = document.getElementById('key-search');
  if (searchInput) {
    searchInput.addEventListener('input', renderKeysTable);
  }

  // Refresh button
  const refreshBtn = document.getElementById('refresh-keys-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadOverview();
      loadKeys();
      showToast('Data refreshed');
    });
  }

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-tab').forEach(t => {
        t.style.background = 'rgba(255, 255, 255, 0.05)';
        t.style.color = '#cacaca';
        t.style.fontWeight = 'normal';
      });
      tab.style.background = '#fff';
      tab.style.color = '#000';
      tab.style.fontWeight = '700';
      currentFilter = tab.getAttribute('data-filter') || 'all';
      renderKeysTable();
    });
  });

  // Generate Key Form
  const genForm = document.getElementById('gen-key-form');
  if (genForm) {
    genForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prefix = document.getElementById('gen-prefix').value.trim() || 'PHTM';
      const days = document.getElementById('gen-duration').value;
      const count = document.getElementById('gen-count').value;
      const note = document.getElementById('gen-note').value.trim();

      try {
        const res = await fetch('/api/admin/keys/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix, days, count, note })
        });
        const data = await res.json();
        if (res.ok && data.keys && data.keys.length > 0) {
          const latest = data.keys[0].key;
          document.getElementById('gen-result-key').innerText = latest;
          document.getElementById('gen-result').style.display = 'block';
          
          document.getElementById('copy-latest-key-btn').onclick = () => {
            copyText(latest);
          };

          showToast(`Successfully created ${data.keys.length} key(s)!`);
          loadKeys();
          loadOverview();
        }
      } catch (err) {
        showToast('Error generating keys');
      }
    });
  }

  // Maintenance Form
  const maintForm = document.getElementById('maint-form');
  if (maintForm) {
    maintForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const enabled = document.getElementById('maint-toggle').checked;
      const allowed_logins = document.getElementById('maint-allowed').value;
      const message = document.getElementById('maint-msg').value;

      try {
        const res = await fetch('/api/admin/maintenance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled, allowed_logins, message })
        });
        if (res.ok) {
          showToast('Maintenance settings saved and broadcasted to clients');
          loadOverview();
        }
      } catch (err) {
        showToast('Error saving maintenance settings');
      }
    });
  }
});
