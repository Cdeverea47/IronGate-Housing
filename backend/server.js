require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const unitRoutes = require('./routes/units');
const tenantRoutes = require('./routes/tenants');
const leaseRoutes = require('./routes/leases');
const paymentRoutes = require('./routes/payments');
const maintenanceRoutes = require('./routes/maintenance');
const documentRoutes = require('./routes/documents');
const dashboardRoutes = require('./routes/dashboard');
const performanceRoutes = require('./routes/performance');
const insuranceRoutes = require('./routes/insurance');
const listingRoutes = require('./routes/listings');
const taskRoutes = require('./routes/tasks');
const screeningRoutes = require('./routes/screenings');
const publicScreeningRoutes = require('./routes/publicScreening');
const paymentPlanRoutes = require('./routes/paymentPlans');
const notificationRoutes = require('./routes/notifications');
const portalRoutes = require('./routes/portal');
const webhookRoutes = require('./routes/webhooks');
const { checkLeaseRenewals } = require('./lib/leaseRenewals');

const app = express();
app.use(cors());

// Stripe webhooks need the raw request body to verify signatures, so this is
// mounted BEFORE express.json() — do not move it below the json() line.
app.use('/api/webhooks', webhookRoutes);

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/leases', leaseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/screenings', screeningRoutes);
app.use('/api/public/screening', publicScreeningRoutes);
app.use('/api/payment-plans', paymentPlanRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/portal', portalRoutes);

// serve built frontend in production, if present
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next();
  });
});

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API server listening on http://localhost:${PORT}`));

// Lease renewal reminders: check once at startup, then once a day. No cron
// dependency needed for a once-a-day check — plain setInterval is enough.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
checkLeaseRenewals().catch((err) => console.error('Lease renewal check failed:', err.message));
setInterval(() => {
  checkLeaseRenewals().catch((err) => console.error('Lease renewal check failed:', err.message));
}, ONE_DAY_MS);
