import PublicPolicyLayout from '../components/layout/PublicPolicyLayout';
import { PUBLIC_SITE } from '../lib/site';

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: `By accessing or using ${PUBLIC_SITE.companyName} ("the Service", "we", "our"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Service. These Terms form a legally binding agreement between you and ${PUBLIC_SITE.companyName}.

Use of the Service by anyone under 18 requires consent from a parent or legal guardian. By using the Service, you confirm that you are at least 18 years old or are using the Service with appropriate consent.`,
  },
  {
    id: 'description',
    title: '2. Description of Service',
    content: `${PUBLIC_SITE.companyName} is a digital memorial platform that lets subscribers create, manage, and share online memorial albums for deceased individuals. The Service may include:

• Creation of memorial albums
• Upload and storage of photographs, videos, audio, biographies, and tributes
• QR codes linked to memorial pages
• Subscription-based access and billing features
• Optional referral or affiliate features

We may modify, improve, suspend, or discontinue parts of the Service with reasonable notice when practical.`,
  },
  {
    id: 'accounts',
    title: '3. Accounts and Responsibilities',
    content: `You are responsible for keeping your login credentials confidential and for all activity under your account. You agree to:

• Provide accurate and current information
• Update your account if details change
• Notify us promptly of unauthorised access
• Avoid sharing credentials or impersonating others
• Use the Service lawfully and respectfully

We may suspend or terminate accounts that violate these Terms or create risk for the platform or other users.`,
  },
  {
    id: 'content',
    title: '4. User Content and Rights',
    content: `You retain ownership of the content you upload, including photographs, audio, video, biographies, and tributes.

By uploading content, you grant ${PUBLIC_SITE.companyName} a non-exclusive, worldwide, royalty-free licence to host, process, display, and deliver that content solely to operate and improve the Service. We do not claim ownership of your content and do not use it for advertising.

You confirm that you have the right to upload the content you submit and that it does not violate law, privacy, or third-party intellectual property rights.`,
  },
  {
    id: 'conduct',
    title: '5. Prohibited Content and Conduct',
    content: `You may not use the Service to upload or share material that is unlawful, defamatory, hateful, abusive, fraudulent, invasive of privacy, or malicious.

You may not attempt to:
• Access accounts without permission
• Circumvent security controls
• Scrape or reverse-engineer protected parts of the Service
• Distribute malware or harmful code
• Misrepresent identity, ownership, or consent`,
  },
  {
    id: 'billing',
    title: '6. Subscriptions and Payments',
    content: `The Service is offered through subscription or one-time purchase plans. Payments are processed by third-party payment providers such as Razorpay, whose own terms and privacy policies also apply.

Subscriptions renew automatically unless cancelled before renewal. If a payment fails, access may move into a grace or past-due state before suspension.

Plan prices, inclusions, and limits are shown in the product at the time of purchase. We may revise future pricing with advance notice where required.`,
  },
  {
    id: 'refunds',
    title: '7. Refunds and Cancellations',
    content: `Our refund rules are described in more detail in the Refund Policy. In summary:

• Monthly plans may be eligible within 7 days of initial payment
• Yearly plans may be eligible within 14 days of initial payment
• Lifetime plans may be eligible within 30 days of payment
• Renewal charges may be reviewed within 7 days of renewal

Refund eligibility depends on meaningful use of the Service and other factors described in the Refund Policy.`,
  },
  {
    id: 'retention',
    title: '8. Data Retention and Album Access',
    content: `Active subscribers retain access for the duration of an active plan. After cancellation or expiry, we may provide a grace period before permanent deletion.

Albums may become inaccessible to the public when a subscription ends. Content may still be retained temporarily to support recovery, billing, dispute handling, and legal compliance.

Lifetime-style plans, where offered, are subject to the retention term described at the time of purchase.`,
  },
  {
    id: 'privacy',
    title: '9. Privacy',
    content: `Your use of the Service is also governed by our Privacy Policy. By using the Service, you acknowledge that we collect, use, and protect information as described there.`,
  },
  {
    id: 'affiliates',
    title: '10. Affiliate or Referral Features',
    content: `If you participate in any affiliate or referral programme, additional programme rules may apply. Approval, commission rules, payout timing, and suspension rights remain at our discretion unless otherwise stated in writing.`,
  },
  {
    id: 'disclaimer',
    title: '11. Disclaimer of Warranties',
    content: `The Service is provided on an "as is" and "as available" basis. To the fullest extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, non-infringement, and uninterrupted availability.

While we take preservation seriously, no digital system can guarantee zero downtime or zero data loss.`,
  },
  {
    id: 'liability',
    title: '12. Limitation of Liability',
    content: `To the fullest extent permitted by law, ${PUBLIC_SITE.companyName} will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages arising from use of the Service.

Our total liability for any claim relating to the Service will generally not exceed the amount you paid us in the 12 months before the event giving rise to the claim.`,
  },
  {
    id: 'termination',
    title: '13. Suspension and Termination',
    content: `We may suspend or terminate access for breach of these Terms, unlawful activity, misuse of the platform, security risk, or non-payment.

You may also request account closure. Certain records may still be retained for billing, dispute resolution, fraud prevention, or legal compliance.`,
  },
  {
    id: 'law',
    title: '14. Governing Law and Disputes',
    content: `These Terms are governed by the laws of India. Unless otherwise required by law, disputes will be subject to the courts located in or serving Mizoram, India.

We encourage parties to first attempt to resolve disputes in good faith by contacting support.`,
  },
  {
    id: 'changes',
    title: '15. Changes to These Terms',
    content: `We may update these Terms from time to time. Material changes may be communicated through the website, email, or account notices. Continued use after the effective date of the updated Terms constitutes acceptance of the revised Terms.`,
  },
  {
    id: 'contact',
    title: '16. Contact',
    content: `${PUBLIC_SITE.companyName}
${PUBLIC_SITE.location}
Email: ${PUBLIC_SITE.supportEmail}

For billing, support, or legal questions, contact us and we will respond as soon as reasonably possible.`,
  },
];

const summaryCards = [
  { label: 'Primary Law', value: 'India', note: 'Indian law governs these Terms unless applicable law requires otherwise.' },
  { label: 'Refund Window', value: '7-30 Days', note: 'Depends on the plan type and level of product use.' },
  { label: 'Support Contact', value: PUBLIC_SITE.supportEmail, note: 'Use this address for support, billing, and policy questions.' },
];

export default function TermsPage() {
  return (
    <PublicPolicyLayout
      currentHref="/terms"
      title="Terms of Service"
      description="The rules that govern use of the Hriatrengna platform, subscriptions, uploaded memorial content, and account responsibilities."
      intro={`Please read these Terms carefully before using ${PUBLIC_SITE.companyName}. We wrote them to stay clear, human, and practical while still covering the legal relationship between you and the platform.`}
      sections={sections}
      summaryCards={summaryCards}
      contactTitle="Questions about these terms?"
      contactText={`Email ${PUBLIC_SITE.supportEmail} if you need clarification on subscriptions, cancellations, content rights, or account use.`}
    />
  );
}
