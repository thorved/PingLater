package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	_ "github.com/glebarez/go-sqlite"
	"github.com/joho/godotenv"
	"github.com/user/pinglater/internal/api/middleware"
	"github.com/user/pinglater/internal/db"
	"github.com/user/pinglater/internal/models"
	"github.com/user/pinglater/internal/routes"
	"github.com/user/pinglater/internal/whatsapp"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize database
	database, err := db.InitDatabase(os.Getenv("DB_PATH"))
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Create default user if not exists
	createDefaultUser(database)

	// Initialize WhatsApp client
	initWhatsAppClient()

	// Set JWT secret
	middleware.SetJWTSecret(os.Getenv("JWT_SECRET"))

	// Set Gin mode
	gin.SetMode(gin.ReleaseMode)

	// Setup router
	r := routes.SetupRouter()

	// Start server
	port := routes.GetPort()
	log.Printf("Server starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

func createDefaultUser(database *gorm.DB) {
	var userCount int64
	database.Model(&models.User{}).Count(&userCount)
	if userCount == 0 {
		passwordHash, _ := bcrypt.GenerateFromPassword([]byte(os.Getenv("DEFAULT_PASSWORD")), bcrypt.DefaultCost)
		database.Create(&models.User{
			Username:     os.Getenv("DEFAULT_USERNAME"),
			PasswordHash: string(passwordHash),
		})
		log.Println("Default user created")
	}
}

func initWhatsAppClient() {
	waClient := whatsapp.GetClient()
	if err := waClient.Initialize(); err != nil {
		log.Fatal("Failed to initialize WhatsApp client:", err)
	}
}
