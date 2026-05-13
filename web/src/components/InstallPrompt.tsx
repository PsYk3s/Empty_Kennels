import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallPrompt() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already running as standalone app
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const isAppleDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isAppleDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setCanInstall(false);
    }
  };

  // If already standalone, don't show anything
  if (isStandalone) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(135deg, #0b1320 0%, #1a2642 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem',
        zIndex: 10000,
        color: 'white',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '500px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>PB App</h1>
        
        <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem', opacity: 0.9 }}>
          Install the app for the best experience
        </p>
        
        <p style={{ fontSize: '0.95rem', marginBottom: '2rem', opacity: 0.75 }}>
          This app works best when installed directly on your device. Get offline lead capture, 
          automatic syncing, and instant updates.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {canInstall && (
            <button
              onClick={handleInstallClick}
              style={{
                background: '#4a9eff',
                color: 'white',
                border: 'none',
                padding: '1rem 1.5rem',
                fontSize: '1.05rem',
                fontWeight: '600',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#3a8ee8';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#4a9eff';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Install App
            </button>
          )}

          {isIOS && (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
              <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
                <strong>iPhone/iPad:</strong> Tap the share button and select "Add to Home Screen"
              </p>
            </div>
          )}

          {!canInstall && !isIOS && (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
              <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
                <strong>Android:</strong> Chrome will prompt you to install when ready, or tap your browser menu
              </p>
            </div>
          )}
        </div>

        <p style={{ marginTop: '2rem', fontSize: '0.85rem', opacity: 0.6 }}>
          Using this in Chrome limits functionality. Install for the full experience.
        </p>
      </div>
    </div>
  );
}
