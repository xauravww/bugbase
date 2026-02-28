import { useState, useEffect } from 'react';

export const useTouchDetection = () => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Check if the device supports touch events
    const checkTouchSupport = () => {
      // Method 1: Check for touch event support
      if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        setIsTouchDevice(true);
        return;
      }

      // Method 2: Check for pointer events with coarse pointer
      if (window.matchMedia('(pointer: coarse)').matches) {
        setIsTouchDevice(true);
        return;
      }

      // Method 3: Check screen size as heuristic
      if (window.screen.width <= 768) {
        setIsTouchDevice(true);
        return;
      }

      setIsTouchDevice(false);
    };

    checkTouchSupport();

    // Also listen to orientation changes as device characteristics may change
    window.addEventListener('orientationchange', checkTouchSupport);

    return () => {
      window.removeEventListener('orientationchange', checkTouchSupport);
    };
  }, []);

  return isTouchDevice;
};