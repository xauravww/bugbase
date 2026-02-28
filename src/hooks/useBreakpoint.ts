import { useState, useEffect } from 'react';

export const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width <= 768) {
        setBreakpoint('mobile');
      } else if (width <= 1024) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    // Initial check
    updateBreakpoint();

    // Add resize listener
    window.addEventListener('resize', updateBreakpoint);

    // Cleanup
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
};