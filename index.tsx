import React, { Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// Simple Error Boundary to catch crashes and display a fallback UI
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: 20, fontFamily: 'sans-serif', textAlign: 'center', marginTop: '10vh'}}>
          <h1 style={{color: '#e11d48'}}>Etwas ist schiefgelaufen 😕</h1>
          <p>Die Anwendung konnte nicht geladen werden.</p>
          <pre style={{background: '#f1f5f9', padding: 15, borderRadius: 8, overflow: 'auto', textAlign: 'left', display: 'inline-block', maxWidth: '800px'}}>
            {this.state.error?.toString()}
          </pre>
          <br />
          <button 
            onClick={() => window.location.reload()}
            style={{marginTop: 20, padding: '10px 20px', background: '#0284c7', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 16}}
          >
            Seite neu laden
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