import PublicPolicyLayout from '../components/layout/PublicPolicyLayout';
import { PUBLIC_SITE } from '../lib/site';

const sections = [
  {
    id: 'overview',
    title: '1. Overview',
    content: `We understand that circumstances can change. This policy explains when refunds are available for purchases made through ${PUBLIC_SITE.companyName}, how cancellations work, and what to expect after a request is submitted.

Payments are processed through approved third-party payment providers such as Razorpay. Provider processing timelines can affect how quickly funds appear back in your bank account or card statement.`,
  },
  {
    id: 'windows',
    title: '2. Refund Windows',
    content: `Refund requests are generally reviewed under these windows:

- Monthly plans: within 7 days of the initial payment
- Yearly plans: within 14 days of the initial payment
- Lifetime plans: within 30 days of the one-time payment
- Renewals: within 7 days of the renewal date

Refund eligibility is assessed against account activity, whether the service has already been meaningfully used, and any abuse-prevention checks that may apply.`,
  },
  {
    id: 'eligibility',
    title: '3. When a Refund May Be Approved',
    content: `A refund is more likely to be approved when all of the following are true:

- The request was made within the relevant refund window
- The request was submitted by the registered account holder
- The account has not already been used to create and publish a memorial album for active public use
- The account is not under review for fraud, policy abuse, or a Terms of Service violation`,
  },
  {
    id: 'not-available',
    title: '4. When Refunds Are Usually Not Available',
    content: `Refunds are generally not available in the following situations:

- A memorial album has already been created and actively published or shared
- The refund window has expired
- The request is for a partial refund after ongoing use of the service
- The account was suspended or terminated for policy violations
- The issue relates only to exchange-rate changes, banking fees, or card-provider charges outside our control`,
  },
  {
    id: 'cancellations',
    title: '5. Subscription Cancellations',
    content: `You may cancel a subscription from your account billing settings at any time. Cancellation stops future renewal charges, but it does not automatically create a refund.

Unless a separate refund is approved, your access continues until the end of the paid billing period. After expiry, albums may become inaccessible and data may be retained temporarily for recovery, billing, legal, or dispute-handling purposes.`,
  },
  {
    id: 'requests',
    title: '6. How to Request a Refund',
    content: `To request a refund, email ${PUBLIC_SITE.supportEmail} and include:

- The email address used on the account
- The payment reference or Razorpay payment ID
- The plan purchased
- The reason for the request

Our team normally replies within ${PUBLIC_SITE.supportResponseWindow}. If a refund is approved, payment-provider settlement can take 7 to 10 business days depending on your bank or card issuer.`,
  },
  {
    id: 'multi-album',
    title: '7. Multi-Album and Downgrade Requests',
    content: `If a plan includes multiple album slots, refunds apply to the subscription purchase as a whole rather than to individual unused slots.

If you want to move to a lower-priced plan or change album capacity, contact support before renewal. Downgrades are typically scheduled for the next billing cycle and do not usually create partial refunds for the current paid period.`,
  },
  {
    id: 'chargebacks',
    title: '8. Chargebacks and Disputes',
    content: `If you believe a charge is incorrect, please contact support before filing a chargeback with your bank. Starting with support first usually resolves issues faster and helps avoid unnecessary account restrictions during an investigation.

If a chargeback is initiated, we may temporarily limit account access while we review the transaction and related account activity.`,
  },
  {
    id: 'contact',
    title: '9. Contact',
    content: `${PUBLIC_SITE.companyName}
${PUBLIC_SITE.location}
Email: ${PUBLIC_SITE.supportEmail}

Use this address for refund requests, billing questions, subscription cancellations, or downgrade discussions.`,
  },
];

const summaryCards = [
  { label: 'Monthly', value: '7 Days', note: 'For initial monthly payments submitted within the review window.' },
  { label: 'Yearly', value: '14 Days', note: 'For first-time annual purchases, subject to eligibility checks.' },
  { label: 'Lifetime', value: '30 Days', note: 'For one-time lifetime purchases where meaningful use has not already occurred.' },
  { label: 'Support Reply', value: PUBLIC_SITE.supportResponseWindow, note: `Send refund and billing requests to ${PUBLIC_SITE.supportEmail}.` },
];

export default function RefundPage() {
  return (
    <PublicPolicyLayout
      currentHref="/refund"
      title="Refund Policy"
      description="Refund, cancellation, downgrade, and billing-request rules for Hriatrengna subscriptions and memorial album purchases."
      intro={`We aim to keep refunds fair, practical, and easy to understand. This page gives you the short version first, then the full policy details if you need them.`}
      sections={sections}
      summaryCards={summaryCards}
      contactTitle="Need help with a billing question?"
      contactText={`Email ${PUBLIC_SITE.supportEmail} for refund requests, renewal questions, subscription cancellations, or billing clarifications.`}
    />
  );
}
