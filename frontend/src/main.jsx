import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import ErrorBoundary from './components/ErrorBoundary'
import ToastProvider from './components/Toast'
import SkeletonLoader from './components/SkeletonLoader'
import './index.css'

const App = lazy(() => import('./App'))

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <ToastProvider>
      <Suspense fallback={<SkeletonLoader />}>
        <App />
      </Suspense>
    </ToastProvider>
  </ErrorBoundary>
)
