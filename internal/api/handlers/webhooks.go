package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/user/pinglater/internal/db"
	"github.com/user/pinglater/internal/models"
	"github.com/user/pinglater/internal/services"
)

// ListWebhooks returns all webhooks for the authenticated user
func ListWebhooks(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	database := db.GetDB()
	var webhooks []models.Webhook

	result := database.Where("user_id = ?", userID).Find(&webhooks)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch webhooks"})
		return
	}

	// Convert to response format (hide secret)
	responses := make([]models.WebhookResponse, len(webhooks))
	for i, webhook := range webhooks {
		responses[i] = webhook.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{"webhooks": responses})
}

// CreateWebhook creates a new webhook for the authenticated user
func CreateWebhook(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.WebhookCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// Validate event types
	if len(req.EventTypes) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one event type is required"})
		return
	}

	// Create webhook
	webhook := models.Webhook{
		UserID:      userID.(uint),
		URL:         req.URL,
		Secret:      req.Secret,
		Description: req.Description,
		EventTypes:  models.JoinEventTypes(req.EventTypes),
		IsActive:    req.IsActive,
	}

	database := db.GetDB()
	if result := database.Create(&webhook); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create webhook"})
		return
	}

	c.JSON(http.StatusCreated, webhook.ToResponse())
}

// GetWebhook returns a single webhook by ID
func GetWebhook(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	webhookID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID"})
		return
	}

	database := db.GetDB()
	var webhook models.Webhook

	result := database.Where("id = ? AND user_id = ?", webhookID, userID).First(&webhook)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Webhook not found"})
		return
	}

	c.JSON(http.StatusOK, webhook.ToResponse())
}

// UpdateWebhook updates an existing webhook
func UpdateWebhook(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	webhookID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID"})
		return
	}

	var req models.WebhookUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	database := db.GetDB()
	var webhook models.Webhook

	result := database.Where("id = ? AND user_id = ?", webhookID, userID).First(&webhook)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Webhook not found"})
		return
	}

	// Update fields
	updates := make(map[string]interface{})

	if req.URL != "" {
		updates["url"] = req.URL
	}
	if req.Secret != "" {
		updates["secret"] = req.Secret
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.EventTypes != nil {
		updates["event_types"] = models.JoinEventTypes(req.EventTypes)
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	if result := database.Model(&webhook).Updates(updates); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update webhook"})
		return
	}

	// Fetch updated webhook
	database.First(&webhook, webhook.ID)
	c.JSON(http.StatusOK, webhook.ToResponse())
}

// DeleteWebhook deletes a webhook
func DeleteWebhook(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	webhookID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID"})
		return
	}

	database := db.GetDB()
	var webhook models.Webhook

	result := database.Where("id = ? AND user_id = ?", webhookID, userID).First(&webhook)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Webhook not found"})
		return
	}

	// Delete associated deliveries first
	database.Where("webhook_id = ?", webhookID).Delete(&models.WebhookDelivery{})

	// Delete webhook
	if result := database.Delete(&webhook); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete webhook"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Webhook deleted successfully"})
}

// ListWebhookEvents returns available webhook event types
func ListWebhookEvents(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"events": models.AvailableWebhookEvents})
}

// ListWebhookDeliveries returns delivery history for a webhook
func ListWebhookDeliveries(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	webhookID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID"})
		return
	}

	database := db.GetDB()
	var webhook models.Webhook

	// Verify webhook belongs to user
	result := database.Where("id = ? AND user_id = ?", webhookID, userID).First(&webhook)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Webhook not found"})
		return
	}

	// Pagination
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	offset := 0
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	var deliveries []models.WebhookDelivery
	var total int64

	database.Model(&models.WebhookDelivery{}).Where("webhook_id = ?", webhookID).Count(&total)
	database.Where("webhook_id = ?", webhookID).
		Order("created_at desc").
		Limit(limit).
		Offset(offset).
		Find(&deliveries)

	// Convert to response format
	responses := make([]models.WebhookDeliveryResponse, len(deliveries))
	for i, d := range deliveries {
		responses[i] = models.WebhookDeliveryResponse{
			ID:             d.ID,
			EventType:      d.EventType,
			Success:        d.Success,
			ResponseStatus: d.ResponseStatus,
			ErrorMessage:   d.ErrorMessage,
			RetryCount:     d.RetryCount,
			NextRetryAt:    d.NextRetryAt,
			CreatedAt:      d.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"deliveries": responses,
		"total":      total,
		"limit":      limit,
		"offset":     offset,
	})
}

// TestWebhook sends a test payload to a webhook
func TestWebhook(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	webhookID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID"})
		return
	}

	database := db.GetDB()
	var webhook models.Webhook

	// Verify webhook belongs to user
	result := database.Where("id = ? AND user_id = ?", webhookID, userID).First(&webhook)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Webhook not found"})
		return
	}

	// Send test webhook
	webhookService := services.GetWebhookService()
	delivery, err := webhookService.TestWebhook(&webhook)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send test webhook: " + err.Error()})
		return
	}

	// Save the test delivery
	if err := database.Create(delivery).Error; err != nil {
		// Non-critical error, just log it
		// Don't fail the request because of this
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Test webhook sent",
		"delivery": models.WebhookDeliveryResponse{
			ID:             delivery.ID,
			EventType:      delivery.EventType,
			Success:        delivery.Success,
			ResponseStatus: delivery.ResponseStatus,
			ErrorMessage:   delivery.ErrorMessage,
			RetryCount:     delivery.RetryCount,
			CreatedAt:      delivery.CreatedAt,
		},
	})
}

// GetWebhookStats returns statistics for a webhook
func GetWebhookStats(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	webhookID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID"})
		return
	}

	database := db.GetDB()
	var webhook models.Webhook

	// Verify webhook belongs to user
	result := database.Where("id = ? AND user_id = ?", webhookID, userID).First(&webhook)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Webhook not found"})
		return
	}

	webhookService := services.GetWebhookService()
	stats, err := webhookService.GetWebhookStats(uint(webhookID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get stats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"webhook_id": webhookID,
		"stats":      stats,
	})
}
