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

  // Blocks the in-browser site entirely; only installing the app grants access.
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(135deg, #0b1018 0%, #16202f 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem',
        zIndex: 10000,
        color: '#dfe6ef',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '480px' }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>Install Required</h1>

        <p style={{ fontSize: '1rem', marginBottom: '0.5rem', opacity: 0.9 }}>
          This app is only available as an installed app.
        </p>

        <p style={{ fontSize: '0.9rem', marginBottom: '2rem', opacity: 0.7 }}>
          Install it on your device to get offline lead capture, automatic syncing, and full access.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {canInstall && (
            <button
              onClick={handleInstallClick}
              style={{
                background: '#9db2c9',
                color: '#0b1018',
                border: 'none',
                padding: '1rem 1.5rem',
                fontSize: '1.05rem',
                fontWeight: '700',
                borderRadius: '12px',
                cursor: 'pointer',
              }}
            >
              Install App
            </button>
          )}

          {isIOS && (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.08)', borderRadius: '10px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                <strong>iPhone/iPad:</strong> Tap the Share button, then "Add to Home Screen".
              </p>
            </div>
          )}

          {!canInstall && !isIOS && (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.08)', borderRadius: '10px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                <strong>Chrome/Edge:</strong> use the browser menu and select "Install app".
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
