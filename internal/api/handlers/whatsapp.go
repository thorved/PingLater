package handlers

import (
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/user/pinglater/internal/whatsapp"
)

func GetWhatsAppStatus(c *gin.Context) {
	client := whatsapp.GetClient()
	status := client.GetStatus()

	c.JSON(http.StatusOK, status)
}

func ConnectWhatsApp(c *gin.Context) {
	client := whatsapp.GetClient()

	if err := client.Connect(); err != nil {
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
		case <-time.After(60 * time.Second):
			c.SSEvent("timeout", "QR code expired")
			return false
		case <-c.Request.Context().Done():
			return false
		}
	})
}
