package services

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/user/pinglater/internal/db"
	"github.com/user/pinglater/internal/models"
	"gorm.io/gorm"
)

// WebhookService handles webhook delivery with retry logic
type WebhookService struct {
	db         *gorm.DB
	httpClient *http.Client
	mu         sync.RWMutex
	stopChan   chan struct{}
	wg         sync.WaitGroup
}

var (
	webhookService *WebhookService
	once           sync.Once
)

// GetWebhookService returns the singleton webhook service instance
func GetWebhookService() *WebhookService {
	once.Do(func() {
		webhookService = &WebhookService{
			db: db.GetDB(),
			httpClient: &http.Client{
				Timeout: 30 * time.Second,
			},
			stopChan: make(chan struct{}),
		}
		// Start the retry processor
		go webhookService.processRetries()
	})
	return webhookService
}

// Stop gracefully shuts down the webhook service
func (s *WebhookService) Stop() {
	close(s.stopChan)
	s.wg.Wait()
}

// TriggerWebhooks triggers all active webhooks for a user and event type
func (s *WebhookService) TriggerWebhooks(userID uint, eventType string, data interface{}) {
	if s.db == nil {
		fmt.Println("[Webhook] Database is nil, cannot trigger webhooks")
		return
	}

	fmt.Printf("[Webhook] Triggering webhooks for user %d, event: %s\n", userID, eventType)

	// Get all active webhooks for this user that are subscribed to this event type
	var webhooks []models.Webhook
	result := s.db.Where("user_id = ? AND is_active = ?", userID, true).Find(&webhooks)
	if result.Error != nil {
		fmt.Printf("[Webhook] Failed to fetch webhooks for user %d: %v\n", userID, result.Error)
		return
	}

	fmt.Printf("[Webhook] Found %d active webhooks for user %d\n", len(webhooks), userID)

	// Filter webhooks by event type and filters
	triggeredCount := 0
	for _, webhook := range webhooks {
		eventTypes := models.ParseEventTypes(webhook.EventTypes)
		fmt.Printf("[Webhook] Webhook %d event types: %v, checking for: %s\n", webhook.ID, eventTypes, eventType)
		if contains(eventTypes, eventType) {
			// Check if message data matches webhook filters
			if msgData, ok := data.(models.MessageReceivedData); ok {
				if !s.matchesFilters(&webhook, msgData) {
					fmt.Printf("[Webhook] Webhook %d skipped - filters don't match\n", webhook.ID)
					continue
				}
			}
			fmt.Printf("[Webhook] Triggering webhook %d to URL: %s\n", webhook.ID, webhook.URL)
			// Deliver webhook asynchronously
			go s.deliverWebhook(&webhook, eventType, data)
			triggeredCount++
		}
	}

	fmt.Printf("[Webhook] Triggered %d webhooks\n", triggeredCount)
}

// matchesFilters checks if message data matches webhook filter criteria
func (s *WebhookService) matchesFilters(webhook *models.Webhook, data models.MessageReceivedData) bool {
	// Check chat type filter
	if webhook.FilterChatType != "" && webhook.FilterChatType != "all" {
		isGroup := data.IsGroup
		if webhook.FilterChatType == "individual" && isGroup {
			return false
		}
		if webhook.FilterChatType == "group" && !isGroup {
			return false
		}
	}

	// Check phone number filter (only for individual chats or if explicitly set)
	phoneNumbers := models.ParseEventTypes(webhook.FilterPhoneNumbers)
	if len(phoneNumbers) > 0 {
		matches := models.PhoneNumberMatches(data.FromPhone, phoneNumbers)
		matchType := webhook.FilterPhoneMatchType
		if matchType == "" {
			matchType = "whitelist"
		}

		if matchType == "whitelist" && !matches {
			return false
		}
		if matchType == "blacklist" && matches {
			return false
		}
	}

	// Check group filters (only relevant for group messages)
	if data.IsGroup {
		// Check group JID filter
		groupJIDs := models.ParseEventTypes(webhook.FilterGroupJIDs)
		if len(groupJIDs) > 0 {
			matches := false
			for _, jid := range groupJIDs {
				if strings.EqualFold(jid, data.From) {
					matches = true
					break
				}
			}
			if !matches {
				return false
			}
		}

		// Check group name filter
		groupNames := models.ParseEventTypes(webhook.FilterGroupNames)
		if len(groupNames) > 0 {
			matches := false
			for _, name := range groupNames {
				if strings.EqualFold(name, data.GroupName) {
					matches = true
					break
				}
			}
			if !matches {
				return false
			}
		}
	}

	return true
}

