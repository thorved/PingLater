# PingLater API Documentation

## Overview

PingLater provides a REST API for programmatic access to WhatsApp messaging and account management. The API supports both **JWT session authentication** (for web UI) and **API token authentication** (for external integrations).

**Base URL:** `http://localhost:8080/api` (or your configured domain)

---

## Authentication

The API supports two authentication methods:

### 1. JWT Session Authentication

Used by the web UI. Obtain a JWT token by logging in:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "username": "admin"
}
```

**Usage:** Include the token in the Authorization header:
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  http://localhost:8080/api/auth/me
```

### 2. API Token Authentication

Used for external integrations. Create API tokens via the web UI at `/settings/api-tokens`.

**Token Format:** `plt_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**Usage:** Include the token in the Authorization header:
```bash
curl -H "Authorization: Bearer plt_live_abc123..." \
  http://localhost:8080/api/whatsapp/status
```

---

## API Token Scopes

API tokens can have the following scopes:

| Scope | Description |
|-------|-------------|
| `all` | Full access to all API endpoints |
| `messages:send` | Send WhatsApp messages |
| `messages:read` | Read message history |
| `metrics:read` | Access dashboard metrics |
| `status:read` | Check WhatsApp connection status |

**Note:** Webhook management requires JWT session authentication and cannot be accessed via API tokens.

---

## Endpoints

### Authentication

#### POST /auth/login
Authenticate and receive a JWT token.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "string",
  "username": "string"
}
```

#### POST /auth/logout
Logout (client-side token removal).

**Auth Required:** No

#### GET /auth/me
Get current user information.

**Auth Required:** Yes (JWT)

**Response:**
```json
{
  "user_id": 1,
  "username": "admin"
}
```

---

### API Token Management

These endpoints require JWT authentication.

#### GET /auth/tokens
List all API tokens for the current user.

**Auth Required:** Yes (JWT)

