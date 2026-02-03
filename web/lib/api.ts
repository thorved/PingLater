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

  // Webhooks
  async getWebhooks(token: string) {
    const res = await fetch(`${API_URL}/api/webhooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch webhooks');
    return res.json();
  },

  async createWebhook(token: string, data: { 
    url: string; 
    secret?: string; 
    description?: string; 
    event_types: string[]; 
    is_active: boolean;
    filter_phone_numbers?: string[];
    filter_phone_match_type?: string;
    filter_chat_type?: string;
    filter_group_jids?: string[];
    filter_group_names?: string[];
  }) {
    const res = await fetch(`${API_URL}/api/webhooks`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create webhook');
    return res.json();
  },

  async updateWebhook(token: string, id: number, data: { 
    url?: string; 
    secret?: string; 
    description?: string; 
    event_types?: string[]; 
    is_active?: boolean;
    filter_phone_numbers?: string[];
    filter_phone_match_type?: string;
    filter_chat_type?: string;
    filter_group_jids?: string[];
    filter_group_names?: string[];
  }) {
    const res = await fetch(`${API_URL}/api/webhooks/${id}`, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Failed to update webhook: ${res.status}`);
    }
    return res.json();
  },

  async deleteWebhook(token: string, id: number) {
    const res = await fetch(`${API_URL}/api/webhooks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to delete webhook');
    return res.json();
  },

  async getWebhookEvents(token: string) {
    const res = await fetch(`${API_URL}/api/webhooks/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch webhook events');
    return res.json();
  },

  async getWebhookDeliveries(token: string, id: number, params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    
    const res = await fetch(`${API_URL}/api/webhooks/${id}/deliveries?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch webhook deliveries');
    return res.json();
  },

  async getWebhookStats(token: string, id: number) {
    const res = await fetch(`${API_URL}/api/webhooks/${id}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch webhook stats');
    return res.json();
  },

  async testWebhook(token: string, id: number) {
    const res = await fetch(`${API_URL}/api/webhooks/${id}/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to test webhook');
    return res.json();
  },

  // API Tokens
  async getAPITokens(token: string) {
    const res = await fetch(`${API_URL}/api/auth/tokens`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch API tokens');
    return res.json();
  },

  async getAvailableScopes(token: string) {
    const res = await fetch(`${API_URL}/api/auth/tokens/scopes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch available scopes');
    return res.json();
  },

  async createAPIToken(token: string, data: { name: string; scopes: string[]; expires_at?: string | null }) {
    const res = await fetch(`${API_URL}/api/auth/tokens`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create API token');
    return res.json();
  },

  async deleteAPIToken(token: string, id: number) {
    const res = await fetch(`${API_URL}/api/auth/tokens/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to delete API token');
    return res.json();
  },

  async rotateAPIToken(token: string, id: number) {
    const res = await fetch(`${API_URL}/api/auth/tokens/${id}/rotate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to rotate API token');
    return res.json();
  },

  async updateAPIToken(token: string, id: number, data: { name?: string; is_active?: boolean }) {
    const res = await fetch(`${API_URL}/api/auth/tokens/${id}`, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update API token');
    return res.json();
  },
};

