package db

import (
	"github.com/glebarez/sqlite"
	"github.com/user/pinglater/internal/models"
	"gorm.io/gorm"
	"log"
)

var DB *gorm.DB

func InitDatabase(dbPath string) (*gorm.DB, error) {
	var err error

	// Using github.com/glebarez/sqlite driver (pure Go, no CGO required)
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	log.Println("Connected to SQLite database")

	// Auto-migrate the schema
	err = DB.AutoMigrate(&models.User{}, &models.WhatsAppSession{})
	if err != nil {
		return nil, err
	}

	log.Println("Database migrated successfully")
	return DB, nil
}

func GetDB() *gorm.DB {
	return DB
}
