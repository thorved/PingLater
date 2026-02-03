package handlers

import (
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/user/pinglater/internal/db"
	"github.com/user/pinglater/internal/models"
	"github.com/user/pinglater/internal/whatsapp"
)

// Global event stream for broadcasting events
var (
	eventStream     *models.EventStream
	eventStreamOnce sync.Once
	metrics         *models.DashboardMetrics
	metricsOnce     sync.Once
	metricsMutex    sync.RWMutex
)

func GetEventStream() *models.EventStream {
	eventStreamOnce.Do(func() {
		eventStream = models.NewEventStream()
	})
	return eventStream
}

func GetDashboardMetrics() *models.DashboardMetrics {
	metricsOnce.Do(func() {
		metrics = &models.DashboardMetrics{}
	})
	return metrics
}

func BroadcastEvent(eventType models.EventType, message string, details string) {
	event := models.Event{
		Type:      eventType,
		Message:   message,
		Details:   details,
		Timestamp: time.Now(),
	}
	GetEventStream().Broadcast(event)
}

func GetWhatsAppStatus(c *gin.Context) {
	client := whatsapp.GetClient()
	status := client.GetStatus()

	c.JSON(http.StatusOK, status)
}

func ConnectWhatsApp(c *gin.Context) {
	client := whatsapp.GetClient()

	if err := client.Connect(); err != nil {
		// If already connected, return success instead of error
		if err.Error() == "already connected" {
			c.JSON(http.StatusOK, gin.H{"message": "WhatsApp already connected"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "WhatsApp connection initiated"})
}

func DisconnectWhatsApp(c *gin.Context) {
	client := whatsapp.GetClient()

	if err := client.Disconnect(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "WhatsApp disconnected"})
}

func GetWhatsAppQR(c *gin.Context) {
	client := whatsapp.GetClient()

	// Set headers for SSE
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")

	// Flush headers immediately
	c.Writer.Flush()

	qrChan := client.GetQRCode()
	connectedChan := client.GetConnectedChan()

	c.Stream(func(w io.Writer) bool {
		select {
		case qrCode, ok := <-qrChan:
			if !ok {
				c.SSEvent("error", "QR channel closed")
				return false
			}
			c.SSEvent("qr", qrCode)
			// Keep stream alive to receive more QR codes as they refresh
			return true
		case <-connectedChan:
			c.SSEvent("connected", "WhatsApp connected successfully")
			return false
		case <-time.After(60 * time.Second):
			c.SSEvent("timeout", "QR code expired")
			return false
		case <-c.Request.Context().Done():
			return false
		}
	})
}

// SendMessageRequest represents the request body for sending a message
type SendMessageRequest struct {
	PhoneNumber string `json:"phone_number" binding:"required"`
	Message     string `json:"message" binding:"required"`
}

// SendMessage sends a WhatsApp message to a phone number
func SendMessage(c *gin.Context) {
	var req SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	client := whatsapp.GetClient()

	// Check if connected
	if !client.IsConnected() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "WhatsApp not connected"})
		return
	}

	// Format phone number to JID (WhatsApp ID format: number@s.whatsapp.net)
	jid := req.PhoneNumber + "@s.whatsapp.net"

	// Send the message
	if err := client.SendMessage(jid, req.Message); err != nil {
		BroadcastEvent(models.EventTypeConnectionError, "Failed to send message", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send message: " + err.Error()})
		return
	}

	// Update metrics
	metricsMutex.Lock()
	m := GetDashboardMetrics()
	m.TotalMessagesSent++
	metricsMutex.Unlock()

	// Broadcast success event
	BroadcastEvent(models.EventTypeMessageSent, "Message sent to "+req.PhoneNumber, req.Message)

	c.JSON(http.StatusOK, gin.H{
		"message": "Message sent successfully",
		"to":      req.PhoneNumber,
	})
}

// GetEvents handles Server-Sent Events for real-time updates
func GetEvents(c *gin.Context) {
	// Set headers for SSE
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	// Flush headers immediately
	c.Writer.Flush()

	// Subscribe to event stream
	eventChan := GetEventStream().Subscribe()
	defer GetEventStream().Unsubscribe(eventChan)

	// Create a ticker for heartbeat to keep connection alive
	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()

	// Send initial ping to confirm connection
	c.SSEvent("ping", gin.H{"status": "connected", "timestamp": time.Now()})
	c.Writer.Flush()

	c.Stream(func(w io.Writer) bool {
		select {
		case event, ok := <-eventChan:
			if !ok {
				return false
			}
			c.SSEvent(string(event.Type), gin.H{
				"message":   event.Message,
				"details":   event.Details,
				"timestamp": event.Timestamp,
			})
			c.Writer.Flush()
			return true
		case <-heartbeat.C:
			// Send heartbeat to keep connection alive
			c.SSEvent("ping", gin.H{"timestamp": time.Now()})
			c.Writer.Flush()
			return true
		case <-c.Request.Context().Done():
			return false
		}
	})
}

// GetMetrics returns dashboard metrics
func GetMetrics(c *gin.Context) {
	client := whatsapp.GetClient()

	metricsMutex.RLock()
	m := GetDashboardMetrics()

	// Update connection status from client
	m.Connected = client.IsConnected()
	m.PhoneNumber = client.GetPhoneNumber()

	// Calculate uptime from client's connection time
	connectedAt := client.GetConnectedAt()
	if m.Connected && !connectedAt.IsZero() {
		m.ConnectionUptime = int64(time.Since(connectedAt).Seconds())
		m.LastConnectedAt = connectedAt
	}

	// Get session info from database if not available from client
	if m.LastConnectedAt.IsZero() {
		database := db.GetDB()
		if database != nil {
			var session models.WhatsAppSession
			if err := database.First(&session).Error; err == nil {
				if session.LastConnectedAt != nil {
					m.LastConnectedAt = *session.LastConnectedAt
				}
			}
		}
	}

	metricsMutex.RUnlock()

	c.JSON(http.StatusOK, m)
}

// IncrementMessagesReceived increments the received message counter
func IncrementMessagesReceived() {
	metricsMutex.Lock()
	m := GetDashboardMetrics()
	m.TotalMessagesReceived++
	metricsMutex.Unlock()
}
