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
	}
}
