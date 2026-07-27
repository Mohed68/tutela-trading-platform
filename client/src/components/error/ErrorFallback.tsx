import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  message?: string;
}

export function ErrorFallback({ error, resetError, message }: ErrorFallbackProps) {
  const handleReload = () => {
    if (resetError) {
      resetError();
    } else {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-fit">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <CardTitle className="text-xl font-bold text-gray-900 mb-2">
            Something went wrong
          </CardTitle>
          <p className="text-gray-600 text-sm">
            {message || error?.message || 'An unexpected error occurred'}
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <Button onClick={handleReload} className="gap-2 w-full">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            
            <Button onClick={handleGoHome} variant="outline" className="gap-2 w-full">
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Simple wrapper for components that need error boundaries
export function withErrorFallback<P extends object>(
  Component: React.ComponentType<P>,
  fallbackMessage?: string
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={<ErrorFallback message={fallbackMessage} />}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// Re-export ErrorBoundary for convenience
export { ErrorBoundary } from './ErrorBoundary';
