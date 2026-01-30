/**
 * Utility function to scroll to an anchor element with proper offset
 * @param anchorId - The ID of the element to scroll to (without #)
 * @param offset - Offset in pixels (default: 80px for navbar height)
 */
export const scrollToAnchor = (anchorId: string, offset: number = 80) => {
  const element = document.getElementById(anchorId);
  if (element) {
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
    
    // Update URL hash without triggering page reload
    if (window.history.pushState) {
      window.history.pushState(null, '', `#${anchorId}`);
    }
  }
};

/**
 * Check if current URL has a hash and scroll to it
 */
export const handleInitialHashScroll = () => {
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    // Wait for content to load before scrolling
    setTimeout(() => {
      scrollToAnchor(hash);
    }, 500);
  }
};