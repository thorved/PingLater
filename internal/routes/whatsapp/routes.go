package whatsapp

import (
	"github.com/gin-gonic/gin"
	"github.com/user/pinglater/internal/api/handlers"
	"github.com/user/pinglater/internal/api/middleware"
	"github.com/user/pinglater/internal/models"
)

func RegisterRoutes(api *gin.RouterGroup) {
	protected := api.Group("")
	protected.Use(middleware.AuthMiddlewareWithFallback())
	{
		protected.GET("/whatsapp/status", handlers.GetWhatsAppStatus)
		protected.GET("/whatsapp/qr", handlers.GetWhatsAppQR)
		protected.GET("/whatsapp/current-qr", handlers.GetCurrentQRCode) // Polling alternative to SSE
		protected.POST("/whatsapp/connect", handlers.ConnectWhatsApp)
		protected.POST("/whatsapp/disconnect", handlers.DisconnectWhatsApp)
		protected.GET("/whatsapp/events", handlers.GetEvents)
		protected.GET("/whatsapp/metrics", handlers.GetMetrics)

		// Send message requires specific scope
		sendGroup := protected.Group("")
		sendGroup.Use(middleware.RequireScope(models.ScopeMessagesSend))
		sendGroup.POST("/whatsapp/send", handlers.SendMessage)
	}
}
