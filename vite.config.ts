import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Build identity.
 *
 * A tester could not tell which build they were looking at, and neither could
 * we: preview URLs are pinned to a deployment while the production alias
 * tracks main, so "it's broken on the vercel link" was not enough information
 * to know whether the bug was already fixed. Stamping the commit into the
 * bundle makes every bug report self-identifying.
 *
 * Vercel supplies the SHA as an env var and does not ship a .git directory, so
 * that is the primary source; the git call is the local-dev fallback and is
 * allowed to fail without breaking the build.
 */
function buildSha(): string {
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'local';
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
