package models

import (
	"time"
)

// Available scopes for API tokens
const (
	ScopeAll          = "all"
	ScopeMessagesSend = "messages:send"
	ScopeMessagesRead = "messages:read"
	ScopeMetricsRead  = "metrics:read"
	ScopeStatusRead   = "status:read"
)

// AllAvailableScopes returns all available scopes
func AllAvailableScopes() []string {
	return []string{
		ScopeAll,
		ScopeMessagesSend,
		ScopeMessagesRead,
		ScopeMetricsRead,
		ScopeStatusRead,
	}
}

// APIToken represents an API token for external access
type APIToken struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	UserID     uint       `gorm:"not null;index" json:"user_id"`
	Name       string     `gorm:"not null" json:"name"`
	TokenHash  string     `gorm:"unique;not null" json:"-"` // Store hash only, never the raw token
	Scopes     string     `gorm:"type:text" json:"scopes"`  // Comma-separated list
	IsActive   bool       `gorm:"default:true" json:"is_active"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// HasScope checks if the token has a specific scope (or 'all')
func (t *APIToken) HasScope(scope string) bool {
	scopes := t.GetScopes()
	for _, s := range scopes {
		if s == ScopeAll || s == scope {
			return true
		}
	}
	return false
}

// GetScopes returns the scopes as a slice
func (t *APIToken) GetScopes() []string {
	if t.Scopes == "" {
		return []string{}
	}
	scopes := []string{}
	for _, s := range splitScopes(t.Scopes) {
		if s != "" {
			scopes = append(scopes, s)
		}
	}
	return scopes
}

// SetScopes sets the scopes from a slice
func (t *APIToken) SetScopes(scopes []string) {
	t.Scopes = joinScopes(scopes)
}

// IsExpired checks if the token has expired
func (t *APIToken) IsExpired() bool {
	if t.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*t.ExpiresAt)
}

// Helper functions
func splitScopes(scopes string) []string {
	result := []string{}
	current := ""
	for _, char := range scopes {
		if char == ',' {
			if current != "" {
				result = append(result, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

func joinScopes(scopes []string) string {
	if len(scopes) == 0 {
		return ""
	}
	result := scopes[0]
	for i := 1; i < len(scopes); i++ {
		result += "," + scopes[i]
	}
	return result
}

// CreateTokenRequest represents a request to create a new API token
type CreateTokenRequest struct {
	Name      string     `json:"name" binding:"required"`
	Scopes    []string   `json:"scopes" binding:"required"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// CreateTokenResponse represents the response after creating a token
type CreateTokenResponse struct {
	ID        uint       `json:"id"`
	Name      string     `json:"name"`
	Token     string     `json:"token"` // Raw token shown only once
	Scopes    []string   `json:"scopes"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

// TokenResponse represents a token in list responses (without the raw token)
type TokenResponse struct {
	ID         uint       `json:"id"`
	Name       string     `json:"name"`
	Scopes     []string   `json:"scopes"`
	IsActive   bool       `json:"is_active"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// ToResponse converts APIToken to TokenResponse
func (t *APIToken) ToResponse() TokenResponse {
	return TokenResponse{
		ID:         t.ID,
		Name:       t.Name,
		Scopes:     t.GetScopes(),
		IsActive:   t.IsActive,
		ExpiresAt:  t.ExpiresAt,
		LastUsedAt: t.LastUsedAt,
		CreatedAt:  t.CreatedAt,
	}
}