// deliverWebhook sends a webhook notification and logs the delivery
func (s *WebhookService) deliverWebhook(webhook *models.Webhook, eventType string, data interface{}) {
	fmt.Printf("[Webhook] Delivering to webhook %d: %s\n", webhook.ID, webhook.URL)

	payload := models.WebhookPayload{
		WebhookID: fmt.Sprintf("%d", webhook.ID),
		Event:     eventType,
		Timestamp: time.Now(),
		Data:      data,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		fmt.Printf("[Webhook] Failed to marshal webhook payload: %v\n", err)
		return
	}

	fmt.Printf("[Webhook] Payload: %s\n", string(payloadBytes))

	// Calculate HMAC signature if secret is configured
	var signature string
	if webhook.Secret != "" {
		signature = s.calculateSignature(payloadBytes, webhook.Secret)
	}

	// Create delivery record
	delivery := models.WebhookDelivery{
		WebhookID: webhook.ID,
		EventType: eventType,
		Payload:   string(payloadBytes),
	}

	// Deliver the webhook
	success, responseStatus, responseBody, err := s.sendWebhook(webhook.URL, payloadBytes, signature)

	delivery.Success = success
	delivery.ResponseStatus = responseStatus
	delivery.ResponseBody = responseBody
	if err != nil {
		delivery.ErrorMessage = err.Error()
	}

	// If failed and retry count is less than max, schedule retry
	if !success && delivery.RetryCount < 5 {
		nextRetry := s.calculateNextRetry(delivery.RetryCount)
		delivery.NextRetryAt = &nextRetry
	}

	// Save delivery record
	if err := s.db.Create(&delivery).Error; err != nil {
		fmt.Printf("[Webhook] Failed to save webhook delivery: %v\n", err)
	} else {
		fmt.Printf("[Webhook] Delivery record saved for webhook %d, success: %v\n", webhook.ID, success)
	}
}

// sendWebhook performs the actual HTTP POST to the webhook URL
func (s *WebhookService) sendWebhook(url string, payload []byte, signature string) (bool, int, string, error) {
	fmt.Printf("[Webhook] Sending POST request to: %s\n", url)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	if err != nil {
		fmt.Printf("[Webhook] Failed to create request: %v\n", err)
		return false, 0, "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "PingLater-Webhook/1.0")

	if signature != "" {
		req.Header.Set("X-Webhook-Signature", "sha256="+signature)
		fmt.Printf("[Webhook] Added signature header\n")
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		fmt.Printf("[Webhook] Failed to send request: %v\n", err)
		return false, 0, "", fmt.Errorf("failed to send webhook: %w", err)
	}
	defer resp.Body.Close()

	responseBody, _ := io.ReadAll(resp.Body)
	responseBodyStr := string(responseBody)

	// Consider 2xx status codes as success
	success := resp.StatusCode >= 200 && resp.StatusCode < 300
	fmt.Printf("[Webhook] Response status: %d, success: %v\n", resp.StatusCode, success)

	return success, resp.StatusCode, responseBodyStr, nil
}

// calculateSignature calculates HMAC-SHA256 signature for webhook payload
func (s *WebhookService) calculateSignature(payload []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	return hex.EncodeToString(h.Sum(nil))
}

// calculateNextRetry calculates the next retry time using exponential backoff
// Retry intervals: 1min, 5min, 15min, 30min, 60min
func (s *WebhookService) calculateNextRetry(retryCount int) time.Time {
	intervals := []time.Duration{
		1 * time.Minute,
		5 * time.Minute,
		15 * time.Minute,
		30 * time.Minute,
		60 * time.Minute,
	}

	if retryCount >= len(intervals) {
		retryCount = len(intervals) - 1
	}

	return time.Now().Add(intervals[retryCount])
}

// processRetries runs in a background goroutine and processes failed webhook deliveries
func (s *WebhookService) processRetries() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			s.retryFailedDeliveries()
		}
	}
}

// retryFailedDeliveries finds and retries failed webhook deliveries
func (s *WebhookService) retryFailedDeliveries() {
	if s.db == nil {
		return
	}

	now := time.Now()
	var deliveries []models.WebhookDelivery

	// Find failed deliveries that are due for retry
	result := s.db.Where(
		"success = ? AND retry_count < ? AND (next_retry_at IS NULL OR next_retry_at <= ?)",
		false, 5, now,
	).Find(&deliveries)

	if result.Error != nil {
		fmt.Printf("Failed to fetch failed deliveries: %v\n", result.Error)
		return
	}

	for _, delivery := range deliveries {
		s.wg.Add(1)
		go func(d models.WebhookDelivery) {
			defer s.wg.Done()
			s.retryDelivery(&d)
		}(delivery)
	}
}

