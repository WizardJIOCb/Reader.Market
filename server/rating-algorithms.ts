// Book Rating Calculation Algorithms
// Based on rating system design discussion

export type RatingAlgorithmType = 
  | 'simple_average'
  | 'bayesian_average'
  | 'weighted_bayesian'
  | 'confidence_weighted';

export interface Review {
  id: string;
  rating: number;
  content: string;
  createdAt: Date;
  likes?: number;
  userId: string;
}

export interface RatingAlgorithmConfig {
  type: RatingAlgorithmType;
  params: {
    // Bayesian parameters
    priorMean?: number;          // μ0 - Average rating across service (default: 7.4)
    priorWeight?: number;        // m - Number of "virtual votes" (default: 30)
    
    // Weight parameters
    likesAlpha?: number;         // α - Likes weight coefficient (default: 0.4)
    likesMaxWeight?: number;     // Max weight from likes (default: 3)
    minTextWeight?: number;      // Min weight for short reviews (default: 0.3)
    
    // Time decay (for "recent" rating)
    timeDecayEnabled?: boolean;  // Enable time decay
    timeDecayHalfLife?: number;  // Half-life in days (default: 180)
  };
}

export const DEFAULT_RATING_CONFIG: RatingAlgorithmConfig = {
  type: 'simple_average',
  params: {
    priorMean: 7.4,
    priorWeight: 30,
    likesAlpha: 0.4,
    likesMaxWeight: 3,
    minTextWeight: 0.3,
    timeDecayEnabled: false,
    timeDecayHalfLife: 180,
  }
};

/**
 * Calculate simple arithmetic average rating
 */
export function calculateSimpleAverage(reviews: Review[]): number | null {
  if (reviews.length === 0) return null;
  
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

/**
 * Calculate Bayesian weighted average
 * Formula: Score = (m · μ0 + Σr_i) / (m + n)
 * Where:
 * - m = prior weight (virtual votes)
 * - μ0 = prior mean (service average)
 * - Σr_i = sum of all ratings
 * - n = number of ratings
 */
export function calculateBayesianAverage(
  reviews: Review[],
  priorMean: number = 7.4,
  priorWeight: number = 30
): number | null {
  if (reviews.length === 0) return null;
  
  const sumRatings = reviews.reduce((acc, r) => acc + r.rating, 0);
  const score = (priorWeight * priorMean + sumRatings) / (priorWeight + reviews.length);
  
  return Math.round(score * 10) / 10;
}

/**
 * Calculate weight based on review likes
 * Formula: w_likes = 1 + α · log(1 + likes)
 * Capped at likesMaxWeight
 */
export function calculateLikesWeight(
  likes: number = 0,
  alpha: number = 0.4,
  maxWeight: number = 3
): number {
  const weight = 1 + alpha * Math.log(1 + likes);
  return Math.min(weight, maxWeight);
}

/**
 * Calculate weight based on text quality (heuristic)
 * Based on review content length and characteristics
 */
export function calculateTextQualityWeight(
  content: string,
  minWeight: number = 0.3
): number {
  const length = content.trim().length;
  
  // Very short reviews get minimum weight
  if (length < 10) return minWeight;
  
  // Short but acceptable reviews
  if (length < 80) return 0.7;
  
  // Normal reviews
  if (length >= 80 && length <= 1500) return 1.0;
  
  // Detailed reviews get slight bonus
  if (length > 1500) return 1.2;
  
  return 1.0;
}

/**
 * Calculate time decay weight for "recent rating"
 * Formula: w_time = e^(-λ · ageDays)
 * Where λ = ln(2) / halfLifeDays
 */
export function calculateTimeDecayWeight(
  createdAt: Date,
  halfLifeDays: number = 180
): number {
  const now = new Date();
  const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const lambda = Math.log(2) / halfLifeDays;
  
  return Math.exp(-lambda * ageDays);
}

/**
 * Calculate weighted Bayesian average with multiple factors
 * Formula: Score = (m · μ0 + Σ(w_i · r_i)) / (m + Σw_i)
 */
export function calculateWeightedBayesian(
  reviews: Review[],
  config: RatingAlgorithmConfig['params']
): number | null {
  if (reviews.length === 0) return null;
  
  const {
    priorMean = 7.4,
    priorWeight = 30,
    likesAlpha = 0.4,
    likesMaxWeight = 3,
    minTextWeight = 0.3,
    timeDecayEnabled = false,
    timeDecayHalfLife = 180,
  } = config;
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const review of reviews) {
    // Calculate individual weight components
    const likesWeight = calculateLikesWeight(review.likes || 0, likesAlpha, likesMaxWeight);
    const textWeight = calculateTextQualityWeight(review.content, minTextWeight);
    const timeWeight = timeDecayEnabled 
      ? calculateTimeDecayWeight(review.createdAt, timeDecayHalfLife)
      : 1.0;
    
    // Combined weight
    const weight = likesWeight * textWeight * timeWeight;
    
    weightedSum += weight * review.rating;
    totalWeight += weight;
  }
  
  // Apply Bayesian formula
  const score = (priorWeight * priorMean + weightedSum) / (priorWeight + totalWeight);
  
  return Math.round(score * 10) / 10;
}

/**
 * Calculate confidence score
 * Shows how reliable the rating is based on number of weighted reviews
 * Returns value between 0 and 1
 */
export function calculateConfidence(
  reviews: Review[],
  config: RatingAlgorithmConfig['params'],
  threshold: number = 50
): number {
  if (reviews.length === 0) return 0;
  
  const {
    likesAlpha = 0.4,
    likesMaxWeight = 3,
    minTextWeight = 0.3,
  } = config;
  
  let totalWeight = 0;
  
  for (const review of reviews) {
    const likesWeight = calculateLikesWeight(review.likes || 0, likesAlpha, likesMaxWeight);
    const textWeight = calculateTextQualityWeight(review.content, minTextWeight);
    totalWeight += likesWeight * textWeight;
  }
  
  return Math.min(totalWeight / threshold, 1);
}

/**
 * Main rating calculation function that routes to the appropriate algorithm
 */
export function calculateRating(
  reviews: Review[],
  config: RatingAlgorithmConfig
): { rating: number | null; confidence: number } {
  let rating: number | null = null;
  
  switch (config.type) {
    case 'simple_average':
      rating = calculateSimpleAverage(reviews);
      break;
      
    case 'bayesian_average':
      rating = calculateBayesianAverage(
        reviews,
        config.params.priorMean,
        config.params.priorWeight
      );
      break;
      
    case 'weighted_bayesian':
      rating = calculateWeightedBayesian(reviews, config.params);
      break;
      
    case 'confidence_weighted':
      // Similar to weighted_bayesian but with additional confidence factors
      rating = calculateWeightedBayesian(reviews, config.params);
      break;
      
    default:
      rating = calculateSimpleAverage(reviews);
  }
  
  const confidence = config.type === 'simple_average' 
    ? Math.min(reviews.length / 10, 1) // Simple confidence based on count
    : calculateConfidence(reviews, config.params);
  
  return { rating, confidence };
}
