import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages 프로젝트 사이트는 https://<user>.github.io/<repo>/ 하위 경로로 서빙되므로
// 에셋 경로에 저장소 이름이 붙어야 한다. 로컬 dev/preview는 루트(/)를 쓴다.
// BASE_PATH를 주면 그 값이 우선한다(다른 호스팅으로 옮길 때의 탈출구).
const base = process.env.BASE_PATH ?? (process.env.GITHUB_ACTIONS ? '/black-bull/' : '/')

export default defineConfig({
  base,
  plugins: [react()],
  test: { environment: 'jsdom', globals: true },
})
