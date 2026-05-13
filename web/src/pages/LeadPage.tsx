import { useEffect, useMemo, useState } from 'react';
import { db } from '../storage/db';
import { api } from '../api/index';
import { syncNow } from '../sync/syncManager';

type Supplier = {
	id: number;
	supplier_name: string;
};

type LeadForm = {
	firstName: string;
	lastName: string;
	company: string;
	email: string;
	phone: string;
	interestArea: string;
	notes: string;
	selectedSuppliers: number[];
};

const initialForm: LeadForm = {
	firstName: '',
	lastName: '',
	company: '',
	email: '',
	phone: '',
	interestArea: '',
	notes: '',
	selectedSuppliers: [],
};

const quickInterests = ['Product Demo', 'Pricing', 'Partnership', 'Support'];

export function LeadPage() {
	const [suppliers, setSuppliers] = useState<Supplier[]>([]);
	const [form, setForm] = useState<LeadForm>(initialForm);
	const [message, setMessage] = useState('');
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		api
			.get('/suppliers')
			.then((result) => setSuppliers(Array.isArray(result) ? result : []))
			.catch(() => setSuppliers([]));
	}, []);

	const selectedCount = useMemo(() => form.selectedSuppliers.length, [form.selectedSuppliers]);

	const setField = (key: keyof LeadForm, value: string) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const toggleSupplier = (supplierId: number, checked: boolean) => {
		setForm((prev) => ({
			...prev,
			selectedSuppliers: checked
				? [...prev.selectedSuppliers, supplierId]
				: prev.selectedSuppliers.filter((id) => id !== supplierId),
		}));
	};

	const save = async () => {
		if (!form.firstName.trim() || !form.email.trim()) {
			setMessage('Enter at least first name and email before saving.');
			return;
		}

		setSaving(true);
		setMessage('Saving lead...');

		const now = new Date().toISOString();
		const lead = {
			...form,
			uuid: crypto.randomUUID(),
			eventId: 1,
			createdAt: now,
			updatedAt: now,
			syncStatus: 'pending',
			emailSentStatus: 'pending',
			brevoSyncStatus: 'pending',
		};

		await db.leads.put(lead);
		setForm(initialForm);
		setMessage('Lead saved. Ready for the next visitor.');
		setSaving(false);
		syncNow();
	};

	return (
		<section className='screen'>
			<div className='screen-head'>
				<h2>New Lead</h2>

			</div>

			<div className='capture-grid'>
				<label>
					First Name*
					<input
						value={form.firstName}
						onChange={(e) => setField('firstName', e.target.value)}
						autoComplete='given-name'
					/>
				</label>

				<label>
					Last Name
					<input
						value={form.lastName}
						onChange={(e) => setField('lastName', e.target.value)}
						autoComplete='family-name'
					/>
				</label>

				<label>
					Email*
					<input
						type='email'
						value={form.email}
						onChange={(e) => setField('email', e.target.value)}
						autoComplete='email'
					/>
				</label>

				<label>
					Phone
					<input
						type='tel'
						value={form.phone}
						onChange={(e) => setField('phone', e.target.value)}
						autoComplete='tel'
					/>
				</label>

				<label>
					Company
					<input
						value={form.company}
						onChange={(e) => setField('company', e.target.value)}
						autoComplete='organization'
					/>
				</label>

				<label>
					Interest Area
					<input
						value={form.interestArea}
						onChange={(e) => setField('interestArea', e.target.value)}
						placeholder='Demo, pricing, onboarding...'
					/>
				</label>

				<div className='quick-picks'>
					{quickInterests.map((item) => (
						<button
							type='button'
							key={item}
							onClick={() => setField('interestArea', item)}
							className={form.interestArea === item ? 'active' : ''}
						>
							{item}
						</button>
					))}
				</div>

				<label className='full-width'>
					Notes
					<textarea
						rows={4}
						value={form.notes}
						onChange={(e) => setField('notes', e.target.value)}
					/>
				</label>

				<div className='full-width supplier-block'>
					<p className='supplier-title'>Suppliers ({selectedCount} selected)</p>
					<div className='supplier-list'>
						{suppliers.map((supplier) => (
							<label key={supplier.id} className='supplier-item'>
								<input
									type='checkbox'
									checked={form.selectedSuppliers.includes(supplier.id)}
									onChange={(e) => toggleSupplier(supplier.id, e.target.checked)}
								/>
								<span>{supplier.supplier_name}</span>
							</label>
						))}
					</div>
				</div>
			</div>

			<div className='actions-row'>
				<button type='button' className='primary-button' onClick={save} disabled={saving}>
					{saving ? 'Saving...' : 'Save Lead'}
				</button>
			</div>

			{message ? <p className='feedback'>{message}</p> : null}
		</section>
	);
}
