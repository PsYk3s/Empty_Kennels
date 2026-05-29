import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export function HomePage() {
  const location = useLocation();
  const [showThanks, setShowThanks] = useState(false);
  const thanksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        <img
          src='/icon-512.svg'
          alt='Pienaar Bros logo'
          className='home-logo-image'
        />
      </div>

      <div className='thanks-slot' aria-live='polite'>
        <p className={`home-message${showThanks ? ' is-thanks' : ''}`}>
          {showThanks ? 'Thank you. Lead captured successfully.' : 'Welcome'}
        </p>
      </div>

      <Link to='/lead' className='cta-button'>
        Capture New Lead
      </Link>
    </section>
  );
}
