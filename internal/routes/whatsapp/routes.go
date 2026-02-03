package whatsapp

import (
	"github.com/gin-gonic/gin"
	"github.com/user/pinglater/internal/api/handlers"
	"github.com/user/pinglater/internal/api/middleware"
)

func RegisterRoutes(api *gin.RouterGroup) {
	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware())
	{
		protected.GET("/whatsapp/status", handlers.GetWhatsAppStatus)
		protected.GET("/whatsapp/qr", handlers.GetWhatsAppQR)
		protected.POST("/whatsapp/connect", handlers.ConnectWhatsApp)
		protected.POST("/whatsapp/disconnect", handlers.DisconnectWhatsApp)
	}
}
