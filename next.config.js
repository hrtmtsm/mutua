/** @type {import('next').NextConfig} */
const nextConfig = { distDir: process.env.PAIRED_DIST_DIR || '.next' };

module.exports = nextConfig;
