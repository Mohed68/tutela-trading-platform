import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { tutelaEvents } from '@/lib/tutela-events';
import { CreditCard, Zap, Shield, AlertCircle, CheckCircle } from 'lucide-react';

interface PaymentSimulationProps {
  className?: string;
}

export function PaymentSimulation({ className }: PaymentSimulationProps) {
  const [isPaymentActive, setIsPaymentActive] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [lastTransaction, setLastTransaction] = React.useState<string | null>(null);

  const simulatePaymentActivation = async () => {
    setIsProcessing(true);
    
    // Simulate activation delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsPaymentActive(true);
    setIsProcessing(false);
    
    // Trigger StatusBar notification
    tutelaEvents.paymentActivated();
    
    // Store activation state
    localStorage.setItem('tutela_payment_active', 'true');
    localStorage.setItem('tutela_payment_activated_at', new Date().toISOString());
  };

  const simulateTransaction = async (type: 'escrow' | 'release' | 'refund') => {
    if (!isPaymentActive) {
      tutelaEvents.error('Payment system not activated');
      return;
    }

    setIsProcessing(true);
    
    // Simulate transaction processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const transactionId = `TXN-${Date.now()}`;
    setLastTransaction(`${type.toUpperCase()}-${transactionId}`);
    setIsProcessing(false);
    
    // Store transaction in localStorage with tutela_ prefix
    const transactions = JSON.parse(localStorage.getItem('tutela_transactions') || '[]');
    const newTransaction = {
      id: transactionId,
      type,
      amount: Math.floor(Math.random() * 100000) + 10000,
      currency: 'USD',
      timestamp: new Date().toISOString(),
      status: 'completed'
    };
    
    transactions.push(newTransaction);
    localStorage.setItem('tutela_transactions', JSON.stringify(transactions));
    localStorage.setItem(`tutela_transaction_${transactionId}`, JSON.stringify(newTransaction));
    
    // Trigger StatusBar notification
    tutelaEvents.contractExecuted(`Payment ${type}`);
  };

  const simulateVerification = async () => {
    setIsProcessing(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsProcessing(false);
    localStorage.setItem('tutela_kyb_verified', 'true');
    localStorage.setItem('tutela_verification_date', new Date().toISOString());
    
    tutelaEvents.verificationComplete();
  };

  const simulateDemo = () => {
    localStorage.setItem('tutela_demo_mode', 'true');
    localStorage.setItem('tutela_demo_started_at', new Date().toISOString());
    tutelaEvents.demoActive();
  };

  // Check initial state
  React.useEffect(() => {
    const paymentActive = localStorage.getItem('tutela_payment_active') === 'true';
    setIsPaymentActive(paymentActive);
  }, []);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Payment Simulation & Status
        </CardTitle>
        <CardDescription>
          Simulate payment system activation and trigger StatusBar notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Payment Status */}
        <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isPaymentActive ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
            <span className="font-medium">Payment System</span>
          </div>
          <Badge variant={isPaymentActive ? 'default' : 'secondary'}>
            {isPaymentActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Activation Button */}
        {!isPaymentActive && (
          <Button 
            onClick={simulatePaymentActivation} 
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Zap className="w-4 h-4 mr-2 animate-spin" />
                Activating Payment System...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Activate Payment System
              </>
            )}
          </Button>
        )}

        {/* Transaction Simulation */}
        {isPaymentActive && (
          <div className="space-y-2">
            <h4 className="font-medium">Simulate Transactions</h4>
            <div className="grid grid-cols-1 gap-2">
              <Button 
                variant="outline" 
                onClick={() => simulateTransaction('escrow')}
                disabled={isProcessing}
                size="sm"
              >
                Escrow Payment
              </Button>
              <Button 
                variant="outline" 
                onClick={() => simulateTransaction('release')}
                disabled={isProcessing}
                size="sm"
              >
                Release Funds
              </Button>
              <Button 
                variant="outline" 
                onClick={() => simulateTransaction('refund')}
                disabled={isProcessing}
                size="sm"
              >
                Process Refund
              </Button>
            </div>
          </div>
        )}

        {/* Other System Events */}
        <div className="space-y-2">
          <h4 className="font-medium">System Events</h4>
          <div className="grid grid-cols-1 gap-2">
            <Button 
              variant="outline" 
              onClick={simulateVerification}
              disabled={isProcessing}
              size="sm"
            >
              <Shield className="w-4 h-4 mr-2" />
              Complete KYB Verification
            </Button>
            <Button 
              variant="outline" 
              onClick={simulateDemo}
              size="sm"
            >
              <Zap className="w-4 h-4 mr-2" />
              Activate Demo Mode
            </Button>
            <Button 
              variant="outline" 
              onClick={() => tutelaEvents.error('Sample error message')}
              size="sm"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Trigger Error
            </Button>
            <Button 
              variant="outline" 
              onClick={() => tutelaEvents.warning('Sample warning message')}
              size="sm"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Trigger Warning
            </Button>
          </div>
        </div>

        {/* Last Transaction */}
        {lastTransaction && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">
                Last Transaction: {lastTransaction}
              </span>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center p-4">
            <div className="flex items-center gap-2 text-neutral-600">
              <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
              <span className="text-sm">Processing...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}