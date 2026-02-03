package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/user/pinglater/internal/db"
	"github.com/user/pinglater/internal/models"
)

// hashToken hashes a token using SHA-256
func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// validateAndGetToken validates an API token and returns the token record
func validateAndGetToken(tokenStr string) (*models.APIToken, error) {
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

// APITokenMiddleware authenticates requests using API tokens
// It can be used alongside JWT authentication
func APITokenMiddleware(requiredScopes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip if already authenticated via JWT
		if _, exists := c.Get("userID"); exists {
			c.Next()
			return
		}

		var tokenStr string

		// Try to get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			bearerToken := strings.Split(authHeader, " ")
			if len(bearerToken) == 2 && bearerToken[0] == "Bearer" {
				tokenStr = bearerToken[1]
			}
		}

		if tokenStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization required"})
			c.Abort()
			return
		}

		// Check if it's an API token (starts with plt_live_)
		if !strings.HasPrefix(tokenStr, "plt_live_") {
			// Not an API token, let JWT middleware handle it
			c.Next()
			return
		}

		// Validate API token
		token, err := validateAndGetToken(tokenStr)
		if err != nil || token == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired API token"})
			c.Abort()
			return
		}

		// Check if token is expired
		if token.IsExpired() {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "API token has expired"})
			c.Abort()
			return
		}

		// Check required scopes
		if len(requiredScopes) > 0 {
			hasRequiredScope := false
			for _, scope := range requiredScopes {
				if token.HasScope(scope) {
					hasRequiredScope = true
					break
				}
			}
			if !hasRequiredScope {
				c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
				c.Abort()
				return
			}
		}

		// Update last used timestamp
		now := time.Now()
		token.LastUsedAt = &now
		db.GetDB().Model(token).Update("last_used_at", now)

		// Set user info in context
		c.Set("userID", token.UserID)
		c.Set("apiToken", token)

		c.Next()
	}
}

// AuthMiddlewareWithFallback tries JWT first, then API token
func AuthMiddlewareWithFallback(requiredScopes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenStr string

		// Try to get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			bearerToken := strings.Split(authHeader, " ")
			if len(bearerToken) == 2 && bearerToken[0] == "Bearer" {
				tokenStr = bearerToken[1]
			}
		}

		// If no token in header, try query parameter (for SSE)
		if tokenStr == "" {
			tokenStr = c.Query("token")
		}

		if tokenStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization required"})
			c.Abort()
			return
		}

		// Check if it's an API token
		if strings.HasPrefix(tokenStr, "plt_live_") {
			// Try API token authentication
			token, err := validateAndGetToken(tokenStr)
			if err != nil || token == nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired API token"})
				c.Abort()
				return
			}

			// Check if token is expired
			if token.IsExpired() {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "API token has expired"})
				c.Abort()
				return
			}

			// Check required scopes
			if len(requiredScopes) > 0 {
				hasRequiredScope := false
				for _, scope := range requiredScopes {
					if token.HasScope(scope) {
						hasRequiredScope = true
						break
					}
				}
				if !hasRequiredScope {
					c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
					c.Abort()
					return
				}
			}

			// Update last used timestamp
			now := time.Now()
			token.LastUsedAt = &now
			db.GetDB().Model(token).Update("last_used_at", now)

			// Set user info in context
			c.Set("userID", token.UserID)
			c.Set("apiToken", token)

			c.Next()
			return
		}

		// Try JWT authentication
		token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(*Claims); ok && token.Valid {
			c.Set("userID", claims.UserID)
			c.Set("username", claims.Username)
			c.Next()
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
		}
	}
}

// RequireScope middleware checks if the authenticated token has the required scope
func RequireScope(scope string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if authenticated via API token
		if token, exists := c.Get("apiToken"); exists {
			apiToken := token.(*models.APIToken)
			if !apiToken.HasScope(scope) && !apiToken.HasScope(models.ScopeAll) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions. Required scope: " + scope})
				c.Abort()
				return
			}
		}
		// If JWT authenticated, they have full access
		c.Next()
	}
}
