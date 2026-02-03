package webhooks

import (
	"github.com/gin-gonic/gin"
	"github.com/user/pinglater/internal/api/handlers"
	"github.com/user/pinglater/internal/api/middleware"
)

func RegisterRoutes(api *gin.RouterGroup) {
	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware())
	{
		// Webhook CRUD
		protected.GET("/webhooks", handlers.ListWebhooks)
		protected.POST("/webhooks", handlers.CreateWebhook)
		protected.GET("/webhooks/:id", handlers.GetWebhook)
		protected.PUT("/webhooks/:id", handlers.UpdateWebhook)
		protected.DELETE("/webhooks/:id", handlers.DeleteWebhook)

		// Webhook events
		protected.GET("/webhooks/events", handlers.ListWebhookEvents)

		// Webhook deliveries
		protected.GET("/webhooks/:id/deliveries", handlers.ListWebhookDeliveries)

		// Webhook stats
		protected.GET("/webhooks/:id/stats", handlers.GetWebhookStats)

		// Test webhook
		protected.POST("/webhooks/:id/test", handlers.TestWebhook)
	}
}
