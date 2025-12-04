import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#4b5563', marginBottom: '2rem' }}>
            The application encountered an unexpected error.
          </p>
          <div style={{ 
            backgroundColor: '#f3f4f6', 
            padding: '1rem', 
            borderRadius: '0.5rem', 
            overflow: 'auto', 
            fontSize: '0.875rem', 
            fontFamily: 'monospace',
            textAlign: 'left',
            marginBottom: '2rem',
            border: '1px solid #e5e7eb'
          }}>
            {this.state.error?.toString()}
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '1rem'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);