package whatsapp

import (
	"context"
	"fmt"
	"os"
	"sync"

	"github.com/user/pinglater/internal/db"
	"github.com/user/pinglater/internal/models"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
)

type Client struct {
	client      *whatsmeow.Client
	qrChan      chan string
	connected   bool
	phoneNumber string
	mu          sync.RWMutex
	stopChan    chan struct{}
	container   *sqlstore.Container
}

var (
	instance *Client
	once     sync.Once
)

func GetClient() *Client {
	once.Do(func() {
		instance = &Client{
			qrChan:   make(chan string, 1),
			stopChan: make(chan struct{}),
		}
	})
	return instance
}

func (c *Client) Initialize() error {
	// Ensure database directory exists
	if err := os.MkdirAll("./data", 0755); err != nil {
		return fmt.Errorf("failed to create data directory: %w", err)
	}

	// Initialize SQLite store for WhatsApp using the "sqlite" dialect
	// The github.com/glebarez/go-sqlite driver registers as "sqlite"
	// We use _pragma=foreign_keys(1) to enable foreign keys persistently
	dbLog := waLog.Stdout("Database", "DEBUG", true)
	ctx := context.Background()
	container, err := sqlstore.New(ctx, "sqlite", "file:./data/whatsapp.db?_pragma=foreign_keys(1)", dbLog)
	if err != nil {
		return fmt.Errorf("failed to create whatsapp store: %w", err)
	}
	c.container = container

	// Get or create device
	deviceStore, err := container.GetFirstDevice(ctx)
	if err != nil {
		return fmt.Errorf("failed to get device: %w", err)
	}

	// Create client
	clientLog := waLog.Stdout("Client", "DEBUG", true)
	c.client = whatsmeow.NewClient(deviceStore, clientLog)

	// Set up event handler
	c.client.AddEventHandler(c.handleEvent)

	return nil
}

func (c *Client) handleEvent(evt interface{}) {
	switch v := evt.(type) {
	case *events.LoggedOut:
		c.mu.Lock()
		c.connected = false
		c.phoneNumber = ""
		c.mu.Unlock()
		c.updateSessionStatus(false, "")
	case *events.Connected:
		c.mu.Lock()
		c.connected = true
		c.mu.Unlock()
	case *events.Disconnected:
		c.mu.Lock()
		c.connected = false
		c.mu.Unlock()
	case *events.PairSuccess:
		c.mu.Lock()
		c.phoneNumber = v.ID.User
		c.mu.Unlock()
		c.updateSessionStatus(true, v.ID.User)
	}
}

func (c *Client) updateSessionStatus(connected bool, phoneNumber string) {
	// Update database
	database := db.GetDB()
	if database == nil {
		return
	}

	var session models.WhatsAppSession
	result := database.First(&session)
	if result.Error != nil {
		// Create new session
		session = models.WhatsAppSession{
			Connected:   connected,
			PhoneNumber: phoneNumber,
		}
		database.Create(&session)
	} else {
		// Update existing
		session.Connected = connected
		session.PhoneNumber = phoneNumber
		database.Save(&session)
	}
}

func (c *Client) Connect() error {
	c.mu.Lock()
	if c.client != nil && c.client.Store.ID != nil {
		c.mu.Unlock()
		return fmt.Errorf("already connected")
	}
	c.mu.Unlock()

	if c.client == nil {
		if err := c.Initialize(); err != nil {
			return err
		}
	}

	if c.client.Store.ID == nil {
		// No ID stored, need QR login
		qrChan, err := c.client.GetQRChannel(context.Background())
		if err != nil {
			return fmt.Errorf("failed to get QR channel: %w", err)
		}

		err = c.client.Connect()
		if err != nil {
			return fmt.Errorf("failed to connect: %w", err)
		}

		// Start goroutine to continuously receive QR codes
		go func() {
			for evt := range qrChan {
				if evt.Event == "code" {
					// Clear any old QR code first (non-blocking)
					select {
					case <-c.qrChan:
					default:
					}
					// Send new QR code
					select {
					case c.qrChan <- evt.Code:
					default:
					}
				}
			}
		}()
	} else {
		// Already have session, connect directly
		err := c.client.Connect()
		if err != nil {
			return fmt.Errorf("failed to connect: %w", err)
		}
		c.mu.Lock()
		c.connected = true
		c.mu.Unlock()
	}

	return nil
}

func (c *Client) Disconnect() error {
	if c.client != nil {
		c.client.Disconnect()
		c.mu.Lock()
		c.connected = false
		c.phoneNumber = ""
		c.mu.Unlock()
		c.updateSessionStatus(false, "")
	}
	return nil
}

func (c *Client) GetQRCode() chan string {
	return c.qrChan
}

func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

func (c *Client) GetPhoneNumber() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.phoneNumber
}

func (c *Client) SendMessage(jid string, message string) error {
	if !c.IsConnected() {
		return fmt.Errorf("whatsapp not connected")
	}

	// Parse the JID from string
	parsedJID, err := types.ParseJID(jid)
	if err != nil {
		return fmt.Errorf("invalid JID: %w", err)
	}

	msg := &waE2E.Message{
		Conversation: &message,
	}

	_, err = c.client.SendMessage(context.Background(), parsedJID, msg)
	return err
}

func (c *Client) GetStatus() models.WhatsAppStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return models.WhatsAppStatus{
		Connected:       c.connected,
		PhoneNumber:     c.phoneNumber,
		QRCodeAvailable: len(c.qrChan) > 0,
	}
}
