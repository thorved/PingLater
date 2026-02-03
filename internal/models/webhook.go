package models

import (
	"time"
)

// Webhook represents a user's webhook configuration
type Webhook struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `gorm:"not null;index" json:"user_id"`
	URL         string    `gorm:"not null" json:"url"`
	Secret      string    `json:"-"` // HMAC secret for signature verification
	Description string    `json:"description"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	EventTypes  string    `gorm:"type:text" json:"event_types"` // Comma-separated event types
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// WebhookDelivery logs each webhook delivery attempt
type WebhookDelivery struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	WebhookID      uint       `gorm:"not null;index" json:"webhook_id"`
	EventType      string     `gorm:"not null" json:"event_type"`
	Payload        string     `gorm:"type:text" json:"payload"`
	ResponseStatus int        `json:"response_status"`
	ResponseBody   string     `gorm:"type:text" json:"response_body"`
	Success        bool       `json:"success"`
	ErrorMessage   string     `json:"error_message,omitempty"`
	RetryCount     int        `gorm:"default:0" json:"retry_count"`
	NextRetryAt    *time.Time `json:"next_retry_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

// Available event types for webhooks
var AvailableWebhookEvents = []WebhookEventType{
	{Type: "message_received", Description: "Triggered when a new WhatsApp message is received"},
	{Type: "message_sent", Description: "Triggered when a message is sent"},
	{Type: "connected", Description: "Triggered when WhatsApp connects"},
	{Type: "disconnected", Description: "Triggered when WhatsApp disconnects"},
}

type WebhookEventType struct {
	Type        string `json:"type"`
	Description string `json:"description"`
}

// WebhookPayload represents the structure of webhook notifications
type WebhookPayload struct {
	WebhookID string      `json:"webhook_id"`
	Event     string      `json:"event"`
	Timestamp time.Time   `json:"timestamp"`
	Data      interface{} `json:"data"`
}

// MessageReceivedData represents the data for message_received events
type MessageReceivedData struct {
	From      string `json:"from"`
	FromName  string `json:"from_name,omitempty"`
	Content   string `json:"content"`
	MessageID string `json:"message_id"`
	IsGroup   bool   `json:"is_group"`
	GroupName string `json:"group_name,omitempty"`
	Timestamp int64  `json:"timestamp"`
}

// WebhookCreateRequest represents the request body for creating a webhook
type WebhookCreateRequest struct {
	URL         string   `json:"url" binding:"required,url"`
	Secret      string   `json:"secret,omitempty"`
	Description string   `json:"description,omitempty"`
	EventTypes  []string `json:"event_types" binding:"required"`
	IsActive    bool     `json:"is_active"`
}

// WebhookUpdateRequest represents the request body for updating a webhook
type WebhookUpdateRequest struct {
	URL         string   `json:"url,omitempty" binding:"omitempty,url"`
	Secret      string   `json:"secret,omitempty"`
	Description string   `json:"description,omitempty"`
	EventTypes  []string `json:"event_types,omitempty"`
	IsActive    *bool    `json:"is_active,omitempty"`
}

// WebhookResponse represents a webhook in API responses
type WebhookResponse struct {
	ID          uint      `json:"id"`
	URL         string    `json:"url"`
	Description string    `json:"description"`
	IsActive    bool      `json:"is_active"`
	EventTypes  []string  `json:"event_types"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// WebhookDeliveryResponse represents a delivery log entry
type WebhookDeliveryResponse struct {
	ID             uint       `json:"id"`
	EventType      string     `json:"event_type"`
	Success        bool       `json:"success"`
	ResponseStatus int        `json:"response_status"`
	ErrorMessage   string     `json:"error_message,omitempty"`
	RetryCount     int        `json:"retry_count"`
	NextRetryAt    *time.Time `json:"next_retry_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

// ToResponse converts Webhook to WebhookResponse (hides sensitive fields)
func (w *Webhook) ToResponse() WebhookResponse {
	return WebhookResponse{
		ID:          w.ID,
		URL:         w.URL,
		Description: w.Description,
		IsActive:    w.IsActive,
		EventTypes:  ParseEventTypes(w.EventTypes),
		CreatedAt:   w.CreatedAt,
		UpdatedAt:   w.UpdatedAt,
	}
}

// ParseEventTypes converts comma-separated string to slice
func ParseEventTypes(eventTypes string) []string {
	if eventTypes == "" {
		return []string{}
	}
	var result []string
	for _, et := range splitAndTrim(eventTypes) {
		if et != "" {
			result = append(result, et)
		}
	}
	return result
}

// JoinEventTypes converts slice to comma-separated string
func JoinEventTypes(eventTypes []string) string {
	if len(eventTypes) == 0 {
		return ""
	}
	result := ""
	for i, et := range eventTypes {
		if i > 0 {
			result += ","
		}
		result += et
	}
	return result
}

// splitAndTrim splits a string by comma and trims whitespace
func splitAndTrim(s string) []string {
	var result []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			part := s[start:i]
			result = append(result, trimSpace(part))
			start = i + 1
		}
	}
	if start <= len(s) {
		result = append(result, trimSpace(s[start:]))
	}
	return result
}

// trimSpace removes leading and trailing whitespace
func trimSpace(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}
