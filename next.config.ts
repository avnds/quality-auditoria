import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  ...(process.env.QUALITY_DESKTOP_PACKAGE === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
