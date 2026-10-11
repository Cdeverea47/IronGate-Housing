import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/UI.jsx';

export default function Terms() {
  return (
    <div className="min-h-screen bg-brand-gradient-diagonal bg-fixed text-white px-4 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link to="/" className="text-sm text-white/70 hover:text-white">← Back</Link>
          <h1 className="text-2xl font-semibold mt-2">Terms of Service & Privacy Policy</h1>
          <p className="text-white/60 text-sm mt-1">IronGate Housing — property management platform</p>
        </div>

        <Card className="p-6 space-y-5 text-sm text-white/80 leading-relaxed">
          <section>
            <h2 className="text-white font-medium mb-1.5">1. Acceptance of terms</h2>
            <p>
              By creating an account or otherwise using IronGate Housing (the "Service"), you agree to these Terms of
              Service and to the Privacy Policy below. If you don't agree, please don't use the Service.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-1.5">2. Accounts and roles</h2>
            <p>
              The Service supports landlord and tenant accounts. Landlords are responsible for the accuracy of
              property, unit, lease, and tenant information they enter. Tenants are responsible for the accuracy of
              information they submit, including maintenance requests, documents, and payment details.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-1.5">3. Payments</h2>
            <p>
              Rent payments processed through the Service are handled by third-party payment processors (including
              Stripe) or by direct arrangement between landlord and tenant (including Zelle). IronGate Housing does
              not custody funds and is not a party to the underlying rental agreement between landlord and tenant.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-1.5">4. Tenant screening</h2>
            <p>
              Screening requests sent through the Service link to third-party screening providers (such as
              TransUnion SmartMove). Screening results are reviewed and recorded by the landlord; IronGate Housing
              does not perform screening itself and is not responsible for the accuracy of third-party reports.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-1.5">5. Privacy</h2>
            <p>
              We store the information you provide (account details, property and lease data, documents, messages,
              and payment records) to operate the Service. We don't sell your personal information. Data is shared
              only as needed to provide the Service (e.g., a landlord and their tenants can see shared lease
              information) or as required by law.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-1.5">6. Acceptable use</h2>
            <p>
              You agree not to use the Service to violate fair housing laws, harass other users, or upload content
              you don't have the right to share.
            </p>
          </section>
          <section>
            <h2 className="text-white font-medium mb-1.5">7. Changes</h2>
            <p>
              We may update these terms from time to time. Continued use of the Service after changes means you
              accept the updated terms.
            </p>
          </section>
          <p className="text-white/50 text-xs pt-2 border-t border-white/10">
            This is a general template for a property management platform and isn't a substitute for advice from a
            lawyer familiar with your local landlord-tenant laws.
          </p>
        </Card>
      </div>
    </div>
  );
}
