/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",

  // Add trailing slash for static export
  trailingSlash: true,

  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

// Proxy API requests to backend during development only
if (process.env.NODE_ENV === "development") {
  nextConfig.rewrites = async () => [
    {
      source: "/api/:path*",
      destination: "http://localhost:8080/api/:path*",
    },
  ];
}

export default nextConfig;
