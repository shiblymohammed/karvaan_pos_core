import { useState, useEffect } from 'react';

export const useKeyboardOpen = () => {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // We only care about this on mobile devices, but doing it globally is fine
    // as it will hide the mobile nav when inputs are focused on any screen size 
    // (though the nav is hidden on desktop anyway).
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target && 
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') &&
        target.getAttribute('type') !== 'checkbox' &&
        target.getAttribute('type') !== 'radio' &&
        target.getAttribute('type') !== 'button'
      ) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      setIsKeyboardOpen(false);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return isKeyboardOpen;
};
