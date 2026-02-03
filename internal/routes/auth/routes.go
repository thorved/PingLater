package auth

import (
	"github.com/gin-gonic/gin"
	"github.com/user/pinglater/internal/api/handlers"
	"github.com/user/pinglater/internal/api/middleware"
)

func RegisterRoutes(api *gin.RouterGroup) {
	// Public routes
	api.POST("/auth/login", handlers.Login)
	api.POST("/auth/logout", handlers.Logout)

	// Protected routes
	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware())
	{
		protected.GET("/auth/me", handlers.GetMe)

		// API Token management routes
		protected.GET("/auth/tokens", handlers.ListTokens)
		protected.POST("/auth/tokens", handlers.CreateToken)
		protected.GET("/auth/tokens/scopes", handlers.GetAvailableScopes)
		protected.DELETE("/auth/tokens/:id", handlers.DeleteToken)
		protected.POST("/auth/tokens/:id/rotate", handlers.RotateToken)
		protected.PUT("/auth/tokens/:id", handlers.UpdateToken)
	}
}
