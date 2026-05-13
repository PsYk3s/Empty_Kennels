import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../storage/db';

export function HomePage() {
	const [pending, setPending] = useState(0);

	useEffect(() => {
		db.leads.pendingCount().then(setPending);
	}, []);

	return (
		<section className='screen intro-screen'>
			<h2>Ready to capture leads</h2>
			<p>
				Use the form to capture visitor details in seconds. Entries save instantly,
				even when offline.
			</p>

			<Link to='/lead' className='cta-button'>
				Start New Lead
			</Link>

			<p className='supporting-text'>
				{pending} lead{pending === 1 ? '' : 's'} waiting to sync.
			</p>
		</section>
	);
}
