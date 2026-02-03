package routes

import (
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/user/pinglater/internal/routes/auth"
	"github.com/user/pinglater/internal/routes/static"
	"github.com/user/pinglater/internal/routes/webhooks"
	"github.com/user/pinglater/internal/routes/whatsapp"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()

	// Configure CORS
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	r.Use(cors.New(config))

	// API routes
	api := r.Group("/api")
	{
		auth.RegisterRoutes(api)
		whatsapp.RegisterRoutes(api)
		webhooks.RegisterRoutes(api)
	}

	// Static routes
	static.RegisterRoutes(r)

	return r
}

func GetPort() string {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	return port
}
