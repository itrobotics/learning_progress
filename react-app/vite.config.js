import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: env.VITE_BASE || './',
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version || 'unknown'),
      __BUILD_TIME__: JSON.stringify(
        new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
      ),
    },
  }
})