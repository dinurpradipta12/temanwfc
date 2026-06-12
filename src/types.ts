export type CafeReview = {
  id: string;
  cafeId: string;
  name: string;
  rating: number;
  comment: string;
  photoUrl?: string;
  photoThumbnailUrl?: string;
  photoUrls?: string[];
  photoThumbnailUrls?: string[];
  recommendationVote?: 'like' | 'dislike';
  likesCount?: number;
  createdAt: string;
};

export type Cafe = {
  id: string;
  name: string;
  area: string;
  location?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  vibe: string;
  wifi: string;
  price: string;
  openHours: string;
  tags: string[];
  image: string;
  thumbnailImage?: string;
  photoUrls?: string[];
  photoThumbnailUrls?: string[];
  reviews: CafeReview[];
};

export type ReviewInput = {
  name: string;
  rating: number;
  comment: string;
  photoUrl?: string;
  photoThumbnailUrl?: string;
  photoUrls?: string[];
  photoThumbnailUrls?: string[];
};

export type RecommendationVote = 'like' | 'dislike';

export type RecommendationInput = {
  userName: string;
  coffeeShopName: string;
  location: string;
  address: string;
  latitude?: number;
  longitude?: number;
  openHours: string;
  price: string;
  rating: number;
  checklist: string[];
  review: string;
  photoUrls: string[];
  photoThumbnailUrls: string[];
  recommendationVote: RecommendationVote;
};

export type CafeUpdateInput = {
  name: string;
  area: string;
  location: string;
  address: string;
  latitude?: number;
  longitude?: number;
  vibe: string;
  wifi: string;
  price: string;
  openHours: string;
  image: string;
  thumbnailImage?: string;
  tags: string[];
  photoUrls?: string[];
  photoThumbnailUrls?: string[];
};

export type ReviewUpdateInput = {
  name: string;
  rating: number;
  comment: string;
  recommendationVote?: RecommendationVote;
  likesCount?: number;
  photoUrl?: string;
  photoThumbnailUrl?: string;
  photoUrls?: string[];
  photoThumbnailUrls?: string[];
};

export type RecommendationResult = {
  cafes: Cafe[];
};
