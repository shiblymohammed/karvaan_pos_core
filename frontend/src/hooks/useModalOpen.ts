import { useState, useEffect } from 'react';

export const useModalOpen = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // We check if any element with a high z-index and fixed positioning exists in the DOM.
    // This typically indicates a modal or overlay is open.
    const checkModals = () => {
      // Look for common modal backdrop classes used in this project
      // Modals usually have fixed, inset-0 (full screen) and high z-index
      const modals = document.querySelectorAll('.fixed.inset-0.z-\\[100\\], .fixed.inset-0.z-50, .fixed.inset-0.z-\\[70\\]');
      
      setIsModalOpen(modals.length > 0);
    };

    // Initial check
    checkModals();

    // Set up a mutation observer to watch for modals being added/removed
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0 || mutation.attributeName === 'class') {
          shouldCheck = true;
          break;
        }
      }
      if (shouldCheck) {
        checkModals();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
    };
  }, []);

  return isModalOpen;
};
