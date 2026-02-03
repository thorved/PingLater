package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/user/pinglater/internal/db"
	"github.com/user/pinglater/internal/models"
)

// generateToken generates a secure random API token
// Format: plt_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
func generateToken() string {
	const prefix = "plt_live_"
	const tokenLength = 32

	// Generate 32 random bytes
	bytes := make([]byte, tokenLength)
	rand.Read(bytes)

	// Convert to hex string
	randomPart := hex.EncodeToString(bytes)

	return prefix + randomPart
}

// hashToken hashes a token using SHA-256
func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// CreateToken creates a new API token
func CreateToken(c *gin.Context) {
	var req models.CreateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Validate scopes
	availableScopes := models.AllAvailableScopes()
	scopeMap := make(map[string]bool)
	for _, s := range availableScopes {
		scopeMap[s] = true
	}

	// If 'all' scope is selected, only store 'all'
	hasAllScope := false
	for _, scope := range req.Scopes {
		if scope == models.ScopeAll {
			hasAllScope = true
			break
		}
	}

	validatedScopes := []string{}
	if hasAllScope {
		validatedScopes = []string{models.ScopeAll}
	} else {
		for _, scope := range req.Scopes {
			if scopeMap[scope] {
				validatedScopes = append(validatedScopes, scope)
			}
		}
	}

	if len(validatedScopes) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one valid scope is required"})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Generate raw token (shown only once)
	rawToken := generateToken()
	tokenHash := hashToken(rawToken)

	// Create token record
	token := models.APIToken{
		UserID:    userID.(uint),
		Name:      req.Name,
		TokenHash: tokenHash,
		IsActive:  true,
		ExpiresAt: req.ExpiresAt,
	}
	token.SetScopes(validatedScopes)

	// Save to database
	database := db.GetDB()
	if err := database.Create(&token).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}

	// Return response with raw token (shown only once!)
	c.JSON(http.StatusCreated, models.CreateTokenResponse{
		ID:        token.ID,
		Name:      token.Name,
		Token:     rawToken, // Raw token shown ONLY once
		Scopes:    token.GetScopes(),
		ExpiresAt: token.ExpiresAt,
		CreatedAt: token.CreatedAt,
	})
}

// ListTokens lists all API tokens for the current user
func ListTokens(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	database := db.GetDB()
	var tokens []models.APIToken
	if err := database.Where("user_id = ?", userID).Order("created_at DESC").Find(&tokens).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tokens"})
		return
	}

	// Convert to response format
	responses := make([]models.TokenResponse, len(tokens))
	for i, token := range tokens {
		responses[i] = token.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{"tokens": responses})
}

// GetAvailableScopes returns all available scopes
func GetAvailableScopes(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"scopes": models.AllAvailableScopes(),
	})
}

// DeleteToken revokes/deletes an API token
func DeleteToken(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	tokenID := c.Param("id")
	if tokenID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token ID is required"})
		return
	}

	database := db.GetDB()

	// Find token and ensure it belongs to current user
	var token models.APIToken
	if err := database.Where("id = ? AND user_id = ?", tokenID, userID).First(&token).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Token not found"})
		return
	}

	// Delete the token
	if err := database.Delete(&token).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Token revoked successfully"})
}

// RotateToken creates a new token and deletes the old one
func RotateToken(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	tokenID := c.Param("id")
	if tokenID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token ID is required"})
		return
	}

	database := db.GetDB()

	// Find token and ensure it belongs to current user
	var oldToken models.APIToken
	if err := database.Where("id = ? AND user_id = ?", tokenID, userID).First(&oldToken).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Token not found"})
		return
	}

	// Generate new token
	rawToken := generateToken()
	tokenHash := hashToken(rawToken)

	// Create new token with same properties
	newToken := models.APIToken{
		UserID:    userID.(uint),
		Name:      oldToken.Name,
		TokenHash: tokenHash,
		Scopes:    oldToken.Scopes,
		IsActive:  true,
		ExpiresAt: oldToken.ExpiresAt,
	}

	// Save new token
	if err := database.Create(&newToken).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create new token"})
		return
	}

	// Delete old token
	if err := database.Delete(&oldToken).Error; err != nil {
		// Continue anyway, new token is created
	}

	c.JSON(http.StatusOK, models.CreateTokenResponse{
		ID:        newToken.ID,
		Name:      newToken.Name,
		Token:     rawToken, // Raw token shown ONLY once
		Scopes:    newToken.GetScopes(),
		ExpiresAt: newToken.ExpiresAt,
		CreatedAt: newToken.CreatedAt,
	})
}

// UpdateToken updates token properties (name, scopes, active status)
type UpdateTokenRequest struct {
	Name     string `json:"name,omitempty"`
	IsActive *bool  `json:"is_active,omitempty"`
}

func UpdateToken(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	tokenID := c.Param("id")
	if tokenID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token ID is required"})
		return
	}

	var req UpdateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	database := db.GetDB()

	// Find token and ensure it belongs to current user
	var token models.APIToken
	if err := database.Where("id = ? AND user_id = ?", tokenID, userID).First(&token).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Token not found"})
		return
	}

	// Update fields
	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	if err := database.Model(&token).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update token"})
		return
	}

	// Reload token
	database.First(&token, token.ID)

	c.JSON(http.StatusOK, token.ToResponse())
}

// ValidateAndGetToken validates an API token and returns the token record
// This is used by the middleware
func ValidateAndGetToken(tokenStr string) (*models.APIToken, error) {
	if !strings.HasPrefix(tokenStr, "plt_live_") {
		return nil, nil
	}

	tokenHash := hashToken(tokenStr)

	database := db.GetDB()
	var token models.APIToken
	if err := database.Where("token_hash = ? AND is_active = ?", tokenHash, true).First(&token).Error; err != nil {
		return nil, err
	}

	// Check if expired
	if token.IsExpired() {
		return nil, nil
	}

	return &token, nil
}