**Response:**
```json
{
  "tokens": [
    {
      "id": 1,
      "name": "Production API",
      "scopes": ["messages:send"],
      "is_active": true,
      "expires_at": "2025-12-31T23:59:59Z",
      "last_used_at": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### POST /auth/tokens
Create a new API token.

**Auth Required:** Yes (JWT)

**Request:**
```json
{
  "name": "Production API",
  "scopes": ["messages:send", "status:read"],
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Production API",
  "token": "plt_live_abc123xyz789...",
  "scopes": ["messages:send", "status:read"],
  "expires_at": "2025-12-31T23:59:59Z",
  "created_at": "2024-01-15T10:30:00Z"
}
```

⚠️ **Important:** The `token` field is shown only once. Copy it immediately!

#### GET /auth/tokens/scopes
Get all available scopes.

**Auth Required:** Yes (JWT)

**Response:**
```json
{
  "scopes": ["all", "messages:send", "messages:read", "metrics:read", "status:read"]
}
```

#### DELETE /auth/tokens/:id
Revoke an API token.

**Auth Required:** Yes (JWT)

#### POST /auth/tokens/:id/rotate
Rotate/regenerate an API token.

**Auth Required:** Yes (JWT)

**Response:**
```json
{
  "id": 1,
  "name": "Production API",
  "token": "plt_live_newtoken456...",
  "scopes": ["messages:send"],
  "expires_at": "2025-12-31T23:59:59Z",
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### PUT /auth/tokens/:id
Update token properties (name, active status).

**Auth Required:** Yes (JWT)

**Request:**
```json
{
  "name": "Updated Name",
  "is_active": false
}
```

---

### WhatsApp

#### GET /whatsapp/status
Get WhatsApp connection status.

**Auth Required:** Yes (JWT or API Token with `status:read` or `all` scope)

**Response:**
```json
{
  "connected": true,
  "phone_number": "+1234567890"
}
```

#### POST /whatsapp/connect
Connect to WhatsApp (generates QR code).

**Auth Required:** Yes (JWT or API Token with appropriate scope)

#### POST /whatsapp/disconnect
Disconnect from WhatsApp.

**Auth Required:** Yes (JWT or API Token with appropriate scope)

**Query Parameters:**
- `clear` (boolean): Clear session data

#### POST /whatsapp/send
Send a WhatsApp message.

**Auth Required:** Yes (JWT or API Token with `messages:send` or `all` scope)

**Request:**
```json
{
  "phone_number": "1234567890",
  "message": "Hello, World!"
}
```

**Response:**
```json
{
  "message": "Message sent successfully",
  "to": "1234567890"
}
```

#### GET /whatsapp/events
Subscribe to real-time events via Server-Sent Events (SSE).

**Auth Required:** Yes (JWT or API Token)

**Query Parameters:**
- `token` (string): Authentication token

**Events:**
- `connected` - WhatsApp connected
- `disconnected` - WhatsApp disconnected
- `message_sent` - Message sent
- `message_received` - Message received
- `qr_generated` - QR code generated
- `connection_error` - Connection error

#### GET /whatsapp/metrics
Get dashboard metrics.

**Auth Required:** Yes (JWT or API Token with `metrics:read` or `all` scope)

**Response:**
```json
{
  "connected": true,
  "phone_number": "+1234567890",
  "last_connected_at": "2024-01-15T10:30:00Z",
  "total_messages_sent": 42,
  "total_messages_received": 15,
  "connection_uptime_seconds": 3600
}
```

---

### Webhooks

**Note:** Webhook management requires JWT session authentication. API tokens cannot be used for webhook operations.

#### GET /webhooks
List all webhooks.

**Auth Required:** Yes (JWT)

#### POST /webhooks
Create a new webhook.

**Auth Required:** Yes (JWT)

**Request:**
```json
{
  "url": "https://example.com/webhook",
  "secret": "webhook-secret",
  "description": "Production webhook",
  "event_types": ["message_sent", "message_received"],
  "is_active": true
}
```

#### GET /webhooks/:id
Get webhook details.

**Auth Required:** Yes (JWT)

#### PUT /webhooks/:id
Update a webhook.

**Auth Required:** Yes (JWT)

#### DELETE /webhooks/:id
Delete a webhook.

**Auth Required:** Yes (JWT)

#### GET /webhooks/events
List available webhook event types.

**Auth Required:** Yes (JWT)

#### GET /webhooks/:id/deliveries
Get webhook delivery history.

**Auth Required:** Yes (JWT)

#### GET /webhooks/:id/stats
Get webhook statistics.

**Auth Required:** Yes (JWT)

#### POST /webhooks/:id/test
Test a webhook.

**Auth Required:** Yes (JWT)

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

**Common HTTP Status Codes:**

| Status | Description |
|--------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Examples

### Example 1: Send Message with API Token

```bash
# Create token first via web UI, then use it:
curl -X POST http://localhost:8080/api/whatsapp/send \
  -H "Authorization: Bearer plt_live_abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+1234567890",
    "message": "Hello from API!"
  }'
```

### Example 2: Check Status with JWT

```bash
# Login first to get JWT
JWT_TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' | jq -r '.token')

# Use JWT to check status
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:8080/api/whatsapp/status
```

### Example 3: Create API Token Programmatically

```bash
JWT_TOKEN="your-jwt-token"

curl -X POST http://localhost:8080/api/auth/tokens \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Integration",
    "scopes": ["messages:send"],
    "expires_at": "2025-12-31T23:59:59Z"
  }'
```

### Example 4: Subscribe to Events (SSE)

```javascript
const eventSource = new EventSource(
  'http://localhost:8080/api/whatsapp/events?token=plt_live_abc123...'
);

eventSource.addEventListener('message_sent', (event) => {
  const data = JSON.parse(event.data);
  console.log('Message sent:', data);
});

eventSource.addEventListener('connected', (event) => {
  console.log('WhatsApp connected!');
});
```

---

## Rate Limiting

Currently, there are no rate limits implemented. However, please use the API responsibly.

---

## Security Best Practices

1. **Never share API tokens** in public repositories or client-side code
2. **Use HTTPS** in production to encrypt API communications
3. **Rotate tokens regularly** using the rotate endpoint
4. **Set expiration dates** for tokens when possible
5. **Use minimal scopes** - only grant permissions that are necessary
6. **Monitor token usage** via the last_used_at field
7. **Revoke unused tokens** promptly

---

## Support

For issues or questions, please refer to the project repository or documentation.
