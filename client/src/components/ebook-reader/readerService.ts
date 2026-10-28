/**
 * Service layer for ebook reader functionality
 * Handles communication between React components and Foliate.js
 */

export interface ReaderLocation {
  currentPage: number;
  totalPages: number;
  progress: number;
  location: string;
}

export interface ReaderSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  margin: number;
  theme: 'light' | 'dark';
  viewMode: 'paginated' | 'scrolled';
}

export interface BookmarkData {
  id: string;
  bookId: number;
  chapterId: number;
  title: string;
  createdAt: Date;
}

export interface TextSelection {
  text: string;
  location: string;
}

export class ReaderService {
  private reader: any = null;
  private container: HTMLElement | null = null;
  private textContentElement: HTMLElement | null = null;
  private settings: ReaderSettings = {
    fontSize: 18,
    fontFamily: 'Georgia, serif',
    lineHeight: 1.6,
    margin: 20,
    theme: 'light',
    viewMode: 'paginated'
  };
  
  // Add event emitter functionality
  private eventListeners: Map<string, Function[]> = new Map();
  
  on(event: string, callback: Function): void {
    console.log(`Adding listener for event: ${event}`);
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
    console.log(`Total listeners for event ${event}:`, this.eventListeners.get(event)?.length);
  }
  
