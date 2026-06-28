// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   reactStrictMode: true,

//   // Required for Stellar/Soroban SDK WASM support
//   webpack: (config) => {
//     config.experiments = {
//       ...config.experiments,
//       asyncWebAssembly: true,
//       layers: true,
//     };

//     // Polyfills for Node.js modules used by stellar-sdk
//     config.resolve.fallback = {
//       ...config.resolve.fallback,
//       fs: false,
//       net: false,
//       tls: false,
//       crypto: false,
//     };

//     return config;
//   },

//   // Security headers
//   async headers() {
//     return [
//       {
//         source: "/(.*)",
//         headers: [
//           { key: "X-Frame-Options", value: "DENY" },
//           { key: "X-Content-Type-Options", value: "nosniff" },
//           { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
//         ],
//       },
//     ];
//   },
// };

// export default nextConfig;




import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack ko khali object dene se ya disabled rakhne se 
  // Next.js standard Webpack configuration par fallback kar jata hai
  turbopack: {}, 
  
  // Webpack config jo Stellar SDK ki native Node modules ko bypass karega
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;