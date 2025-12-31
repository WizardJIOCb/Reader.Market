import React from 'react';
import { render, screen } from '@testing-library/react';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  test('renders landing page with all required sections', () => {
    render(<LandingPage />);
    
    // Check for hero section elements
    expect(screen.getByText('AI-Powered Book Reading Experience')).toBeInTheDocument();
    expect(screen.getByText('Enhance your reading journey with intelligent summaries, insights, and personalized recommendations powered by advanced AI technology.')).toBeInTheDocument();
    
    // Check for feature highlights
    expect(screen.getByText('Powerful Features')).toBeInTheDocument();
    expect(screen.getByText('AI-Powered Reading')).toBeInTheDocument();
    expect(screen.getByText('Advanced Book Management')).toBeInTheDocument();
    
    // Check for registration section
    expect(screen.getByText('Ready to Transform Your Reading Experience?')).toBeInTheDocument();
    
    // Check for contact section
    expect(screen.getByText('Get in Touch')).toBeInTheDocument();
    expect(screen.getByText('Have questions or feedback? Reach out to us through any of these channels:')).toBeInTheDocument();
  });
});import React from 'react';
import { render, screen } from '@testing-library/react';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  test('renders landing page with all required sections', () => {
    render(<LandingPage />);
    
    // Check for hero section elements
    expect(screen.getByText('AI-Powered Book Reading Experience')).toBeInTheDocument();
    expect(screen.getByText('Enhance your reading journey with intelligent summaries, insights, and personalized recommendations powered by advanced AI technology.')).toBeInTheDocument();
    
    // Check for feature highlights
    expect(screen.getByText('Powerful Features')).toBeInTheDocument();
    expect(screen.getByText('AI-Powered Reading')).toBeInTheDocument();
    expect(screen.getByText('Advanced Book Management')).toBeInTheDocument();
    
    // Check for registration section
    expect(screen.getByText('Ready to Transform Your Reading Experience?')).toBeInTheDocument();
    
    // Check for contact section
    expect(screen.getByText('Get in Touch')).toBeInTheDocument();
    expect(screen.getByText('Have questions or feedback? Reach out to us through any of these channels:')).toBeInTheDocument();
  });
});