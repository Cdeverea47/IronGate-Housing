import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Button, Modal, Input, Label, Select, Badge, ErrorText, EmptyState } from '../components/UI.jsx';
import { PROPERTY_TYPES, propertyTypeLabel } from '../propertyTypes.js';
import { unitName, isRoomName } from '../unitName.js';

const today = () => new Date().toISOString().slice(0, 10);
const emptyTenantForm = {
  mode: 'existing',
  tenant_id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  start_date: '',
  end_date: '',
  rent_amount: '',
  deposit_amount: '',
};
const emptyUnitEdit = { unit_number: '', bedrooms: '', bathrooms: '', rent_amount: '', status: 'vacant' };
const emptyRentForm = { rent_amount: '', due_day: '1', autogenerate: true, generate_months: '3' };
const emptyUnit = { unit_number: '', bedrooms: '', bathrooms: '', rent_amount: '', status: 'vacant' };
const emptyEditForm = {
  name: '',
  property_type: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
};

function Detail({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-white/50">{label}</div>
      <div className="text-white/90">{value}</div>
    </div>
  );
}

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyUnit);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState(null);
  const [unitsEdit, setUnitsEdit] = useState({ mode: 'none', count: '2', initialMode: 'none', initialCount: 0 });
  const [tenants, setTenants] = useState([]);
  const [tenantModal, setTenantModal] = useState({ open: false, unit: null });
  const [tenantForm, setTenantForm] = useState(emptyTenantForm);
  const [tenantError, setTenantError] = useState(null);
  const [tenantSaving, setTenantSaving] = useState(false);
  const [rentModal, setRentModal] = useState({ open: false, unit: null });
  const [rentForm, setRentForm] = useState(emptyRentForm);
  const [rentError, setRentError] = useState(null);
  const [rentSaving, setRentSaving] = useState(false);
  const [rentResult, setRentResult] = useState(null);
  const [unitEdit, setUnitEdit] = useState({ open: false, unit: null });
  const [unitEditForm, setUnitEditForm] = useState(emptyUnitEdit);
  const [unitEditError, setUnitEditError] = useState(null);
  const [unitEditSaving, setUnitEditSaving] = useState(false);
  const [unitActionError, setUnitActionError] = useState(null);
  const [expandedUnit, setExpandedUnit] = useState(null);

  function load() {
    api.get(`/properties/${id}`).then(setProperty).catch((err) => setError(err.message));
  }

  useEffect(load, [id]);
  useEffect(() => {
    api.get('/tenants').then(setTenants).catch(() => {});
  }, []);

  function openTenantModal(unit) {
    setTenantForm({ ...emptyTenantForm, start_date: today(), rent_amount: unit.rent_amount ?? '' });
    setTenantError(null);
    setTenantModal({ open: true, unit });
  }

  function openUnitEdit(unit) {
    setUnitEditForm({
      unit_number: unit.unit_number ?? '',
      bedrooms: unit.bedrooms ?? '',
      bathrooms: unit.bathrooms ?? '',
      rent_amount: unit.rent_amount ?? '',
      status: unit.status || 'vacant',
    });
    setUnitEditError(null);
    setUnitEdit({ open: true, unit });
  }

  async function handleUnitEditSave(e) {
    e.preventDefault();
    setUnitEditError(null);
    setUnitEditSaving(true);
    try {
      await api.put(`/units/${unitEdit.unit.id}`, unitEditForm);
      setUnitEdit({ open: false, unit: null });
      load();
    } catch (err) {
      setUnitEditError(err.message);
    } finally {
      setUnitEditSaving(false);
    }
  }

  async function handleDeleteUnit(unit) {
    setUnitActionError(null);
    if (unit.current_lease) {
      setUnitActionError(`${unitName(unit.unit_number)} has an active lease — end the lease before deleting the unit.`);
      return;
    }
    if (!confirm(`Delete ${unitName(unit.unit_number)}? Its lease history and payments will be deleted too. This cannot be undone.`)) return;
    try {
      await api.del(`/units/${unit.id}`);
      load();
    } catch (err) {
      setUnitActionError(err.message);
    }
  }

  function openRentModal(unit) {
    const lease = unit.current_lease;
    setRentForm({
      rent_amount: lease.rent_amount ?? unit.rent_amount ?? '',
      due_day: String(lease.rent_due_day || 1),
      autogenerate: lease.rent_autogenerate ? true : !lease.rent_due_day,
      generate_months: '3',
    });
    setRentError(null);
    setRentResult(null);
    setRentModal({ open: true, unit });
  }

  async function handleSaveRent(e) {
    e.preventDefault();
    setRentError(null);
    setRentSaving(true);
    try {
      const res = await api.put(`/leases/${rentModal.unit.current_lease.lease_id}/rent`, {
        rent_amount: rentForm.rent_amount,
        due_day: rentForm.due_day,
        autogenerate: rentForm.autogenerate,
        generate_months: rentForm.generate_months,
      });
      setRentResult(res.charges_created);
      load();
    } catch (err) {
      setRentError(err.message);
    } finally {
      setRentSaving(false);
    }
  }

  async function handleAddTenant(e) {
    e.preventDefault();
    setTenantError(null);
    setTenantSaving(true);
    try {
      let tenantId = tenantForm.tenant_id;
      if (tenantForm.mode === 'new') {
        const created = await api.post('/tenants', {
          first_name: tenantForm.first_name,
          last_name: tenantForm.last_name,
          email: tenantForm.email || null,
          phone: tenantForm.phone || null,
        });
        tenantId = created.id;
      }
      if (!tenantId) throw new Error('Choose a tenant');
      await api.post('/leases', {
        unit_id: tenantModal.unit.id,
        tenant_id: tenantId,
        start_date: tenantForm.start_date,
        end_date: tenantForm.end_date || null,
        rent_amount: tenantForm.rent_amount,
        deposit_amount: tenantForm.deposit_amount || 0,
        status: 'active',
      });
      setTenantModal({ open: false, unit: null });
      api.get('/tenants').then(setTenants).catch(() => {});
      load();
    } catch (err) {
      setTenantError(err.message);
    } finally {
      setTenantSaving(false);
    }
  }

  async function handleAddUnit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/units', { ...form, property_id: id, is_room: isRooms });
      setModalOpen(false);
      setForm(emptyUnit);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function openEditModal() {
    setEditForm({
      name: property.name || '',
      property_type: property.property_type || '',
      address_line1: property.address_line1 || '',
      address_line2: property.address_line2 || '',
      city: property.city || '',
      state: property.state || '',
      zip: property.zip || '',
      notes: property.notes || '',
    });
    const list = property.units || [];
    const mode =
      list.length === 0
        ? 'none'
        : list.every((u) => isRoomName(u.unit_number))
        ? 'rooms'
        : list.length === 1 && list[0].is_default
        ? 'single'
        : 'multi';
    const first = list[0] || {};
    const home = {
      bedrooms: first.bedrooms ?? '',
      bathrooms: first.bathrooms ?? '',
      rent_amount: first.rent_amount ?? '',
    };
    setUnitsEdit({
      mode,
      count: String(Math.max(list.length, 2)),
      initialMode: mode,
      initialCount: list.length,
      ...home,
      initialHome: JSON.stringify(home),
    });
    setEditError(null);
    setEditModalOpen(true);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditError(null);
    try {
      const body = { ...editForm };
      const homeNow = JSON.stringify({
        bedrooms: unitsEdit.bedrooms,
        bathrooms: unitsEdit.bathrooms,
        rent_amount: unitsEdit.rent_amount,
      });
      const changed =
        unitsEdit.mode !== unitsEdit.initialMode ||
        ((unitsEdit.mode === 'multi' || unitsEdit.mode === 'rooms') && Number(unitsEdit.count) !== unitsEdit.initialCount) ||
        (unitsEdit.mode === 'single' && homeNow !== unitsEdit.initialHome);
      if (changed) {
        body.units = {
          mode: unitsEdit.mode,
          count: unitsEdit.count,
          bedrooms: unitsEdit.bedrooms,
          bathrooms: unitsEdit.bathrooms,
          rent_amount: unitsEdit.rent_amount,
        };
      }
      await api.put(`/properties/${id}`, body);
      setEditModalOpen(false);
      load();
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function handleDeleteProperty() {
    if (!confirm('Delete this property and all its units? This cannot be undone.')) return;
    await api.del(`/properties/${id}`);
    navigate('/properties');
  }

  if (error) return <p className="text-rose-200">{error}</p>;
  if (!property) return <p className="text-white/60">Loading…</p>;

  // Single family: one default unit — no unit list/adding, just the home's details.
  const isSingle = property.units.length === 1 && !!property.units[0].is_default;
  // Rent-by-the-room: every unit is a "Room …" with its own tenant and rent.
  const isRooms = property.units.length > 0 && property.units.every((u) => isRoomName(u.unit_number));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/properties" className="text-sm text-white/70 hover:text-white">← Back to properties</Link>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-2xl font-semibold text-white">{property.name}</h1>
            {propertyTypeLabel(property.property_type) ? (
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/80">
                {propertyTypeLabel(property.property_type)}
              </span>
            ) : null}
          </div>
          <p className="text-white/60 text-sm mt-1">
            {property.address_line1}
            {property.city ? `, ${property.city}` : ''} {property.state || ''} {property.zip || ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openEditModal}>Edit</Button>
          {isSingle ? null : <Button onClick={() => setModalOpen(true)}>{isRooms ? '+ Add room' : '+ Add unit'}</Button>}
          <Button variant="danger" onClick={handleDeleteProperty}>Delete</Button>
        </div>
      </div>

      {property.notes ? <Card className="p-4 text-sm text-white/70">{property.notes}</Card> : null}

      <div>
        <h2 className="text-lg font-medium text-white mb-3">{isSingle ? 'Home details' : isRooms ? 'Rooms' : 'Units'}</h2>
        {unitActionError ? <p className="text-sm text-rose-200 mb-3">{unitActionError}</p> : null}
        {property.units.length === 0 ? (
          <EmptyState message="No units added yet." />
        ) : (
          <Card className="divide-y divide-white/10">
            {property.units.map((u) => {
              const lease = u.current_lease;
              const open = isSingle || expandedUnit === u.id;
              const title = u.is_default ? 'Entire property' : `${unitName(u.unit_number)}`;
              return (
                <div key={u.id}>
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => (isSingle ? null : setExpandedUnit(open ? null : u.id))}
                    role="button"
                    aria-expanded={open}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`h-4 w-4 mt-1 shrink-0 text-white/60 transition-transform ${open ? 'rotate-90' : ''}`}
                        aria-hidden="true"
                      >
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                      <div className="min-w-0">
                        <div className="font-medium text-white">{title}</div>
                        <div className="text-sm text-white/60">
                          {isRooms ? '' : `${u.bedrooms ?? '–'} bd · ${u.bathrooms ?? '–'} ba · `}${u.rent_amount ?? '–'}/mo
                        </div>
                        {lease ? (
                          <div className="text-sm text-white/80 mt-0.5">
                            Tenant:{' '}
                            <Link
                              to={`/tenants/${lease.tenant_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="underline hover:text-white"
                            >
                              {lease.first_name} {lease.last_name}
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Badge tone={lease ? 'green' : 'slate'}>{lease ? 'occupied' : 'unoccupied'}</Badge>
                      {lease ? (
                        <Button variant="secondary" onClick={() => openRentModal(u)}>
                          Set up rent
                        </Button>
                      ) : (
                        <Button variant="secondary" onClick={() => openTenantModal(u)}>
                          + Add tenant
                        </Button>
                      )}
                      {isSingle ? null : (
                        <>
                          <button type="button" onClick={() => openUnitEdit(u)} className="text-sm text-white/80 hover:text-white underline">
                            Edit
                          </button>
                          <button type="button" onClick={() => handleDeleteUnit(u)} className="text-sm text-rose-300 hover:text-rose-200">
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {open ? (
                    <div className="px-4 pb-4 pl-11">
                      <div className="rounded-xl bg-white/5 border border-white/10 p-4 grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <Detail label="Occupancy" value={lease ? 'Occupied' : u.status === 'maintenance' ? 'Unoccupied — under maintenance' : 'Unoccupied'} />
                        <Detail label={lease ? 'Monthly rent' : 'Listed rent'} value={`$${lease ? lease.rent_amount : u.rent_amount ?? '–'}`} />
                        {lease ? (
                          <>
                            <Detail
                              label="Tenant"
                              value={`${lease.first_name} ${lease.last_name}${lease.email ? ` · ${lease.email}` : ''}`}
                            />
                            <Detail label="Lease start" value={lease.start_date} />
                            <Detail label="Lease end" value={lease.end_date || 'Ongoing (no end date)'} />
                            <Detail label="Security deposit" value={`$${lease.deposit_amount ?? 0}`} />
                            {lease.rent_due_day ? (
                              <Detail
                                label="Rent due"
                                value={`Day ${lease.rent_due_day} of each month${lease.rent_autogenerate ? ' (scheduled automatically)' : ''}`}
                              />
                            ) : null}
                          </>
                        ) : (
                          <Detail label="Lease" value="No active lease — add a tenant to start one" />
                        )}
                        {isRooms ? null : <Detail label="Bedrooms / bathrooms" value={`${u.bedrooms ?? '–'} bd · ${u.bathrooms ?? '–'} ba`} />}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </Card>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={isRooms ? 'Add room' : 'Add unit'}>
        <form onSubmit={handleAddUnit} className="space-y-3">
          <div>
            <Label>{isRooms ? 'Room name (optional)' : 'Unit number (optional)'}</Label>
            <Input
              value={form.unit_number}
              onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
              placeholder="e.g. 1, A, Main — leave blank to auto-number"
            />
          </div>
          <div className={isRooms ? 'hidden' : 'grid grid-cols-2 gap-3'}>
            <div>
              <Label>Bedrooms</Label>
              <Input type="number" step="0.5" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
            </div>
            <div>
              <Label>Bathrooms</Label>
              <Input type="number" step="0.5" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Monthly rent ($)</Label>
            <Input type="number" step="0.01" value={form.rent_amount} onChange={(e) => setForm({ ...form, rent_amount: e.target.value })} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Under maintenance</option>
            </Select>
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full">Save unit</Button>
        </form>
      </Modal>


      <Modal
        open={tenantModal.open}
        onClose={() => setTenantModal({ open: false, unit: null })}
        title={tenantModal.unit ? `Add tenant — ${unitName(tenantModal.unit.unit_number)}` : 'Add tenant'}
      >
        <form onSubmit={handleAddTenant} className="space-y-3">
          <div className="flex gap-2">
            {[
              { value: 'existing', label: 'Existing tenant' },
              { value: 'new', label: 'New tenant' },
            ].map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setTenantForm({ ...tenantForm, mode: m.value })}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  tenantForm.mode === m.value
                    ? 'bg-white/20 border-white/40 text-white'
                    : 'border-white/15 text-white/70 hover:bg-white/10'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {tenantForm.mode === 'existing' ? (
            <div>
              <Label>Tenant</Label>
              <Select value={tenantForm.tenant_id} onChange={(e) => setTenantForm({ ...tenantForm, tenant_id: e.target.value })} required>
                <option value="">Select a tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name}
                    {t.email ? ` · ${t.email}` : ''}
                  </option>
                ))}
              </Select>
              {tenants.length === 0 ? <p className="text-xs text-white/50 mt-1">No tenants yet — switch to "New tenant".</p> : null}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First name</Label>
                  <Input value={tenantForm.first_name} onChange={(e) => setTenantForm({ ...tenantForm, first_name: e.target.value })} required />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input value={tenantForm.last_name} onChange={(e) => setTenantForm({ ...tenantForm, last_name: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-white/50">
                Use the email the tenant signs up with, so their account links to this lease automatically.
              </p>
            </>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
            <div>
              <Label>Lease start</Label>
              <Input type="date" value={tenantForm.start_date} onChange={(e) => setTenantForm({ ...tenantForm, start_date: e.target.value })} required />
            </div>
            <div>
              <Label>Lease end (optional)</Label>
              <Input type="date" value={tenantForm.end_date} onChange={(e) => setTenantForm({ ...tenantForm, end_date: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-white/50 -mt-1">
            With an end date, every month's rent through that date is scheduled automatically — the tenant sees it
            under Upcoming and can pay any time.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monthly rent ($)</Label>
              <Input type="number" step="0.01" value={tenantForm.rent_amount} onChange={(e) => setTenantForm({ ...tenantForm, rent_amount: e.target.value })} required />
            </div>
            <div>
              <Label>Deposit ($)</Label>
              <Input type="number" step="0.01" value={tenantForm.deposit_amount} onChange={(e) => setTenantForm({ ...tenantForm, deposit_amount: e.target.value })} />
            </div>
          </div>
          <ErrorText>{tenantError}</ErrorText>
          <Button type="submit" className="w-full" disabled={tenantSaving}>
            {tenantSaving ? 'Saving…' : 'Add tenant to unit'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={rentModal.open}
        onClose={() => setRentModal({ open: false, unit: null })}
        title={rentModal.unit ? `Set up rent — ${unitName(rentModal.unit.unit_number)}` : 'Set up rent'}
      >
        <form onSubmit={handleSaveRent} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monthly rent ($)</Label>
              <Input type="number" step="0.01" min="0" value={rentForm.rent_amount} onChange={(e) => setRentForm({ ...rentForm, rent_amount: e.target.value })} required />
            </div>
            <div>
              <Label>Due on day of month</Label>
              <Select value={rentForm.due_day} onChange={(e) => setRentForm({ ...rentForm, due_day: e.target.value })}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <label className="flex items-start gap-2.5 text-sm text-white/80">
            <input
              type="checkbox"
              checked={rentForm.autogenerate}
              onChange={(e) => setRentForm({ ...rentForm, autogenerate: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-white/30 bg-white/10 accent-white"
            />
            <span>
              Create each month's rent charge automatically
              <span className="block text-xs text-white/50">
                Tenants see it under Payments and can pay online. If a tenant is on a payment plan, the month is split
                into installments.
              </span>
            </span>
          </label>
          <div>
            <Label>Create charges for the next … months</Label>
            {rentModal.unit?.current_lease?.end_date ? (
              <p className="text-xs text-white/50 -mt-1 mb-1">
                This lease ends {rentModal.unit.current_lease.end_date}, so rent is scheduled through then automatically.
              </p>
            ) : null}
            <Select value={rentForm.generate_months} onChange={(e) => setRentForm({ ...rentForm, generate_months: e.target.value })}>
              {rentModal.unit?.current_lease?.end_date ? (
                <option value="12">Through lease end ({rentModal.unit.current_lease.end_date})</option>
              ) : null}
              {[1, 2, 3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m} month{m > 1 ? 's' : ''}
                </option>
              ))}
            </Select>
          </div>
          <ErrorText>{rentError}</ErrorText>
          {rentResult !== null ? (
            <p className="text-sm text-emerald-300">
              Saved. {rentResult} upcoming rent charge{rentResult === 1 ? '' : 's'} created — see them under Payments.
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={rentSaving}>
            {rentSaving ? 'Saving…' : 'Save rent setup'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={unitEdit.open}
        onClose={() => setUnitEdit({ open: false, unit: null })}
        title={unitEdit.unit ? `Edit ${unitName(unitEdit.unit.unit_number)}` : 'Edit unit'}
      >
        <form onSubmit={handleUnitEditSave} className="space-y-3">
          <div>
            <Label>Unit number</Label>
            <Input value={unitEditForm.unit_number} onChange={(e) => setUnitEditForm({ ...unitEditForm, unit_number: e.target.value })} required />
          </div>
          <div className={isRooms ? 'hidden' : 'grid grid-cols-2 gap-3'}>
            <div>
              <Label>Bedrooms</Label>
              <Input type="number" step="0.5" min="0" value={unitEditForm.bedrooms} onChange={(e) => setUnitEditForm({ ...unitEditForm, bedrooms: e.target.value })} />
            </div>
            <div>
              <Label>Bathrooms</Label>
              <Input type="number" step="0.5" min="0" value={unitEditForm.bathrooms} onChange={(e) => setUnitEditForm({ ...unitEditForm, bathrooms: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Monthly rent ($)</Label>
            <Input type="number" step="0.01" min="0" value={unitEditForm.rent_amount} onChange={(e) => setUnitEditForm({ ...unitEditForm, rent_amount: e.target.value })} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={unitEditForm.status} onChange={(e) => setUnitEditForm({ ...unitEditForm, status: e.target.value })}>
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Under maintenance</option>
            </Select>
          </div>
          <ErrorText>{unitEditError}</ErrorText>
          <Button type="submit" className="w-full" disabled={unitEditSaving}>
            {unitEditSaving ? 'Saving…' : 'Save unit'}
          </Button>
        </form>
      </Modal>

      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit property">
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
          </div>
          <div>
            <Label>Property type</Label>
            <Select value={editForm.property_type} onChange={(e) => setEditForm({ ...editForm, property_type: e.target.value })}>
              <option value="">Select a type (optional)</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Address line 1</Label>
            <Input value={editForm.address_line1} onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })} required />
          </div>
          <div>
            <Label>Address line 2</Label>
            <Input value={editForm.address_line2} onChange={(e) => setEditForm({ ...editForm, address_line2: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>City</Label>
              <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
            </div>
            <div>
              <Label>State</Label>
              <Input value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
            </div>
            <div>
              <Label>Zip</Label>
              <Input value={editForm.zip} onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          </div>
          <div className="pt-3 border-t border-white/10 space-y-3">
            <Label>Units</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'none', label: 'No units' },
                { value: 'single', label: 'Single family' },
                { value: 'multi', label: 'Multifamily' },
                { value: 'rooms', label: 'Rent by room' },
              ].map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setUnitsEdit({ ...unitsEdit, mode: m.value })}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                    unitsEdit.mode === m.value
                      ? 'bg-white/20 border-white/40 text-white'
                      : 'border-white/15 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {unitsEdit.mode === 'single' ? (
              <div className="space-y-2">
                <p className="text-xs text-white/60">One home, no separate units — set up as a single rentable unit.</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Beds</Label>
                    <Input type="number" step="0.5" min="0" value={unitsEdit.bedrooms} onChange={(e) => setUnitsEdit({ ...unitsEdit, bedrooms: e.target.value })} />
                  </div>
                  <div>
                    <Label>Baths</Label>
                    <Input type="number" step="0.5" min="0" value={unitsEdit.bathrooms} onChange={(e) => setUnitsEdit({ ...unitsEdit, bathrooms: e.target.value })} />
                  </div>
                  <div>
                    <Label>Rent ($/mo)</Label>
                    <Input type="number" step="0.01" min="0" value={unitsEdit.rent_amount} onChange={(e) => setUnitsEdit({ ...unitsEdit, rent_amount: e.target.value })} />
                  </div>
                </div>
              </div>
            ) : null}
            {unitsEdit.mode === 'multi' || unitsEdit.mode === 'rooms' ? (
              <div>
                <Label>{unitsEdit.mode === 'rooms' ? 'Total rooms for rent' : 'Total units'}</Label>
                <Input type="number" min="1" max="100" value={unitsEdit.count} onChange={(e) => setUnitsEdit({ ...unitsEdit, count: e.target.value })} required />
                <p className="text-xs text-white/50 mt-1">Adds new numbered {unitsEdit.mode === 'rooms' ? 'rooms' : 'units'} if you raise this. Delete one from the list to remove it.</p>
              </div>
            ) : null}
            {unitsEdit.mode === 'none' && unitsEdit.initialCount > 0 ? (
              <p className="text-xs text-white/60">Removes all units (only allowed if none have ever had a lease).</p>
            ) : null}
          </div>
          <ErrorText>{editError}</ErrorText>
          <Button type="submit" className="w-full">Save changes</Button>
        </form>
      </Modal>
    </div>
  );
}
