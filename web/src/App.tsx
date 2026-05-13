import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LeadPage } from './pages/LeadPage';
import { CataloguesPage } from './pages/CataloguesPage';
import { SyncPage } from './pages/SyncPage';
import { SettingsPage } from './pages/SettingsPage';
import { startSyncLoop } from './sync/syncManager';

const navItems = [
	{ path: '/lead', label: 'Capture' },
	{ path: '/sync', label: 'Queue' },
	{ path: '/settings', label: 'Settings' },
];

export default function App() {
	const [online, setOnline] = useState(navigator.onLine);

	useEffect(() => {
		startSyncLoop();

		const onOnline = () => setOnline(true);
		const onOffline = () => setOnline(false);

		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);

		return () => {
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
		};
	}, []);

	return (
		<div className='app-shell'>
			<header className='top-bar'>
				<div className='brand-block'>
					<p className='eyebrow'>Lead Capture</p>
					<h1>PB App</h1>
				</div>
				<p className={`connection-pill ${online ? 'online' : 'offline'}`}>
					{online ? 'Online' : 'Offline'}
				</p>
			</header>

			<main className='app-content'>
				<Routes>
					<Route path='/' element={<HomePage />} />
					<Route path='/lead' element={<LeadPage />} />
					<Route path='/catalogues' element={<CataloguesPage />} />
					<Route path='/sync' element={<SyncPage />} />
					<Route path='/settings' element={<SettingsPage />} />
				</Routes>
			</main>

			<nav className='bottom-nav' aria-label='Primary'>
				{navItems.map((item) => (
					<NavLink key={item.path} to={item.path} className='nav-pill'>
						{item.label}
					</NavLink>
				))}
			</nav>
		</div>
	);
}
