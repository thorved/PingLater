# PingLater

A WhatsApp automation and scheduling application built with Go and Next.js.

## Features

- Single-user authentication (JWT-based)
- WhatsApp integration via whatsmeow library
- QR code-based WhatsApp login (inline in settings)
- SQLite database (pure Go, no CGO required)
- Next.js frontend with Tailwind CSS

## Project Structure

```
PingLater/
├── cmd/server/           # Go server entry point
├── internal/
│   ├── api/              # HTTP handlers and middleware
│   ├── db/               # Database connection
│   ├── models/           # Data models
│   └── whatsapp/         # WhatsApp client
├── web/                  # Next.js frontend
└── data/                 # SQLite database files
```

## Prerequisites

- Go 1.25+
- Node.js 18+

## Setup

1. **Clone the repository**

2. **Setup Backend**
   ```bash
   # Copy environment file
   cp .env.example .env
   
   # Edit .env with your settings
   # Change DEFAULT_USERNAME and DEFAULT_PASSWORD
   # Generate a secure JWT_SECRET
   
   # Download dependencies
   go mod tidy
   ```

3. **Setup Frontend**
   ```bash
   cd web
   npm install
   ```

## Running the Application

### Development Mode

1. **Start Backend**
   ```bash
   # From project root
   go run cmd/server/main.go
   ```
   Server will start on port 8080 (or PORT from .env)

2. **Start Frontend**
   ```bash
   # In another terminal, from web directory
   cd web
   npm run dev
   ```
   Frontend will start on port 3000

3. **Access Application**
   - Frontend: http://localhost:3000
   - API: http://localhost:8080

### Production Build

1. **Build Frontend**
   ```bash
   cd web
   npm run build
   ```

2. **Build Backend**
   ```bash
   # Build with CGO disabled for pure Go SQLite
   CGO_ENABLED=0 go build -o pinglater cmd/server/main.go
   ```

3. **Run**
   ```bash
   ./pinglater
   ```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user (protected)

### WhatsApp
- `GET /api/whatsapp/status` - Get connection status (protected)
- `GET /api/whatsapp/qr` - Get QR code stream (SSE) (protected)
- `POST /api/whatsapp/connect` - Connect to WhatsApp (protected)
- `POST /api/whatsapp/disconnect` - Disconnect WhatsApp (protected)

## Usage

1. Open the web interface (http://localhost:3000)
2. Login with your credentials (default: admin/admin123)
3. Go to Dashboard
4. Click "Connect" to start WhatsApp connection
5. Scan the QR code with your WhatsApp mobile app
6. Once connected, you'll see your phone number displayed

## Security Notes

- Change default credentials in production
- Use a strong JWT_SECRET (generate with `openssl rand -base64 32`)
- Store .env file securely
- The WhatsApp session is stored in ./data/whatsapp.db

## License

MIT
