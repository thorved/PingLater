package models

import (
	"time"
)

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"unique;not null" json:"username"`
	PasswordHash string    `gorm:"not null" json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type WhatsAppSession struct {
	ID              uint       `gorm:"primaryKey" json:"id"`
	UserID          uint       `gorm:"not null" json:"user_id"`
	SessionData     []byte     `gorm:"type:blob" json:"-"`
	Connected       bool       `json:"connected"`
	LastConnectedAt *time.Time `json:"last_connected_at"`
	PhoneNumber     string     `json:"phone_number"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token    string `json:"token"`
	Username string `json:"username"`
}

type WhatsAppStatus struct {
	Connected       bool   `json:"connected"`
	PhoneNumber     string `json:"phone_number"`
	QRCodeAvailable bool   `json:"qr_code_available"`
}
