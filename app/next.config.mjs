/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @huggingface/transformers ships optional native bindings (onnxruntime-node,
  // sharp) that must stay external to the serverless bundle.
  experimental: {
    serverComponentsExternalPackages: ["@huggingface/transformers"],
  },
};

export default nextConfig;
