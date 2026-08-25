import App from './App'
import { ErrorBoundary } from './ErrorBoundary'

/** 앱 최상위. main.tsx가 마운트하는 유일한 컴포넌트이고, 에러 바운더리를 여기서 두른다. */
export function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}