// retryDelivery attempts to redeliver a failed webhook
func (s *WebhookService) retryDelivery(delivery *models.WebhookDelivery) {
	// Get the webhook
	var webhook models.Webhook
	if err := s.db.First(&webhook, delivery.WebhookID).Error; err != nil {
		fmt.Printf("Failed to fetch webhook %d for retry: %v\n", delivery.WebhookID, err)
		return
	}

	// Don't retry if webhook is inactive
	if !webhook.IsActive {
		return
	}

	// Calculate signature
	var signature string
	if webhook.Secret != "" {
		signature = s.calculateSignature([]byte(delivery.Payload), webhook.Secret)
	}

	// Attempt delivery
	success, responseStatus, responseBody, err := s.sendWebhook(webhook.URL, []byte(delivery.Payload), signature)

	// Update delivery record
	updates := map[string]interface{}{
		"success":         success,
		"response_status": responseStatus,
		"response_body":   responseBody,
		"retry_count":     delivery.RetryCount + 1,
	}

	if err != nil {
		updates["error_message"] = err.Error()
	}

	// Schedule next retry if still failed
	if !success && delivery.RetryCount+1 < 5 {
		nextRetry := s.calculateNextRetry(delivery.RetryCount + 1)
		updates["next_retry_at"] = &nextRetry
	} else {
		updates["next_retry_at"] = nil
	}

	if err := s.db.Model(delivery).Updates(updates).Error; err != nil {
		fmt.Printf("Failed to update delivery record: %v\n", err)
	}
}

// TestWebhook tests a webhook by sending a test payload
func (s *WebhookService) TestWebhook(webhook *models.Webhook) (*models.WebhookDelivery, error) {
	testData := map[string]interface{}{
		"test":    true,
		"message": "This is a test webhook from PingLater",
	}

	payload := models.WebhookPayload{
		WebhookID: fmt.Sprintf("%d", webhook.ID),
		Event:     "test",
		Timestamp: time.Now(),
		Data:      testData,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	var signature string
	if webhook.Secret != "" {
		signature = s.calculateSignature(payloadBytes, webhook.Secret)
	}

	delivery := &models.WebhookDelivery{
		WebhookID: webhook.ID,
		EventType: "test",
		Payload:   string(payloadBytes),
	}

	success, responseStatus, responseBody, err := s.sendWebhook(webhook.URL, payloadBytes, signature)

	delivery.Success = success
	delivery.ResponseStatus = responseStatus
	delivery.ResponseBody = responseBody
	if err != nil {
		delivery.ErrorMessage = err.Error()
	}

	return delivery, nil
}

// contains checks if a string slice contains a specific string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if strings.EqualFold(s, item) {
			return true
		}
	}
	return false
}

// ValidateSignature validates a webhook signature
func ValidateSignature(payload []byte, secret, signature string) bool {
	if secret == "" || signature == "" {
		return false
	}

	// Remove "sha256=" prefix if present
	sig := signature
	if strings.HasPrefix(sig, "sha256=") {
		sig = strings.TrimPrefix(sig, "sha256=")
	}

	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	expectedSig := hex.EncodeToString(h.Sum(nil))

	return hmac.Equal([]byte(sig), []byte(expectedSig))
}

// ParseEventTypesFromString parses a comma-separated string into a slice
func ParseEventTypesFromString(eventTypes string) []string {
	if eventTypes == "" {
		return []string{}
	}

	var result []string
	parts := strings.Split(eventTypes, ",")
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// TriggerMessageReceived is a convenience method for triggering message_received events
func (s *WebhookService) TriggerMessageReceived(userID uint, data models.MessageReceivedData) {
	s.TriggerWebhooks(userID, "message_received", data)
}

// GetWebhookStats returns statistics for a webhook
func (s *WebhookService) GetWebhookStats(webhookID uint) (map[string]interface{}, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	var totalCount, successCount, failedCount int64

	s.db.Model(&models.WebhookDelivery{}).Where("webhook_id = ?", webhookID).Count(&totalCount)
	s.db.Model(&models.WebhookDelivery{}).Where("webhook_id = ? AND success = ?", webhookID, true).Count(&successCount)
	s.db.Model(&models.WebhookDelivery{}).Where("webhook_id = ? AND success = ?", webhookID, false).Count(&failedCount)

	var lastDelivery models.WebhookDelivery
	s.db.Where("webhook_id = ?", webhookID).Order("created_at desc").First(&lastDelivery)

	successRate := float64(0)
	if totalCount > 0 {
		successRate = float64(successCount) / float64(totalCount) * 100
	}

	return map[string]interface{}{
		"total_deliveries":     totalCount,
		"successful":           successCount,
		"failed":               failedCount,
		"success_rate":         strconv.FormatFloat(successRate, 'f', 2, 64) + "%",
		"last_delivery_at":     lastDelivery.CreatedAt,
		"last_delivery_status": lastDelivery.Success,
	}, nil
}