  off(event: string, callback: Function): void {
    console.log(`Removing listener for event: ${event}`);
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
        console.log(`Listener removed for event: ${event}, remaining listeners:`, listeners.length);
      } else {
        console.log(`Listener not found for event: ${event}`);
      }
    } else {
      console.log(`No listeners found for event: ${event}`);
    }
  }
  
  emit(event: string, data?: any): void {
    console.log(`Emitting event: ${event}`, data);
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      console.log(`Found ${listeners.length} listeners for event: ${event}`);
      listeners.forEach((callback, index) => {
        console.log(`Calling listener ${index} for event: ${event}`);
        try {
          callback(data);
        } catch (error) {
          console.error(`Error calling listener ${index} for event: ${event}`, error);
        }
      });
    } else {
      console.log(`No listeners found for event: ${event}`);
    }
  }

  /**
   * Initialize the reader with a book URL and container element
   */
  async initialize(bookUrl: string, container: HTMLElement): Promise<void> {
    try {
      console.log('=== READER SERVICE INITIALIZATION START ===');
      console.log('Book URL:', bookUrl);
      console.log('Initial container element:', container);
      console.log('Initial container dimensions:', container.offsetWidth, 'x', container.offsetHeight);
      
      // Validate container is actually in the DOM
      if (!document.contains(container)) {
        console.warn('Container element is not in the DOM');
        // Try to find the container by ID as a fallback
        const containerById = document.getElementById('reader-container');
        if (containerById) {
          console.log('Found container by ID:', containerById);
          container = containerById;
        } else {
          // Try another approach - query for div with reader-container ID
          const alternativeContainer = document.querySelector('div#reader-container');
          if (alternativeContainer) {
            console.log('Found container by querySelector:', alternativeContainer);
            container = alternativeContainer as HTMLElement;
          } else {
            // Try yet another approach - look for the container in the document body
            const allDivs = document.querySelectorAll('div');
            for (let i = 0; i < allDivs.length; i++) {
              if (allDivs[i].id === 'reader-container') {
                console.log('Found container by iterating through divs:', allDivs[i]);
                container = allDivs[i] as HTMLElement;
                break;
              }
            }
            
            if (!container || !document.contains(container)) {
              // If we still can't find it, create a more descriptive error
              console.error('Container element not found in DOM. Available elements:', document.body.innerHTML.substring(0, 500));
              throw new Error(`Container element is not in the DOM. Book URL: ${bookUrl}, Container ID: reader-container`);
            }
          }
        }
      }
      
      // Double-check that we have a valid container
      if (!container) {
        console.error('Container element is null or undefined');
        throw new Error('Container element is null or undefined');
      }
      
      console.log('Final validated container element:', container);
      console.log('Final container dimensions:', container.offsetWidth, 'x', container.offsetHeight);
      
      // Add a small delay to ensure the container is fully rendered
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check if container is visible
      const containerStyle = window.getComputedStyle(container);
      if (containerStyle.display === 'none') {
        console.warn('Container element is hidden (display: none)');
        container.style.display = 'block';
        console.log('Set container display to block');
      }
      
      if (containerStyle.visibility === 'hidden') {
        console.warn('Container element is hidden (visibility: hidden)');
        container.style.visibility = 'visible';
        console.log('Set container visibility to visible');
      }
      
      // Ensure container has an ID
      if (!container.id) {
        console.log('Container missing ID, setting to reader-container');
        container.id = 'reader-container';
      }
      
      // Ensure container is properly attached to DOM and visible
      console.log('Ensuring container is visible and properly attached');
      if (container.style.display === 'none') {
        console.log('Container was hidden, making visible');
        container.style.display = 'block';
      }
      
      if (container.style.visibility === 'hidden') {
        console.log('Container was invisible, making visible');
        container.style.visibility = 'visible';
      }
      
      // Ensure container has proper positioning
      if (!container.style.position || container.style.position === 'static') {
        console.log('Setting container position to relative');
        container.style.position = 'relative';
      }
      
      // Ensure container has proper dimensions and styles
      console.log('Ensuring container has proper dimensions and styles');
      
      // Additional validation - ensure container has proper styles
      if (container.style.position === 'static' || container.style.position === '') {
        console.log('Setting container position to relative');
        container.style.position = 'relative';
      }
      
      if (!container.style.width || container.style.width === '0px') {
        console.log('Setting container width to 100%');
        container.style.width = '100%';
      }
      
      if (!container.style.height || container.style.height === '0px') {
        console.log('Setting container height to 100%');
        container.style.height = '100%';
      }
      
      // Ensure minimum height
      if (!container.style.minHeight || container.style.minHeight === '0px') {
        console.log('Setting container minimum height to 400px');
        container.style.minHeight = '400px';
      }
      
      // Force a reflow
      container.offsetHeight; // Trigger reflow
      
      // Wait a bit to ensure container is properly rendered
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        console.log('Container has zero dimensions, waiting for layout...');
        // Try multiple times with increasing delays
        for (let i = 0; i < 30; i++) { // Increased attempts
          await new Promise(resolve => setTimeout(resolve, 50 * (i + 1)));
          console.log(`Container dimensions after wait attempt ${i + 1}:`, container.offsetWidth, 'x', container.offsetHeight);
          if (container.offsetWidth > 0 && container.offsetHeight > 0) {
            break;
          }
        }
        
        // Final check
        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
          console.warn('Container still has zero dimensions after waiting');
          // Try to force layout with a different approach
          console.log('Attempting to force layout with explicit sizing');
          container.style.width = '100%';
          container.style.height = '100%';
          container.style.minHeight = '400px';
          container.style.position = 'relative';
          
          // Force reflow
          container.offsetHeight;
          
          // Wait one more time
          await new Promise(resolve => setTimeout(resolve, 100));
          console.log('Container dimensions after forced layout:', container.offsetWidth, 'x', container.offsetHeight);
        }
      }
      
      console.log('Container dimensions after styling:', container.offsetWidth, 'x', container.offsetHeight);
      
      // Check if this is a plain text file or FB2 file
      console.log('Checking file type for plain text handling');
      console.log('Book URL ends with .txt:', bookUrl.endsWith('.txt'));
      console.log('Book URL ends with .fb2:', bookUrl.endsWith('.fb2'));
      console.log('Full book URL:', bookUrl);
      
      // Check for FB2 files specifically
      if (bookUrl.endsWith('.fb2')) {
        console.log('FB2 file detected, using simple text display instead of Foliate.js');
        await this.loadPlainText(bookUrl, container);
        console.log('=== READER SERVICE INITIALIZATION END (FB2) ===');
        return;
      }
      
      // Check for plain text files
      if (bookUrl.endsWith('.txt')) {
        console.log('Plain text file detected, using simple text display instead of Foliate.js');
        await this.loadPlainText(bookUrl, container);
        console.log('=== READER SERVICE INITIALIZATION END (plain text) ===');
        return;
      }
      
      console.log('Non-text file detected, attempting to use Foliate.js');
      
      // Dynamically import Foliate.js to avoid SSR issues
      console.log('Importing Foliate.js module...');
      const foliateModule = await import('foliate-js/reader.js');
      console.log('Foliate module imported successfully:', foliateModule);
      const { Reader } = foliateModule;
      
      this.container = container;
      
      // Clear previous content
      console.log('Clearing container content');
      this.container.innerHTML = '';
      
      // Initialize the reader
      console.log('Creating new Reader instance with container and settings');
      this.reader = new Reader(this.container, this.settings);
      console.log('Reader instance created:', this.reader);
      
      // Attach event listeners before loading the book
      console.log('Setting up event listeners');
      this.setupEventListeners();
      console.log('Event listeners set up');
      
      // Load the book and wait for it to be ready
      console.log('Loading book...');
      await this.loadBook(bookUrl);
      console.log('=== READER SERVICE INITIALIZATION END (Foliate.js) ===');
    } catch (error) {
      console.error('Error initializing reader:', error);
      this.emit('error', error);
      console.log('=== READER SERVICE INITIALIZATION FAILED ===');
      throw new Error(`Failed to initialize reader: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Navigate to a specific location in the book
   */
  navigateTo(location: string): void {
    if (this.reader) {
      this.reader.goTo(location);
    }
  }
  
  /**
   * Set up event listeners for Foliate.js events
   */
  private setupEventListeners(): void {
    if (!this.reader) return;
    
    console.log('Setting up event listeners for reader:', this.reader);
    console.log('Reader prototype:', Object.getPrototypeOf(this.reader));
    console.log('Reader methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.reader)));
    
    // Listen for when the book is ready
    if (this.reader.on) {
      console.log('Using .on() method for bookready event');
      this.reader.on('bookready', () => {
        console.log('Book ready event triggered');
        this.emit('ready');
      });
    } else if (this.reader.addEventListener) {
      console.log('Using .addEventListener() method for bookready event');
      this.reader.addEventListener('bookready', () => {
        console.log('Book ready event triggered');
        this.emit('ready');
      });
    } else {
      console.warn('Reader does not have on() or addEventListener() method');
    }
    
    // Listen for location changes
    if (this.reader.on) {
      console.log('Using .on() method for relocate event');
      this.reader.on('relocate', (location: any) => {
        console.log('Relocate event triggered:', location);
        this.emit('relocate', location);
      });
    } else if (this.reader.addEventListener) {
      console.log('Using .addEventListener() method for relocate event');
      this.reader.addEventListener('relocate', (event: any) => {
        console.log('Relocate event triggered:', event.detail);
        this.emit('relocate', event.detail);
      });
    }
    
    // Listen for errors
    if (this.reader.on) {
      console.log('Using .on() method for error event');
      this.reader.on('error', (error: any) => {
        console.log('Error event triggered:', error);
        this.emit('error', error);
      });
    } else if (this.reader.addEventListener) {
      console.log('Using .addEventListener() method for error event');
      this.reader.addEventListener('error', (event: any) => {
        console.log('Error event triggered:', event.detail);
        this.emit('error', event.detail);
      });
    }
  }
  
  /**
   * Load book with proper promise handling
   */
  private loadBook(bookUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.reader) {
        reject(new Error('Reader not initialized'));
        return;
      }
      
      // Validate container is still available
      if (!this.container || !document.contains(this.container)) {
        console.warn('Container is no longer available in the DOM');
        reject(new Error('Container is no longer available'));
        return;
      }
      
      console.log('Attempting to load book from URL:', bookUrl);
      
      // Check if the book URL is accessible
      console.log('Checking if book URL is accessible:', bookUrl);
      fetch(bookUrl)
        .then(response => {
          console.log('Book URL fetch response:', response.status, response.statusText);
          if (!response.ok) {
            console.warn('Book URL is not accessible:', response.status, response.statusText);
          } else {
            console.log('Book URL is accessible, content type:', response.headers.get('content-type'));
          }
        })
        .catch(error => {
          console.warn('Error fetching book URL:', error);
        });
      
      // Set up temporary listeners for initial load
      const onReady = () => {
        console.log('Book ready event received');
        if (this.reader.off) {
          this.reader.off('bookready', onReady);
          this.reader.off('error', onError);
        } else if (this.reader.removeEventListener) {
          this.reader.removeEventListener('bookready', onReady);
          this.reader.removeEventListener('error', onError);
        }
        resolve();
      };
      
      const onError = (error: any) => {
        console.error('Book loading error:', error);
        if (this.reader.off) {
          this.reader.off('bookready', onReady);
          this.reader.off('error', onError);
        } else if (this.reader.removeEventListener) {
          this.reader.removeEventListener('bookready', onReady);
          this.reader.removeEventListener('error', onError);
        }
        this.emit('error', error);
        reject(error);
      };
      
      if (this.reader.on) {
        this.reader.on('bookready', onReady);
        this.reader.on('error', onError);
      } else if (this.reader.addEventListener) {
        this.reader.addEventListener('bookready', onReady);
        this.reader.addEventListener('error', onError);
      }
      
      // Add a timeout to prevent indefinite waiting
      const timeout = setTimeout(() => {
        console.warn('Book loading timeout after 30 seconds');
        if (this.reader.off) {
          this.reader.off('bookready', onReady);
          this.reader.off('error', onError);
        } else if (this.reader.removeEventListener) {
          this.reader.removeEventListener('bookready', onReady);
          this.reader.removeEventListener('error', onError);
        }
        this.emit('error', new Error('Book loading timed out'));
        reject(new Error('Book loading timed out'));
      }, 30000); // 30 second timeout
      
      // Modify resolve and reject to clear the timeout
      const originalResolve = resolve;
      const originalReject = reject;
      
      const resolveWithCleanup = (value?: void | PromiseLike<void>) => {
        clearTimeout(timeout);
        originalResolve(value);
      };
      
      const rejectWithCleanup = (reason?: any) => {
        clearTimeout(timeout);
        originalReject(reason);
      };
      
      // Override the callbacks with cleanup versions
      const onReadyWithCleanup = () => {
        console.log('Book ready event received');
        // Validate container is still available
        if (!this.container || !document.contains(this.container)) {
          console.warn('Container is no longer available when book ready event fired');
          rejectWithCleanup(new Error('Container is no longer available'));
          return;
        }
        
        if (this.reader.off) {
          this.reader.off('bookready', onReadyWithCleanup);
          this.reader.off('error', onError);
        } else if (this.reader.removeEventListener) {
          this.reader.removeEventListener('bookready', onReadyWithCleanup);
          this.reader.removeEventListener('error', onError);
        }
        resolveWithCleanup();
      };
      
      const onErrorWithCleanup = (error: any) => {
        console.error('Book loading error:', error);
        if (this.reader.off) {
          this.reader.off('bookready', onReadyWithCleanup);
          this.reader.off('error', onErrorWithCleanup);
        } else if (this.reader.removeEventListener) {
          this.reader.removeEventListener('bookready', onReadyWithCleanup);
          this.reader.removeEventListener('error', onErrorWithCleanup);
        }
        this.emit('error', error);
        rejectWithCleanup(error);
      };
      
      // Reattach the listeners with cleanup versions
      if (this.reader.off) {
        this.reader.off('bookready', onReady);
        this.reader.off('error', onError);
      } else if (this.reader.removeEventListener) {
        this.reader.removeEventListener('bookready', onReady);
        this.reader.removeEventListener('error', onError);
      }
      if (this.reader.on) {
        this.reader.on('bookready', onReadyWithCleanup);
        this.reader.on('error', onErrorWithCleanup);
      } else if (this.reader.addEventListener) {
        this.reader.addEventListener('bookready', onReadyWithCleanup);
        this.reader.addEventListener('error', onErrorWithCleanup);
      }
      
      // Start loading the book
      try {
        console.log('Calling reader.load with URL:', bookUrl);
        const loadPromise = this.reader.load(bookUrl);
        console.log('Load method called, returned:', loadPromise);
        
        // Check if the returned value is a promise
        if (loadPromise) {
          if (typeof loadPromise.catch === 'function') {
            console.log('Attaching catch handler to load promise');
            loadPromise.catch(onErrorWithCleanup);
          } else {
            console.log('Load method did not return a promise with catch method');
          }
          
          // Also check if it has a then method
          if (typeof loadPromise.then === 'function') {
            console.log('Load method returned a promise with then method');
            loadPromise.then(
              () => {
                console.log('Load promise resolved');
                // Validate container is still available
                if (!this.container || !document.contains(this.container)) {
                  console.warn('Container is no longer available after load promise resolved');
                  rejectWithCleanup(new Error('Container is no longer available'));
                  return;
                }
                // As a fallback, if the bookready event doesn't fire, we'll resolve after a short delay
                setTimeout(() => {
                  console.log('Resolving after load promise resolved (fallback)');
                  resolveWithCleanup();
                }, 100);
              },
              (error) => {
                console.error('Load promise rejected:', error);
                onErrorWithCleanup(error);
              }
            );
          }
        } else {
          console.warn('Load method returned null or undefined');
          // If load method returns nothing, resolve after a short delay as a fallback
          setTimeout(() => {
            console.log('Resolving after load method returned nothing (fallback)');
            resolveWithCleanup();
          }, 100);
        }
      } catch (loadError) {
        console.error('Error calling load method:', loadError);
        onErrorWithCleanup(loadError);
      }
    });
  }
  
  /**
   * Navigate to next page
   */
  next(): void {
    if (this.reader) {
      this.reader.next();
    } else if (this.textContentElement) {
      // For plain text files, scroll down
      const scrollAmount = this.textContentElement.clientHeight * 0.8;
      this.textContentElement.scrollBy({
        top: scrollAmount,
        behavior: 'smooth'
      });
    }
  }
  
  /**
   * Navigate to previous page
   */
  prev(): void {
    if (this.reader) {
      this.reader.prev();
    } else if (this.textContentElement) {
      // For plain text files, scroll up
      const scrollAmount = this.textContentElement.clientHeight * 0.8;
      this.textContentElement.scrollBy({
        top: -scrollAmount,
        behavior: 'smooth'
      });
    }
  }
  
  /**
   * Load plain text file and display it in the container
   */
  private async loadPlainText(bookUrl: string, container: HTMLElement): Promise<void> {
    try {
      console.log('=== LOAD PLAIN TEXT START ===');
      console.log('Loading plain text/FB2 file:', bookUrl);
      console.log('Container for text display:', container);
      console.log('Container dimensions:', container.offsetWidth, 'x', container.offsetHeight);
        
      // Validate inputs
      if (!bookUrl) {
        throw new Error('Book URL is required');
      }
        
      if (!container) {
        throw new Error('Container element is required');
      }
      
      // Ensure container has proper dimensions
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        console.log('Container has zero dimensions, setting explicit size');
        // Set explicit dimensions if container has no size
        if (container.style.width === '' || container.style.width === '0px') {
          container.style.width = '100%';
        }
        if (container.style.height === '' || container.style.height === '0px') {
          container.style.height = '100%';
        }
        console.log('Container dimensions after setting explicit size:', container.offsetWidth, 'x', container.offsetHeight);
      }
        
      // Fetch the text content
      console.log('Fetching text content...');
      const response = await fetch(bookUrl);
      console.log('Fetch response status:', response.status, response.statusText);
        
      if (!response.ok) {
        throw new Error(`Failed to fetch text file: ${response.status} ${response.statusText}`);
      }
        
      console.log('Reading response text...');
      const textContent = await response.text();
      console.log('Text content loaded, length:', textContent.length);
        
      // Process content based on file type
      let processedContent = textContent;
        
      // For FB2 files, we could add basic XML processing here if needed
      if (bookUrl.endsWith('.fb2')) {
        console.log('Processing FB2 file');
        // For now, we'll just display the raw content
        // In a more advanced implementation, we could parse the FB2 XML structure
        // Add some basic FB2 processing
        if (textContent.includes('<?xml') && textContent.includes('<FictionBook')) {
          console.log('FB2 file detected with XML header');
          // Extract body content if possible
          const bodyStart = textContent.indexOf('<body>');
          const bodyEnd = textContent.lastIndexOf('</body>');
          if (bodyStart !== -1 && bodyEnd !== -1) {
            const bodyContent = textContent.substring(bodyStart + 6, bodyEnd);
            // Basic cleaning of FB2 tags for better readability
            processedContent = bodyContent
              .replace(/<[^>]+>/g, '')  // Remove all XML tags
              .replace(/\s+/g, ' ')     // Normalize whitespace
              .trim();
            console.log('Extracted and cleaned FB2 body content');
          } else {
            // If we can't extract body, try to clean the whole content
            processedContent = textContent
              .replace(/<[^>]+>/g, ' ')  // Replace all XML tags with spaces
              .replace(/\s+/g, ' ')      // Normalize whitespace
              .trim();
          }
          
          // Try to extract title if available
          const titleMatch = textContent.match(/<book-title[^>]*>(.*?)<\/book-title>/);
          if (titleMatch && titleMatch[1]) {
            console.log('FB2 title extracted:', titleMatch[1]);
            // Prepend title to content for better presentation
            processedContent = `# ${titleMatch[1]}\n\n${processedContent}`;
          }
        }
      }
        
      // Create a simple HTML display for the text
      console.log('Creating HTML display...');
      const htmlContent = `
        <div id="text-content" style="
          padding: 20px;
          font-family: Georgia, serif;
          font-size: 18px;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          text-align: left;
          white-space: pre-wrap;
          height: 100%;
          overflow-y: auto;
          box-sizing: border-box;
        ">
          ${processedContent}
        </div>
      `;
      console.log('HTML content length:', htmlContent.length);
      container.innerHTML = htmlContent;
        
      // Store reference to the text content element for navigation
      console.log('Finding text content element...');
      this.textContentElement = container.querySelector('#text-content');
      console.log('Text content element found:', this.textContentElement);
        
      // Use requestAnimationFrame to ensure DOM is updated before emitting ready event
      console.log('Waiting for DOM update before emitting ready event...');
      await new Promise(resolve => requestAnimationFrame(resolve));
        
      // Emit ready event to indicate loading is complete
      console.log('Emitting ready event...');
      this.emit('ready');
      console.log('Ready event emitted');
        
      // Also log when the event listeners are notified
      console.log('Current event listeners for ready event:', this.eventListeners.get('ready')?.length || 0);
      console.log('=== LOAD PLAIN TEXT END ===');
      console.log('Plain text/FB2 file loaded and displayed');
    } catch (error) {
      console.error('Error loading plain text/FB2 file:', error);
      this.emit('error', error);
      console.log('=== LOAD PLAIN TEXT FAILED ===');
      throw error;
    }
  }

  /**
   * Get current reading location
   */
  getCurrentLocation(): ReaderLocation | null {
    if (this.reader) {
      const location = this.reader.getLocation?.();
      const currentPage = this.reader.getCurrentPage?.() || 1;
      const totalPages = this.reader.getTotalPages?.() || 0;
      const progress = this.reader.getProgress?.() || 0;
      
      return {
        currentPage,
        totalPages,
        progress,
        location: location || ''
      };
    }
    return null;
  }

  /**
   * Get reading progress as a percentage
   */
  getProgress(): number {
    if (this.reader) {
      return this.reader.getProgress?.() || 0;
    }
    return 0;
  }

  /**
   * Update reader settings
   */
  updateSettings(newSettings: Partial<ReaderSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    if (this.reader) {
      Object.keys(newSettings).forEach(key => {
        const value = newSettings[key as keyof ReaderSettings];
        if (value !== undefined) {
          this.reader.setSetting?.(key, value);
        }
      });
    }
  }

  /**
   * Set font size
   */
  setFontSize(size: number): void {
    this.updateSettings({ fontSize: size });
    
    // Also update font size for plain text display
    if (this.textContentElement) {
      this.textContentElement.style.fontSize = `${size}px`;
    }
  }

  /**
   * Add a bookmark at the current location
   */
  addBookmark(data: Omit<BookmarkData, 'id' | 'createdAt'>): BookmarkData {
    const location = this.getCurrentLocation();
    const bookmark: BookmarkData = {
      ...data,
      id: Date.now().toString(),
      createdAt: new Date()
    };
    
    // In a real implementation, this would be saved to a database
    // For now, we'll just return the bookmark object
    console.log('Bookmark added at location:', location, bookmark);
    
    return bookmark;
  }

  /**
   * Remove a bookmark by ID
   */
  removeBookmark(id: string): void {
    // In a real implementation, this would remove from a database
    console.log('Bookmark removed:', id);
  }

  /**
   * Get all bookmarks for a book
   */
  getBookmarks(bookId: number): BookmarkData[] {
    // In a real implementation, this would fetch from a database
    // For now, return an empty array
    return [];
  }

  /**
   * Search for text in the book
   */
  search(text: string): Promise<Array<{ text: string; location: string }>> {
    return new Promise((resolve) => {
      if (this.reader && this.reader.search) {
        this.reader.search(text).then((results: any) => {
          resolve(results || []);
        }).catch(() => {
          resolve([]);
        });
      } else {
        resolve([]);
      }
    });
  }

  /**
   * Destroy the reader instance to free resources
   */
  destroy(): void {
    if (this.reader) {
      this.reader.destroy?.();
      this.reader = null;
    }
    
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    
    this.textContentElement = null;
  }
}

// Export a singleton instance for convenience
export const readerService = new ReaderService();