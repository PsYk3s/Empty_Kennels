import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../storage/db';
import { syncNow } from '../sync/syncManager';
import type { Lead } from '../types/lead';

type Supplier = {
	id: number;
	supplier_name: string;
};

const SUPPLIER_OPTIONS: Supplier[] = [
	{ id: 1, supplier_name: '3M' },
	{ id: 2, supplier_name: 'Bova' },
	{ id: 3, supplier_name: 'BBF' },
	{ id: 4, supplier_name: 'DuPont' },
	{ id: 5, supplier_name: 'uvex' },
	{ id: 6, supplier_name: 'Rebel' },
	{ id: 7, supplier_name: 'Honeywell' },
	{ id: 8, supplier_name: 'Tyvek' },
	{ id: 9, supplier_name: 'Tychem' },
	{ id: 10, supplier_name: 'Rhino' },
	{ id: 11, supplier_name: 'Inyathi' },
	{ id: 12, supplier_name: 'MB Workwear' },
	{ id: 13, supplier_name: 'Neptun' },
	{ id: 14, supplier_name: 'Lemaitre' },
	{ id: 15, supplier_name: 'Frams' },
	{ id: 16, supplier_name: 'Jonsson' },
	{ id: 17, supplier_name: 'Dot' },
	{ id: 18, supplier_name: 'Pyramex' },
	{ id: 19, supplier_name: 'Showa' },
	{ id: 20, supplier_name: 'Greenline' },
	{ id: 21, supplier_name: 'Drager' },
	{ id: 22, supplier_name: 'Ansell' },
	{ id: 23, supplier_name: 'Watt' },
];

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
	const [form, setForm] = useState<LeadForm>(initialForm);
	const [message, setMessage] = useState('');
	const [saving, setSaving] = useState(false);

	const selectedCount = useMemo(() => form.selectedSuppliers.length, [form.selectedSuppliers]);
	const selectedInterestsCount = useMemo(() => form.selectedInterests.length, [form.selectedInterests]);
	const selectedCategoriesCount = useMemo(() => form.selectedPpeCategories.length, [form.selectedPpeCategories]);

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
				<h2>Visitor Details</h2>
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

				<p className='form-section-label full-width'>
					PPE Interests
					<span className='section-count'>{selectedInterestsCount} selected</span>
				</p>

				<div className='full-width'>
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

				<p className='form-section-label full-width'>
					PPE Categories
					<span className='section-count'>{selectedCategoriesCount} selected</span>
				</p>

				<div className='full-width'>
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

				<div className='full-width'>
					<p className='form-section-label'>
						Suppliers
						<span className='section-count'>{selectedCount} selected</span>
					</p>
					<div className='quick-picks supplier-cloud' role='group' aria-label='Suppliers'>
						{SUPPLIER_OPTIONS.map((supplier) => {
							const isSelected = form.selectedSuppliers.includes(supplier.id);
							const color = supplierColor(supplier.supplier_name);
							const style = {
								'--supplier-color': color,
								'--supplier-stroke': `${color}66`,
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
