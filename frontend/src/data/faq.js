// Knowledge base for the Help page — both the plain FAQ accordion and the
// "AI help chat" (a keyword-matching search over this same data, see
// Help.jsx) read from this single list.
export const FAQ = [
  // Getting started
  {
    id: 'add-property',
    audience: 'landlord',
    question: 'How do I add a property?',
    answer:
      'Go to Properties and click "+ Add property". Fill in the name, address, and optionally a property type (single family, duplex, apartment, etc.) and notes.',
    keywords: ['property', 'add', 'create', 'new', 'building'],
  },
  {
    id: 'edit-property',
    audience: 'landlord',
    question: 'How do I edit a property?',
    answer:
      'Open the property from the Properties list, then click "Edit" next to "+ Add unit" to update its name, type, address, or notes.',
    keywords: ['property', 'edit', 'update', 'change'],
  },
  {
    id: 'add-unit',
    audience: 'landlord',
    question: 'How do I add a unit to a property?',
    answer:
      'Open the property and click "+ Add unit". You can leave the unit number blank and it will auto-number for you.',
    keywords: ['unit', 'add', 'apartment', 'number'],
  },
  {
    id: 'add-tenant',
    audience: 'landlord',
    question: 'How do I add a tenant?',
    answer:
      'Go to Tenants and click "Add tenant". If they later register for a tenant account using the same email, it links to their record automatically.',
    keywords: ['tenant', 'add', 'create', 'new'],
  },
  {
    id: 'tenant-notes',
    audience: 'landlord',
    question: 'Can I keep notes on a tenant?',
    answer: 'Yes — open the tenant\'s page and use the Notes section to write and save notes at any time.',
    keywords: ['tenant', 'notes', 'comment'],
  },
  {
    id: 'add-lease',
    audience: 'landlord',
    question: 'How do I create a lease?',
    answer: 'Go to Leases and click "+ Add lease", then pick the unit, tenant, start/end date, and rent amount.',
    keywords: ['lease', 'create', 'add', 'rent', 'agreement'],
  },
  {
    id: 'dual-account',
    audience: 'both',
    question: 'Can I have both a landlord and a tenant account with the same email?',
    answer:
      'Yes. When registering, pick the role (landlord or tenant) — each role gets its own separate account even if the email is the same. When you log in, use the toggle to pick which one you\'re signing into.',
    keywords: ['same email', 'both accounts', 'dual', 'landlord and tenant', 'two accounts'],
  },

  // Payments
  {
    id: 'pay-rent',
    audience: 'tenant',
    question: 'How do I pay my rent?',
    answer:
      'Go to Payments and click on a pending charge to pay by card (if your landlord has Stripe set up) or by Zelle, if they\'ve added a Zelle contact.',
    keywords: ['pay', 'rent', 'payment', 'stripe', 'zelle', 'card'],
  },
  {
    id: 'stripe-not-configured',
    audience: 'both',
    question: 'Why does it say online card payments aren\'t set up?',
    answer:
      'This means the landlord\'s Stripe account isn\'t connected yet (STRIPE_SECRET_KEY isn\'t set in the backend). Tenants can still pay by Zelle if the landlord has added a Zelle contact, or the landlord can finish Stripe setup — see the README.',
    keywords: ['invalid', 'stripe', 'not configured', 'card payment', 'error', 'pay rent'],
  },
  {
    id: 'collect-rent',
    audience: 'landlord',
    question: 'How do I collect rent online?',
    answer:
      'Set STRIPE_SECRET_KEY in backend/.env to accept card payments, or add your Zelle contact info under Profile so tenants can pay you directly.',
    keywords: ['collect', 'rent', 'stripe', 'zelle', 'online payment'],
  },
  {
    id: 'payment-plan-request',
    audience: 'tenant',
    question: 'How do I request a different payment plan?',
    answer:
      'Go to Profile, and under the Payment plan section choose a plan (pay in full, split into 2, or split into 4), whether it\'s temporary or permanent, and send the request. Your landlord will approve or deny it.',
    keywords: ['payment plan', 'installment', 'split', 'request', 'temporary', 'permanent'],
  },
  {
    id: 'approve-payment-plan',
    audience: 'landlord',
    question: 'How do I approve a tenant\'s payment plan request?',
    answer: 'Go to the Payment Plans tab to see incoming requests and approve or deny each one.',
    keywords: ['payment plan', 'approve', 'deny', 'installment', 'request'],
  },
  {
    id: 'bank-info',
    audience: 'tenant',
    question: 'Is it safe to add my bank information?',
    answer:
      'We only ever store the last 4 digits of your account number for your own reference — the full account number is never saved. For actually moving money, use the card (Stripe) or Zelle options.',
    keywords: ['bank', 'account number', 'secure', 'safe', 'information'],
  },

  // Screening
  {
    id: 'send-screening',
    audience: 'landlord',
    question: 'How do I run a background/credit check on an applicant?',
    answer:
      'Go to Screening and click "+ Send screening". The applicant gets an email with a link to complete a TransUnion SmartMove check and report back to you.',
    keywords: ['screening', 'background check', 'credit check', 'applicant', 'tenant screening'],
  },
  {
    id: 'complete-screening',
    audience: 'both',
    question: 'I got a screening email — what do I do?',
    answer:
      'Click the link in the email. It opens a page with a link to complete your check on TransUnion SmartMove, plus a button to let your prospective landlord know once you\'re done.',
    keywords: ['screening', 'complete', 'applicant', 'smartmove', 'link'],
  },

  // Documents & maintenance
  {
    id: 'upload-documents',
    audience: 'both',
    question: 'How do I upload a document?',
    answer: 'Go to Documents and use the upload button. Tenants can also upload their renter\'s insurance there.',
    keywords: ['document', 'upload', 'file', 'insurance'],
  },
  {
    id: 'maintenance-request',
    audience: 'tenant',
    question: 'How do I submit a maintenance request?',
    answer: 'Go to Maintenance and click "+ New request" — describe the issue and set a priority.',
    keywords: ['maintenance', 'repair', 'request', 'submit', 'issue'],
  },
  {
    id: 'resolve-maintenance',
    audience: 'landlord',
    question: 'How do I mark a maintenance request as resolved?',
    answer: 'Open Maintenance, find the request, and change its status to Resolved.',
    keywords: ['maintenance', 'resolve', 'close', 'complete', 'status'],
  },

  // Notifications & account
  {
    id: 'notifications-bell',
    audience: 'both',
    question: 'Where do I see notifications?',
    answer:
      'Click the bell icon in the header. It shows things like overdue rent, maintenance updates, lease renewals, and new documents. Click one to dismiss it.',
    keywords: ['notifications', 'bell', 'alerts'],
  },
  {
    id: 'turn-off-notifications',
    audience: 'both',
    question: 'How do I turn off email notifications?',
    answer:
      'Go to Profile > Login & Security and uncheck "Send me email notifications." This won\'t affect essential emails like password resets or sign-in codes.',
    keywords: ['turn off', 'disable', 'email notifications', 'stop emails'],
  },
  {
    id: 'change-email',
    audience: 'both',
    question: 'How do I change my email address?',
    answer: 'Go to Profile > Login & Security, enter your new email and current password, then click Update email.',
    keywords: ['change email', 'update email', 'account email'],
  },
  {
    id: 'change-password',
    audience: 'both',
    question: 'How do I change my password?',
    answer:
      'While logged in, go to Profile > Login & Security and use the Password section. If you\'ve forgotten your current password, use "Forgot password?" on the sign-in page instead.',
    keywords: ['change password', 'update password', 'forgot password', 'reset password'],
  },
  {
    id: 'two-factor',
    audience: 'both',
    question: 'How do I enable two-factor authentication?',
    answer:
      'Go to Profile > Login & Security and click "Enable two-factor authentication." We\'ll email you a code to confirm — after that, every sign-in will ask for a fresh code sent to your email.',
    keywords: ['two-factor', '2fa', 'security', 'verification code', 'enable'],
  },
  {
    id: 'profile-picture',
    audience: 'both',
    question: 'How do I update my profile picture?',
    answer: 'Go to Profile and click "Change photo" next to your avatar.',
    keywords: ['profile picture', 'avatar', 'photo', 'change photo'],
  },
  {
    id: 'contact-landlord',
    audience: 'tenant',
    question: 'How do I contact my landlord?',
    answer: 'On your Dashboard, use the "Email landlord" button to open a pre-filled email.',
    keywords: ['contact', 'landlord', 'email', 'message'],
  },
  {
    id: 'lease-months-left',
    audience: 'tenant',
    question: 'How do I see how much time is left on my lease?',
    answer:
      'Your Dashboard shows "months left" on your active lease, and you\'ll get a notification and email as it approaches the end date.',
    keywords: ['lease', 'months left', 'renewal', 'end date', 'expire'],
  },
  {
    id: 'vacancy-insurance-dashboard',
    audience: 'landlord',
    question: 'What do the Vacancy and Rental insurance boxes on my dashboard show?',
    answer:
      'Vacancy shows how many units are empty vs. occupied. Rental insurance shows your policies — swipe through it if you have more than one.',
    keywords: ['vacancy', 'rental insurance', 'dashboard', 'occupied'],
  },
];
