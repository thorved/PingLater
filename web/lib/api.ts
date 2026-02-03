const API_URL = process.env.NEXT_PUBLIC_API_URL || '/';

export const api = {
  async login(username: string, password: string) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },

  async getMe(token: string) {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
  },

  async getWhatsAppStatus(token: string) {
    const res = await fetch(`${API_URL}/api/whatsapp/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch WhatsApp status');
    return res.json();
  },

  async connectWhatsApp(token: string) {
    const res = await fetch(`${API_URL}/api/whatsapp/connect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to connect WhatsApp');
    return res.json();
  },

  async disconnectWhatsApp(token: string, clearSession = false) {
    const url = clearSession 
      ? `${API_URL}/api/whatsapp/disconnect?clear=true`
      : `${API_URL}/api/whatsapp/disconnect`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to disconnect WhatsApp');
    return res.json();
  },

  async getMetrics(token: string) {
    const res = await fetch(`${API_URL}/api/whatsapp/metrics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
  },

  async sendMessage(token: string, phoneNumber: string, message: string) {
    const res = await fetch(`${API_URL}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone_number: phoneNumber, message }),
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },

  subscribeToEvents(token: string, onEvent: (event: any) => void, onError?: (error: any) => void) {
    const es = new EventSource(
      `${API_URL}/api/whatsapp/events?token=${token}`,
      { withCredentials: false }
    );

    es.onopen = () => {
      console.log('Events SSE Connection opened');
    };

    // Listen for specific event types
    const eventTypes = ['connected', 'disconnected', 'message_sent', 'message_received', 'qr_generated', 'connection_error'];
    
    eventTypes.forEach(eventType => {
      es.addEventListener(eventType, (event) => {
        try {
          const data = JSON.parse(event.data);
          onEvent({ type: eventType, data });
        } catch (e) {
          onEvent({ type: eventType, data: event.data });
        }
      });
    });

    // Handle ping events (heartbeat) silently
    es.addEventListener('ping', () => {
      // Heartbeat received - connection is alive
    });

    // Also listen for generic messages
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent({ type: 'message', data });
      } catch (e) {
        onEvent({ type: 'message', data: event.data });
      }
    };

    es.onerror = (error) => {
      console.error('Events SSE Error:', error);
      if (onError) onError(error);
    };

    return es;
  },
};
