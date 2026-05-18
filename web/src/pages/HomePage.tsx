import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { db } from '../storage/db';

export function HomePage() {
  const location = useLocation();
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(0);
  const [showThanks, setShowThanks] = useState(false);
  const thanksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void db.leads.allList(1000).then((l) => setTotal(l.length));
    void db.leads.pendingCount().then(setPending);
  }, []);

  useEffect(() => {
    if (location.state?.saved) {
      setShowThanks(true);
      window.history.replaceState({}, '');
      thanksTimer.current = setTimeout(() => setShowThanks(false), 3500);
    }
    return () => {
      if (thanksTimer.current) clearTimeout(thanksTimer.current);
    };
  }, [location.state]);

  return (
    <section className='screen intro-screen'>
      <div className='home-logo-area'>
        {/* Logo image goes here once uploaded */}
        <div className='logo-placeholder'>
          <span className='logo-text'>PB</span>
        </div>
      </div>

      {showThanks ? (
        <div className='thanks-banner' key='thanks'>
          ✓ Lead saved — thank you!
        </div>
      ) : null}

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
        Capture New Lead
      </Link>
    </section>
  );
}
