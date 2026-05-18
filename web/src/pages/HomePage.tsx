import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../storage/db';

export function HomePage() {
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    void db.leads.allList(1000).then((l) => setTotal(l.length));
    void db.leads.pendingCount().then(setPending);
  }, []);

  return (
    <section className='screen intro-screen'>
      <div className='home-hero'>
        <p className='eyebrow'>Trade Show</p>
        <h2>Lead Capture</h2>
        <p className='home-sub'>Collect, sync and manage contacts — even offline.</p>
      </div>

      <div className='home-stats'>
        <div className='stat-card'>
          <span className='stat-value'>{total}</span>
          <span className='stat-label'>Total Leads</span>
        </div>
        <div className={`stat-card${pending > 0 ? ' stat-card--alert' : ''}`}>
          <span className='stat-value'>{pending}</span>
          <span className='stat-label'>Pending Sync</span>
        </div>
      </div>

      <Link to='/lead' className='cta-button'>
        New Lead
      </Link>
    </section>
  );
}
