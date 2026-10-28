import { ReaderService } from './readerService';

describe('ReaderService', () => {
  let readerService: ReaderService;

  beforeEach(() => {
    readerService = new ReaderService();
  });

  afterEach(() => {
    // Clean up any mock
    jest.clearAllMocks();
  });

  it('should add and remove event listeners correctly', () => {
    const mockCallback = jest.fn();
    
    // Add event listener
    readerService.on('testEvent', mockCallback);
    
    // Emit event
    readerService.emit('testEvent', 'testData');
    
    // Verify callback was called
    expect(mockCallback).toHaveBeenCalledWith('testData');
    
    // Remove event listener
    readerService.off('testEvent', mockCallback);
    
    // Emit event again
    readerService.emit('testEvent', 'moreData');
    
    // Verify callback was not called again
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple listeners for the same event', () => {
    const mockCallback1 = jest.fn();
    const mockCallback2 = jest.fn();
    
    // Add multiple event listeners
    readerService.on('multiEvent', mockCallback1);
    readerService.on('multiEvent', mockCallback2);
    
    // Emit event
    readerService.emit('multiEvent', 'multiData');
    
    // Verify both callbacks were called
    expect(mockCallback1).toHaveBeenCalledWith('multiData');
    expect(mockCallback2).toHaveBeenCalledWith('multiData');
  });

  it('should handle events with no listeners gracefully', () => {
    // Emit event with no listeners
    expect(() => {
      readerService.emit('noListenerEvent', 'noData');
    }).not.toThrow();
  });
});