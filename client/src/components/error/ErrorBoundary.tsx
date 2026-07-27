import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Bug, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate a unique error ID for tracking
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Log to external error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry, LogRocket, etc.
      console.error('Production Error:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorId: this.state.errorId,
      });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleGoBack = () => {
    window.history.back();
  };

  handleReportBug = () => {
    const subject = encodeURIComponent(`TUTELA Error Report - ${this.state.errorId}`);
    const body = encodeURIComponent(`
Error ID: ${this.state.errorId}
Error Message: ${this.state.error?.message || 'Unknown error'}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}
Timestamp: ${new Date().toISOString()}

Additional Details:
${this.state.error?.stack || 'No stack trace available'}
    `);
    
    window.open(`mailto:support@tutela.com?subject=${subject}&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl shadow-xl border-0 bg-white">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-fit">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
                Something went wrong
              </CardTitle>
              <p className="text-gray-600">
                We encountered an unexpected error while loading this page.
              </p>
              <Badge variant="secondary" className="mx-auto mt-2 font-mono text-xs">
                Error ID: {this.state.errorId}
              </Badge>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Error Details for Development */}
              {isDevelopment && this.state.error && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    Development Error Details
                  </h4>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-600">
                      {this.state.error.message}
                    </p>
                    <details className="text-xs text-gray-600">
                      <summary className="cursor-pointer hover:text-gray-800">
                        Stack Trace
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                        {this.state.error.stack}
                      </pre>
                    </details>
                    {this.state.errorInfo?.componentStack && (
                      <details className="text-xs text-gray-600">
                        <summary className="cursor-pointer hover:text-gray-800">
                          Component Stack
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )}

              {/* User-friendly suggestions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">What can you do?</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Try refreshing the page</li>
                  <li>• Go back to the previous page</li>
                  <li>• Return to the home page</li>
                  <li>• Clear your browser cache and cookies</li>
                  <li>• Try again in a few minutes</li>
                </ul>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 justify-center">
                <Button onClick={this.handleReload} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Reload Page
                </Button>
                
                <Button onClick={this.handleGoBack} variant="outline" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Go Back
                </Button>
                
                <Button onClick={this.handleGoHome} variant="outline" className="gap-2">
                  <Home className="w-4 h-4" />
                  Home Page
                </Button>
              </div>

              {/* Report bug button */}
              <div className="text-center pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-3">
                  If this problem persists, please let us know.
                </p>
                <Button 
                  onClick={this.handleReportBug} 
                  variant="ghost" 
                  size="sm"
                  className="gap-2 text-gray-600 hover:text-gray-800"
                >
                  <Bug className="w-4 h-4" />
                  Report Bug
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Simple error boundary hook for functional components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}