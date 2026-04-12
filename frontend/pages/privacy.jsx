import PublicPolicyLayout from '../components/layout/PublicPolicyLayout';
import { PUBLIC_SITE } from '../lib/site';

const sections = [
  {
    id: 'overview',
    title: '1. What This Policy Covers',
    content: `${PUBLIC_SITE.companyName} operates a digital memorial platform. This Privacy Policy explains what personal data we collect, how we use it, when we share it, how long we retain it, and what rights you may have.

This policy applies to subscribers, visitors, affiliate or referral participants, and individuals whose information appears within user-submitted memorial content.`,
  },
  {
    id: 'collection',
    title: '2. Information We Collect',
    content: `We may collect:

• Account details such as name and email address
• Optional profile information such as phone number
• Payment and transaction references from third-party payment processors
• Memorial content such as images, audio, video, biographies, and tributes
• Technical and usage information needed to operate, secure, and improve the Service
• Support conversations and billing-related communication records`,
  },
  {
    id: 'use',
    title: '3. How We Use Information',
    content: `We use information to:

• Create and manage your account
• Deliver albums, QR codes, media access, and subscription functionality
• Send service emails such as verification, invoices, support replies, password resets, and billing notices
• Improve reliability, performance, and abuse prevention
• Respond to support requests and legal obligations

We do not sell personal data and do not use uploaded memorial content for targeted advertising.`,
  },
  {
    id: 'sharing',
    title: '4. How We Share Information',
    content: `We share information only when needed to run the Service or comply with law. This may include:

• Payment providers such as Razorpay
• Email delivery providers such as Resend
• Cloud storage and hosting providers
• Law enforcement, courts, regulators, or professional advisers where legally required

We expect service providers to process data only for the purpose of delivering their contracted services.`,
  },
  {
    id: 'memorial',
    title: '5. Memorial Content and Public Visibility',
    content: `Memorial content often contains sensitive family photographs, names, dates, and messages. We treat this material with care.

Albums that you choose to make public can be viewed by anyone with the link or QR code. If password protection or restricted sharing is enabled for a feature, visibility is limited accordingly. You remain responsible for the content you publish and for obtaining consent where living individuals are involved.`,
  },
  {
    id: 'retention',
    title: '6. Retention',
    content: `We retain data for as long as needed to provide the Service, support billing and dispute handling, prevent fraud, and meet legal obligations.

Examples:
• Active account data is retained while the account remains in use
• Subscription and invoice records may be retained for accounting and tax purposes
• Expired content may be retained temporarily during a grace period before deletion
• Support records may be retained to help resolve ongoing issues and improve service quality`,
  },
  {
    id: 'security',
    title: '7. Security',
    content: `We use reasonable technical and organisational safeguards, including encrypted transport, access controls, password hashing, and operational logging.

No online system is perfectly secure, so we recommend using strong passwords and sharing album access thoughtfully.`,
  },
  {
    id: 'rights',
    title: '8. Your Rights',
    content: `Depending on applicable law, you may have rights to access, correct, delete, export, or object to certain uses of your data.

If you want to make a privacy request, contact ${PUBLIC_SITE.supportEmail}. We may need to verify your identity before acting on the request.`,
  },
  {
    id: 'children',
    title: "9. Children's Data",
    content: `The Service is not intended for children to use independently. If content includes children as part of legitimate family or memorial material, the adult account holder is responsible for ensuring that publication is lawful and appropriate.`,
  },
  {
    id: 'transfers',
    title: '10. International Processing',
    content: `Some service providers may process information outside India. When this happens, we rely on reasonable contractual and operational safeguards suitable for the service relationship.`,
  },
  {
    id: 'changes',
    title: '11. Changes to This Policy',
    content: `We may update this Privacy Policy over time. Material changes may be announced through the website, email, or in-product notices. Continued use after the updated effective date means the revised policy applies.`,
  },
  {
    id: 'contact',
    title: '12. Contact and Grievance',
    content: `For privacy questions, requests, or concerns, contact:

${PUBLIC_SITE.companyName}
${PUBLIC_SITE.location}
Email: ${PUBLIC_SITE.supportEmail}

Please include enough information for us to identify your account or request safely.`,
  },
];

const summaryCards = [
  { label: 'Core Purpose', value: 'Service Delivery', note: 'Your data is used to operate albums, billing, authentication, and support.' },
  { label: 'We Do Not', value: 'Sell Data', note: 'We do not sell personal data or memorial content.' },
  { label: 'Privacy Contact', value: PUBLIC_SITE.supportEmail, note: 'Use this address for access, correction, deletion, or export requests.' },
];

export default function PrivacyPage() {
  return (
    <PublicPolicyLayout
      currentHref="/privacy"
      title="Privacy Policy"
      description="How Hriatrengna collects, uses, stores, shares, and protects account data, memorial content, billing records, and support communications."
      intro={`Your privacy matters. This policy explains our data practices in plain language so you can understand what we collect, why we collect it, and what control you have over it.`}
      sections={sections}
      summaryCards={summaryCards}
      contactTitle="Need a privacy answer or data request?"
      contactText={`Email ${PUBLIC_SITE.supportEmail} for privacy requests, corrections, deletion requests, or general concerns about how data is handled.`}
    />
  );
}
