package db

import (
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"github.com/user/pinglater/internal/models"
	"gorm.io/gorm"
	"log"
)

var DB *gorm.DB

func InitDatabase(dbPath string) (*gorm.DB, error) {
	var err error

	// Ensure the database directory exists
	dir := filepath.Dir(dbPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, err
		}
	}

	// Using github.com/glebarez/sqlite driver (pure Go, no CGO required)
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	log.Println("Connected to SQLite database")

	// Auto-migrate the schema
	err = DB.AutoMigrate(&models.User{}, &models.WhatsAppSession{}, &models.Webhook{}, &models.WebhookDelivery{}, &models.APIToken{})
	if err != nil {
		return nil, err
	}

	log.Println("Database migrated successfully")
	return DB, nil
}

func GetDB() *gorm.DB {
	return DB
}
