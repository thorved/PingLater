package static

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes registers static file serving routes
func RegisterRoutes(r *gin.Engine) {
	staticPath := "./web/out"

	log.Printf("Serving static files from: %s", staticPath)
	// Check if static directory exists
	if _, err := os.Stat(staticPath); !os.IsNotExist(err) {

		// Dynamically serve files and directories
		entries, err := os.ReadDir(staticPath)
		if err == nil {
			for _, entry := range entries {
				name := entry.Name()
				// Skip index.html as it's handled separately
				if name == "index.html" {
					continue
				}

				fullPath := filepath.Join(staticPath, name)
				if entry.IsDir() {
					r.Static("/"+name, fullPath)
				} else {
					r.StaticFile("/"+name, fullPath)
				}
			}
		}

		// Serve index.html for root path
		r.GET("/", func(c *gin.Context) {
			c.File(filepath.Join(staticPath, "index.html"))
		})

		// Return 404 page for all unmatched routes
		r.NoRoute(func(c *gin.Context) {
			// Skip API routes
			if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
				c.Next()
				return
			}

			// Try 404.html first
			p404 := filepath.Join(staticPath, "404.html")
			if _, err := os.Stat(p404); err == nil {
				c.File(p404)
				return
			}

			// Try 404/index.html
			p404Index := filepath.Join(staticPath, "404", "index.html")
			if _, err := os.Stat(p404Index); err == nil {
				c.File(p404Index)
				return
			}

			// Fallback to index.html for SPA routing
			indexPath := filepath.Join(staticPath, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				c.File(indexPath)
			} else {
				c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			}
		})
	} else {
		log.Printf("Warning: Static path not found: %s", staticPath)
	}
}
