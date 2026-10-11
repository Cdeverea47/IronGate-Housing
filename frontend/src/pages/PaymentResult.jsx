import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../components/UI.jsx';

function Shell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-gradient-diagonal bg-fixed text-white px-4">
      <Card className="w-full max-w-sm p-8 text-center">{children}</Card>
    </div>
  );
}

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const paymentId = params.get('payment_id');

  return (
    <Shell>
      <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-400/20 flex items-center justify-center text-2xl">
        ✓
      </div>
      <h1 className="text-xl font-semibold">Payment received</h1>
      <p className="mt-2 text-sm text-white/70">
        Thank you — your rent payment went through successfully.
        {paymentId ? ` (Reference #${paymentId})` : ''}
      </p>
      <p className="mt-4 text-xs text-white/50">You can close this window now.</p>
    </Shell>
  );
}

export function PaymentCancel() {
  return (
    <Shell>
      <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-amber-400/20 flex items-center justify-center text-2xl">
        !
      </div>
      <h1 className="text-xl font-semibold">Payment not completed</h1>
      <p className="mt-2 text-sm text-white/70">
        The payment was cancelled and no charge was made. Ask your landlord for a new payment link if you'd like to
        try again.
      </p>
    </Shell>
  );
}
