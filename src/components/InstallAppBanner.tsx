import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
const appIcon = "/icons/nikahconnect-192.png";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallAppBanner() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setIsInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setPromptEvent(null);
      setShowInstructions(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) {
      setShowInstructions(true);
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === "accepted") setIsInstalled(true);
  };

  if (isInstalled || isDismissed) return null;

  return (
    <>
      <aside className="install-app-banner" aria-label="Install NikahConnect">
        <img className="install-app-icon" src={appIcon} alt="" />
        <div className="install-app-copy">
          <p className="install-app-title">Get NikahConnect</p>
          <p className="install-app-subtitle">Add it to your home screen for quick access.</p>
        </div>
        <button className="install-app-action" type="button" onClick={install}>
          <Download size={16} aria-hidden="true" />
          <span>Install</span>
        </button>
        <button
          className="install-app-dismiss"
          type="button"
          aria-label="Dismiss install offer"
          onClick={() => setIsDismissed(true)}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </aside>

      {showInstructions && (
        <div className="install-help-backdrop" onClick={() => setShowInstructions(false)}>
          <section
            className="install-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="install-help-close"
              type="button"
              aria-label="Close install instructions"
              onClick={() => setShowInstructions(false)}
            >
              <X size={18} />
            </button>
            <img className="install-help-icon" src={appIcon} alt="" />
            <h2 id="install-help-title">Install NikahConnect</h2>
            {isIOS ? (
              <p>In Safari, tap the Share button, then choose “Add to Home Screen.”</p>
            ) : (
              <p>Open your browser menu and choose “Install app” or “Add to Home Screen” to keep NikahConnect close by.</p>
            )}
            <button className="install-help-done" type="button" onClick={() => setShowInstructions(false)}>
              Got it
            </button>
          </section>
        </div>
      )}
    </>
  );
}
