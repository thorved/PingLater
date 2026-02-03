package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/user/pinglater/internal/api/middleware"
	"github.com/user/pinglater/internal/db"
	"github.com/user/pinglater/internal/models"
	"golang.org/x/crypto/bcrypt"
)

func Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	database := db.GetDB()

	// Find user by username
	var user models.User
	result := database.Where("username = ?", req.Username).First(&user)
	if result.Error != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Check password
	err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Generate JWT token
	token, err := middleware.GenerateToken(user.ID, user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, models.LoginResponse{
		Token:    token,
		Username: user.Username,
	})
}

func Logout(c *gin.Context) {
	// Client-side token removal, but we can add server-side token blacklist later
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func GetMe(c *gin.Context) {
	userID, _ := c.Get("userID")
	username, _ := c.Get("username")

	c.JSON(http.StatusOK, gin.H{
		"user_id":  userID,
		"username": username,
	})
}
