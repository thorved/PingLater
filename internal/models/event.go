package models

import (
	"sync"
	"time"
)

type EventType string

const (
	EventTypeConnected       EventType = "connected"
	EventTypeDisconnected    EventType = "disconnected"
	EventTypeMessageSent     EventType = "message_sent"
	EventTypeMessageReceived EventType = "message_received"
	EventTypeQRGenerated     EventType = "qr_generated"
	EventTypeConnectionError EventType = "connection_error"
)

type Event struct {
	ID        uint      `json:"id"`
	Type      EventType `json:"type"`
	Message   string    `json:"message"`
	Details   string    `json:"details,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

type EventStream struct {
	Clients map[chan Event]bool
	Mutex   sync.RWMutex
}

func NewEventStream() *EventStream {
	return &EventStream{
		Clients: make(map[chan Event]bool),
	}
}

func (es *EventStream) Subscribe() chan Event {
	es.Mutex.Lock()
	defer es.Mutex.Unlock()

	ch := make(chan Event, 10)
	es.Clients[ch] = true
	return ch
}

func (es *EventStream) Unsubscribe(ch chan Event) {
	es.Mutex.Lock()
	defer es.Mutex.Unlock()

	delete(es.Clients, ch)
	close(ch)
}

func (es *EventStream) Broadcast(event Event) {
	es.Mutex.RLock()
	defer es.Mutex.RUnlock()

	for ch := range es.Clients {
		select {
		case ch <- event:
		default:
			// Channel full, skip
		}
	}
}

type DashboardMetrics struct {
	Connected             bool      `json:"connected"`
	PhoneNumber           string    `json:"phone_number"`
	LastConnectedAt       time.Time `json:"last_connected_at"`
	TotalMessagesSent     int       `json:"total_messages_sent"`
	TotalMessagesReceived int       `json:"total_messages_received"`
	ConnectionUptime      int64     `json:"connection_uptime_seconds"`
}
