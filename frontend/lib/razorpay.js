// Hriatrengna — Razorpay Checkout Helper
// Usage:
//   import { openRazorpayCheckout } from '../lib/razorpay'
//   await openRazorpayCheckout({ orderId, amount, plan, customer, onSuccess, onError })

export function openRazorpayCheckout({ orderId, amount, plan, customer, onSuccess, onError }) {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  if (!window.Razorpay) {
    onError?.('Razorpay script not loaded. Please refresh the page.');
    return;
  }

  const options = {
    key: keyId,
    order_id: orderId,
    amount,
    currency: 'INR',
    name: 'Hriatrengna',
    description: `${plan?.name || 'Subscription'} Plan`,
    image: '/logo.png',       // Add your logo to /public/logo.png
    prefill: {
      name:    customer?.name  || '',
      email:   customer?.email || '',
      contact: customer?.contact || '',
    },
    theme: {
      color: '#C9A84C',       // Hriatrengna gold
    },
    modal: {
      ondismiss: () => onError?.('Payment cancelled.'),
    },
    handler: function (response) {
      // response = { razorpay_payment_id, razorpay_order_id, razorpay_signature }
      onSuccess?.(response);
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
}
