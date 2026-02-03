# Quick Start Guide

## Getting Started with PingLater API

### Prerequisites

- PingLater server running
- Valid user account (created during setup)
- curl or any HTTP client

### Step 1: Obtain JWT Token (Web UI Access)

Login to get a session token:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

Save the token from the response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "username": "admin"
}
```

### Step 2: Create an API Token

Use the JWT token to create a long-lived API token:

```bash
curl -X POST http://localhost:8080/api/auth/tokens \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Integration",
    "scopes": ["messages:send", "status:read"]
  }'
```

**Important:** Save the returned token immediately - it's shown only once!

### Step 3: Use API Token

Now you can use the API token for all subsequent requests:

```bash
# Check WhatsApp status
curl -H "Authorization: Bearer plt_live_abc123..." \
  http://localhost:8080/api/whatsapp/status

# Send a message
curl -X POST http://localhost:8080/api/whatsapp/send \
  -H "Authorization: Bearer plt_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+1234567890",
    "message": "Hello from API!"
  }'
```

### Common Use Cases

#### 1. Automated Messaging

```bash
#!/bin/bash
API_TOKEN="plt_live_your_token_here"
PHONE="+1234567890"
MESSAGE="Automated message at $(date)"

curl -X POST http://localhost:8080/api/whatsapp/send \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"phone_number\":\"$PHONE\",\"message\":\"$MESSAGE\"}"
```

#### 2. Health Check Script

```bash
#!/bin/bash
API_TOKEN="plt_live_your_token_here"

response=$(curl -s -H "Authorization: Bearer $API_TOKEN" \
  http://localhost:8080/api/whatsapp/status)

if echo "$response" | grep -q '"connected":true'; then
  echo "WhatsApp is connected"
  exit 0
else
  echo "WhatsApp is disconnected"
  exit 1
fi
```

#### 3. Integration with Node.js

```javascript
const axios = require('axios');

const API_TOKEN = 'plt_live_your_token_here';
const API_URL = 'http://localhost:8080/api';

async function sendMessage(phoneNumber, message) {
  try {
    const response = await axios.post(
      `${API_URL}/whatsapp/send`,
      {
        phone_number: phoneNumber,
        message: message
      },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
sendMessage('+1234567890', 'Hello from Node.js!')
  .then(result => console.log('Message sent:', result))
  .catch(err => console.error('Failed:', err));
```

#### 4. Integration with Python

```python
import requests

API_TOKEN = 'plt_live_your_token_here'
API_URL = 'http://localhost:8080/api'

def send_message(phone_number, message):
    headers = {
        'Authorization': f'Bearer {API_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'phone_number': phone_number,
        'message': message
    }
    
    response = requests.post(
        f'{API_URL}/whatsapp/send',
        headers=headers,
        json=data
    )
    
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Error: {response.status_code} - {response.text}")

# Usage
try:
    result = send_message('+1234567890', 'Hello from Python!')
    print(f"Message sent: {result}")
except Exception as e:
    print(f"Failed: {e}")
```

### Managing API Tokens

#### List All Tokens
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8080/api/auth/tokens
```

#### Revoke a Token
```bash
curl -X DELETE -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8080/api/auth/tokens/1
```

#### Rotate a Token
```bash
curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8080/api/auth/tokens/1/rotate
```

### Troubleshooting

**Error: "Authorization required"**
- Check that you're including the Authorization header
- Verify the token format: `Bearer plt_live_...`

**Error: "Invalid or expired API token"**
- Token may have been revoked
- Token may have expired (check expires_at)
- Token format is incorrect

**Error: "Insufficient permissions"**
- Your token doesn't have the required scope
- Create a new token with the appropriate scope

**Error: "WhatsApp not connected"**
- Connect WhatsApp via the web UI first
- Check WhatsApp status: `GET /api/whatsapp/status`

### Next Steps

- Read the full [API Documentation](./API.md)
- Set up webhook notifications for real-time events
- Review [Security Best Practices](./API.md#security-best-practices)
