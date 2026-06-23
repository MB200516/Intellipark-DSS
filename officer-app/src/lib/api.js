import AsyncStorage from '@react-native-async-storage/async-storage';

// ── PRODUCTION / REMOTE EVALUATOR SETUP ──────────────────────────
// When evaluators are on a different network than you (e.g. judging
// remotely), your LAN IP (192.168.x.x) is NOT reachable by them.
// Run `ngrok http 8000` on your machine, then paste the resulting
// public URL here. Use https:// and wss:// (not http/ws) since
// ngrok terminates TLS for you.
//
// Example after running ngrok:
//   Forwarding  https://a1b2-203-0-113-45.ngrok-free.app -> localhost:8000
//
// export const API_BASE = 'https://a1b2-203-0-113-45.ngrok-free.app';
// export const WS_BASE   = 'wss://a1b2-203-0-113-45.ngrok-free.app';
//
// ── LOCAL TESTING (same WiFi as your machine) ────────────────────
export const API_BASE = 'http://192.168.31.56:8000';
export const WS_BASE  = 'ws://192.168.31.56:8000';
async function getToken() {
  return AsyncStorage.getItem('officer_token');
}

export async function apiRequest(path, options = {}) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function officerLogin(badge, password) {
  const qs = new URLSearchParams({ badge, password }).toString();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let res;
  try {
    res = await fetch(`${API_BASE}/officer/login?${qs}`, {
      method: 'POST',
      signal: controller.signal,
    });
  } catch (networkErr) {
    clearTimeout(timeoutId);
    if (networkErr.name === 'AbortError') {
      throw new Error(`Request timed out. Cannot reach ${API_BASE} — check phone and PC are on the same WiFi.`);
    }
    throw new Error(`Network error reaching ${API_BASE}: ${networkErr.message}`);
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Server rejected login (${res.status}): ${text || 'Incorrect badge or password'}`);
  }
  const data = await res.json();
  await AsyncStorage.setItem('officer_token', data.access_token);
  await AsyncStorage.setItem('officer_info', JSON.stringify(data.officer));
  return data;
}

export async function officerLogout() {
  await AsyncStorage.removeItem('officer_token');
  await AsyncStorage.removeItem('officer_info');
}

export async function getStoredOfficer() {
  const raw = await AsyncStorage.getItem('officer_info');
  return raw ? JSON.parse(raw) : null;
}

export async function respondToAssignment(assignmentId, action) {
  const qs = new URLSearchParams({ action }).toString();
  return apiRequest(`/assignments/${assignmentId}/respond?${qs}`, { method: 'POST' });
}

export async function markArrived(assignmentId) {
  return apiRequest(`/assignments/${assignmentId}/arrived`, { method: 'POST' });
}

export async function completeAssignment(assignmentId, notes = '') {
  const qs = new URLSearchParams({ notes }).toString();
  return apiRequest(`/assignments/${assignmentId}/complete?${qs}`, { method: 'POST' });
}

export async function fetchMyAssignments() {
  return apiRequest('/officer/assignments');
}

// ── WebSocket connection for live location + assignment push ──────
export function connectOfficerSocket(officerId, handlers) {
  const ws = new WebSocket(`${WS_BASE}/ws/officer/${officerId}`);

  ws.onopen = () => handlers.onOpen && handlers.onOpen();
  ws.onclose = () => handlers.onClose && handlers.onClose();
  ws.onerror = (e) => handlers.onError && handlers.onError(e);
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'new_assignment' && handlers.onAssignment) {
        handlers.onAssignment(msg.assignment);
      }
    } catch (e) {
      console.warn('WS parse error', e);
    }
  };

  return {
    sendLocation: (lat, lng, accuracy) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'location_update', lat, lng, accuracy }));
      }
    },
    sendStatus: (status) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'status_change', status }));
      }
    },
    close: () => ws.close(),
    raw: ws,
  };
}
