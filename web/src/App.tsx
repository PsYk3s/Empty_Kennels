import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LeadPage } from './pages/LeadPage';
import { SyncPage } from './pages/SyncPage';
import { SettingsPage } from './pages/SettingsPage';
import { InstallPrompt } from './components/InstallPrompt';
import { startSyncLoop } from './sync/syncManager';

const navItems = [
	{ path: '/', label: 'Home', icon: '⌂', exact: true },
	{ path: '/lead', label: 'Capture', icon: '+', exact: false },
	{ path: '/sync', label: 'Leads', icon: '≡', exact: false },
];

export default function App() {
	const [online, setOnline] = useState(navigator.onLine);
	const location = useLocation();

	useEffect(() => {
		const stopSyncLoop = startSyncLoop();

		const onOnline = () => setOnline(true);
		const onOffline = () => setOnline(false);

		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);

		return () => {
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
			stopSyncLoop();
		};
	}, []);

	return (
		<>
			<InstallPrompt />
			<div className='app-shell'>
			<header className='top-bar'>
				<div className='brand-block'>
					<h1>PB App</h1>
				</div>
				<p className={`connection-pill ${online ? 'online' : 'offline'}`}>
					{online ? 'Online' : 'Offline'}
				</p>
			</header>

			<main className='app-content'>
				<div key={location.pathname} className='route-transition'>
					<Routes location={location}>
						<Route path='/' element={<HomePage />} />
						<Route path='/lead' element={<LeadPage />} />
						<Route path='/sync' element={<SyncPage />} />
						<Route path='/settings' element={<SettingsPage />} />
					</Routes>
				</div>
			</main>

			<footer className='app-meta'>
				<span>© 2026 Pienaar Bros</span>
				<NavLink to='/settings' className='app-meta-link'>settings</NavLink>
			</footer>

			<nav className='bottom-nav' aria-label='Primary'>
				{navItems.map((item) => (
					<NavLink
						key={item.path}
						to={item.path}
						end={item.exact}
						className={({ isActive }) => `nav-pill${isActive ? ' active' : ''}`}
					>
						<span className='nav-icon' aria-hidden='true'>{item.icon}</span>
						<span className='nav-label'>{item.label}</span>
					</NavLink>
				))}
			</nav>
		</div>
	</>
	);
}
