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

  if (!canInstall && !isIOS) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: '1rem',
        transform: 'translateX(-50%)',
        width: 'min(520px, calc(100vw - 1.5rem))',
        background: 'rgba(11, 16, 24, 0.92)',
        border: '1px solid rgba(157, 178, 201, 0.22)',
        borderRadius: '16px',
        padding: '0.95rem 1rem',
        zIndex: 10000,
        color: '#dfe6ef',
        textAlign: 'left',
        backdropFilter: 'blur(14px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Install this app</p>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#9fadc0' }}>
            {isIOS ? 'Use Add to Home Screen.' : 'Install for offline capture and faster access.'}
          </p>
        </div>

        {canInstall && (
          <button
            onClick={handleInstallClick}
            style={{
              background: '#9db2c9',
              color: '#0b1018',
              border: 'none',
              padding: '0.75rem 1rem',
              fontSize: '0.95rem',
              fontWeight: '700',
              borderRadius: '10px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
