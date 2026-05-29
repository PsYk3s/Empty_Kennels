import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../storage/db';
import { api } from '../api/index';
import { syncNow } from '../sync/syncManager';
import type { Lead } from '../types/lead';

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
	selectedInterests: string[];
	selectedPpeCategories: string[];
	notes: string;
	selectedSuppliers: number[];
};

const initialForm: LeadForm = {
	firstName: '',
	lastName: '',
	company: '',
	email: '',
	phone: '',
	selectedInterests: [],
	selectedPpeCategories: [],
	notes: '',
	selectedSuppliers: [],
};

const PPE_INTERESTS = [
	'Bulk Pricing',
	'Sample Request',
	'Distributor Account',
	'Stock Availability',
	'Safety Standards Compliance',
	'Tender Support',
	'Private Label',
	'On-Site Product Training',
];

const PPE_CATEGORIES = [
	'Head Protection',
	'Eye and Face Protection',
	'Respiratory Protection',
	'Hearing Protection',
	'Hand Protection',
	'Protective Clothing',
	'High-Visibility Wear',
	'Foot Protection',
	'Fall Protection',
	'Disposable PPE',
];

const SUPPLIER_BRAND_COLORS: Record<string, string> = {
	'3m': '#d62d2d',
	bova: '#22974f',
	bbf: '#2f6fe4',
	dupont: '#d62d2d',
	uvex: '#ffffff',
	rebel: '#f2c230',
	honeywell: '#d62d2d',
	tyvek: '#2f6fe4',
	tychem: '#f08a2b',
	rhino: '#22974f',
	inyathi: '#22974f',
	mbworkwear: '#f08a2b',
	neptun: '#f08a2b',
	lemaitre: '#d62d2d',
	frams: '#d62d2d',
	jonsson: '#d62d2d',
	dot: '#f08a2b',
	pyramex: '#7ec7ff',
	showa: '#9ee18a',
	greenline: '#9ee18a',
	drager: '#2f6fe4',
	ansell: '#7ec7ff',
	watt: '#d62d2d',
};

function supplierKey(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function supplierColor(name: string) {
	return SUPPLIER_BRAND_COLORS[supplierKey(name)] || '#8fa3b8';
}

export function LeadPage() {
	const navigate = useNavigate();
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

	const toggleTag = (key: 'selectedInterests' | 'selectedPpeCategories', value: string) => {
		setForm((prev) => ({
			...prev,
			[key]: prev[key].includes(value)
				? prev[key].filter((item) => item !== value)
				: [...prev[key], value],
		}));
	};

	const toggleSupplier = (supplierId: number, checked: boolean) => {
		setForm((prev) => ({
			...prev,
			selectedSuppliers: checked
				? prev.selectedSuppliers.includes(supplierId)
					? prev.selectedSuppliers
					: [...prev.selectedSuppliers, supplierId]
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

		const interestArea = [
			form.selectedInterests.length
				? `Interests: ${form.selectedInterests.join(', ')}`
				: '',
			form.selectedPpeCategories.length
				? `PPE Categories: ${form.selectedPpeCategories.join(', ')}`
				: '',
		]
			.filter(Boolean)
			.join(' | ');

		const now = new Date().toISOString();
		const lead: Lead = {
			firstName: form.firstName,
			lastName: form.lastName,
			company: form.company,
			email: form.email,
			phone: form.phone,
			notes: form.notes,
			selectedSuppliers: form.selectedSuppliers,
			interestArea,
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
		setMessage('');
		setSaving(false);
		syncNow();
		navigate('/', { state: { saved: true } });
	};

	return (
		<section className='screen'>
			<div className='screen-head'>
				<h2>New Lead</h2>
				<p>Fill in the visitor's details below.</p>
			</div>

			<div className='capture-grid'>
				<p className='form-section-label'>Contact Details</p>
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

				<p className='form-section-label full-width'>PPE Interests</p>

				<div className='full-width tag-cloud-block'>
					<div className='quick-picks' role='group' aria-label='Lead interests'>
						{PPE_INTERESTS.map((item) => (
							<button
								type='button'
								key={item}
								onClick={() => toggleTag('selectedInterests', item)}
								className={form.selectedInterests.includes(item) ? 'active' : ''}
							>
								{item}
							</button>
						))}
					</div>
				</div>

				<p className='form-section-label full-width'>PPE Categories</p>

				<div className='full-width tag-cloud-block'>
					<div className='quick-picks' role='group' aria-label='PPE categories'>
						{PPE_CATEGORIES.map((item) => (
							<button
								type='button'
								key={item}
								onClick={() => toggleTag('selectedPpeCategories', item)}
								className={form.selectedPpeCategories.includes(item) ? 'active' : ''}
							>
								{item}
							</button>
						))}
					</div>
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
					<div className='quick-picks supplier-cloud' role='group' aria-label='Suppliers'>
						{suppliers.map((supplier) => {
							const isSelected = form.selectedSuppliers.includes(supplier.id);
							const color = supplierColor(supplier.supplier_name);
							const style = {
								'--supplier-color': color,
								'--supplier-tint': `${color}22`,
							} as CSSProperties;

							return (
								<button
									type='button'
									key={supplier.id}
									onClick={() => toggleSupplier(supplier.id, !isSelected)}
									className={`supplier-chip${isSelected ? ' active' : ''}`}
									style={style}
								>
									{supplier.supplier_name}
								</button>
							);
						})}
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
