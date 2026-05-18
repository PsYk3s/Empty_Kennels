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

      <div className='home-hero'>
        <h2>Lead Capture</h2>
        <p className='home-sub'>Ready for the next visitor.</p>
      </div>

      <Link to='/lead' className='cta-button'>
        Capture New Lead
      </Link>
    </section>
  );
}
