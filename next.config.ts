import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000',
    // Check NEXT_PUBLIC_* first (from build-env-vars-file), then MOMENTUM_* (from Secret Manager or .env)
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_APP_ID,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    serverActions: {
      allowedOrigins: [
        '*.replit.dev',
        '*.repl.co',
        '*.replit.app',
        '*.janeway.replit.dev',
        '*.spock.replit.dev',
        'jeanlabs.ai', // Custom domain
        '*.jeanlabs.ai', // Wildcard for subdomains
      ],
    },
  },
  serverExternalPackages: ['firebase-admin'],
  // Allow requests from all hosts for Replit environment
  allowedDevOrigins: [
    '*.replit.dev',
    '*.repl.co',
    '*.replit.app',
    'localhost',
    '127.0.0.1',
    '*.janeway.replit.dev',
    '*.spock.replit.dev',
    'jeanlabs.ai', // Custom domain
    '*.jeanlabs.ai', // Wildcard for subdomains
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Authorization',
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'sample-videos.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.nike.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudfront.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.imgix.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.shopify.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.shopifycdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.akamaized.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.wp.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.wixstatic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.squarespace.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.ctfassets.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.fastly.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.azureedge.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.brightcove.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'mailchimp.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.mailchimp.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'assets.tfrrs.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www2.umbc.edu',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.edu',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'umbcretrievers.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'worldathletics.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.olympics.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
