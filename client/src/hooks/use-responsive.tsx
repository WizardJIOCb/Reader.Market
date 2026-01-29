import * as React from "react"

// Responsive breakpoints
const BREAKPOINTS = {
  MOBILE_MENU: 950,      // Show mobile menu
  HIDE_TEXT_ITEMS: 1160, // Hide profile and messages text, keep icons
  FULL_MENU: 1161        // Show full menu with all text
} as const

export function useResponsive() {
  const [windowWidth, setWindowWidth] = React.useState<number | undefined>(undefined)

  React.useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }

    // Set initial width
    handleResize()
    
    // Add event listener
    window.addEventListener("resize", handleResize)
    
    // Cleanup
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Return responsive states based on breakpoints
  return {
    windowWidth,
    showFullMenu: windowWidth !== undefined && windowWidth >= BREAKPOINTS.FULL_MENU,
    hideTextItems: windowWidth !== undefined && windowWidth < BREAKPOINTS.HIDE_TEXT_ITEMS,
    showMobileMenu: windowWidth !== undefined && windowWidth < BREAKPOINTS.MOBILE_MENU,
    breakpoints: BREAKPOINTS
  }
}