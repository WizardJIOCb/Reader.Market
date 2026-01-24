import { useState, useEffect } from 'react';
import { dataCache, getCachedUserProfile, setCachedUserProfile, getPendingRequest, trackPendingRequest, isUserProfileStale } from '@/lib/dataCache';

interface UserProfile {
  id: string;
  username: string;
  fullName?: string;
  profileRating?: number | null;
  ratingCount?: number;
}

export function useUserProfile(userId: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }

    // Check cache first
    const cachedProfile = getCachedUserProfile(userId);
    if (cachedProfile) {
      setProfile(cachedProfile);
      // Check if cache is stale and refresh in background
      const cachedEntry = dataCache.userProfiles[userId];
      if (cachedEntry && isUserProfileStale(cachedEntry.timestamp)) {
        fetchProfile(false); // Background refresh
      }
      return;
    }

    // Check for pending request
    const pendingRequest = getPendingRequest('users', userId);
    if (pendingRequest) {
      pendingRequest.then(setProfile).catch(() => setError('Failed to fetch user profile'));
      return;
    }

    // Fetch fresh data
    fetchProfile(true);
  }, [userId]);

  const fetchProfile = async (showLoading: boolean = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    
    // Create the actual fetch promise
    const requestPromise = (async () => {
      try {
        const response = await fetch(`/api/users/${userId}`);
        
        if (response.ok) {
          const userData = await response.json();
          const profileData = {
            id: userData.id,
            username: userData.username,
            fullName: userData.fullName,
            profileRating: userData.profileRating,
            ratingCount: userData.ratingCount
          };
          
          setProfile(profileData);
          setCachedUserProfile(userId, profileData);
          return profileData;
        } else {
          throw new Error('Failed to fetch user profile');
        }
      } catch (err) {
        setError('Network error');
        console.error('Error fetching user profile:', err);
        throw err;
      }
    })();
    
    // Track the pending request to prevent duplicates
    trackPendingRequest('users', userId, requestPromise);
    
    try {
      await requestPromise;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  return { profile, loading, error };
}