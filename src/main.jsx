import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { LoadingProvider } from './context/LoadingContext.jsx'
import { SaveStatusProvider } from './context/SaveStatusContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <LoadingProvider>
        <SaveStatusProvider>
          <App />
        </SaveStatusProvider>
      </LoadingProvider>
    </ErrorBoundary>
  </StrictMode>,
)
