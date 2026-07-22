import React from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from './button';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service like Sentry here
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 flex flex-col items-center text-center space-y-4 border border-gray-100">
            <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">¡Ups! Algo salió mal</h1>
            <p className="text-gray-500 text-sm">
              La aplicación ha encontrado un error inesperado al intentar mostrar esta pantalla. 
              Nuestros ingenieros han sido notificados (es mentira, somos un bot, pero suena profesional).
            </p>

            {this.state.error && (
              <div className="w-full text-left bg-gray-100 p-3 rounded text-xs text-red-800 overflow-auto max-h-32 mb-4 border border-red-200">
                <code>{this.state.error.toString()}</code>
              </div>
            )}
            
            <div className="flex w-full gap-3 mt-4">
              <Button 
                variant="outline" 
                className="w-full flex items-center justify-center gap-2"
                onClick={() => window.location.assign('/')}
              >
                <Home className="w-4 h-4" />
                Ir al Inicio
              </Button>
              <Button 
                className="w-full flex items-center justify-center gap-2"
                onClick={() => window.location.reload()}
              >
                <RefreshCcw className="w-4 h-4" />
                Recargar Página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}
