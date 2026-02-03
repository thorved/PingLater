# PingLater Documentation

Welcome to the PingLater documentation. This directory contains comprehensive guides for using the PingLater API and platform.

## Available Documentation

### [API Documentation](./API.md)
Complete reference for the PingLater REST API including:
- Authentication methods (JWT and API tokens)
- All available endpoints
- Request/response formats
- Error handling
- Code examples

### [Quick Start Guide](./QUICKSTART.md)
Get up and running quickly with:
- Step-by-step setup instructions
- Common use cases and examples
- Sample code in Bash, Node.js, and Python
- Troubleshooting tips

## Authentication Methods

PingLater supports two authentication methods:

1. **JWT Session Authentication** - For web UI interactions
2. **API Token Authentication** - For external integrations and automation

See [API Documentation](./API.md#authentication) for details.

## API Token Scopes

API tokens support the following scopes:

| Scope | Description |
|-------|-------------|
| `all` | Full access |
| `messages:send` | Send WhatsApp messages |
| `messages:read` | Read message history |
| `metrics:read` | Access dashboard metrics |
| `status:read` | Check connection status |

## Support

For additional help:
- Check the [API Documentation](./API.md) for detailed reference
- Follow the [Quick Start Guide](./QUICKSTART.md) for common scenarios
- Review error messages in API responses
- Check server logs for backend issues
