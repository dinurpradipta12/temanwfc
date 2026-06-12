import { initialCafes } from '../data';
import { supabase } from '../lib/supabaseClient';
import { Cafe, CafeUpdateInput, RecommendationInput, RecommendationResult, ReviewInput, ReviewUpdateInput } from '../types';

type BackendMode = 'local' | 'apps-script' | 'supabase';

const mode = (import.meta.env.VITE_WFC_BACKEND as BackendMode | undefined) ?? 'supabase';
const apiBaseUrl = import.meta.env.VITE_WFC_API_BASE_URL as string | undefined;
const photoBucket = 'cafe-photos';
const MAX_IMAGE_DIMENSION = 2200;
const THUMBNAIL_DIMENSION = 960;
const IMAGE_QUALITY = 0.9;
const THUMBNAIL_QUALITY = 0.86;

let localStore = initialCafes.map((cafe) => ({
  ...cafe,
  reviews: [...cafe.reviews],
}));

type CafeRow = {
  id: string;
  name: string;
  area: string;
  location: string | null;
  address: string | null;
  vibe: string;
  wifi: string;
  price: string;
  open_hours: string | null;
  tags: string[] | null;
  image: string | null;
  thumbnail_image: string | null;
  photo_urls: string[] | null;
  photo_thumbnail_urls: string[] | null;
};

type ReviewRow = {
  id: string;
  cafe_id: string;
  name: string;
  rating: number;
  comment: string;
  likes_count: number | null;
  photo_url: string | null;
  photo_thumbnail_url: string | null;
  photo_urls: string[] | null;
  photo_thumbnail_urls: string[] | null;
  recommendation_vote: 'like' | 'dislike' | null;
  created_at: string;
};

type UploadImageResult = {
  originalUrl: string;
  thumbnailUrl: string;
};

const cloneCafes = () =>
  localStore.map((cafe) => ({
    ...cafe,
    reviews: [...cafe.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }));

const replaceCafe = (cafeId: string, updater: (cafe: Cafe) => Cafe) => {
  localStore = localStore.map((cafe) => (cafe.id === cafeId ? updater(cafe) : cafe));
};

const removeCafe = (cafeId: string) => {
  localStore = localStore.filter((cafe) => cafe.id !== cafeId);
};

const replaceReview = (reviewId: string, updater: (review: Cafe['reviews'][number]) => Cafe['reviews'][number]) => {
  localStore = localStore.map((cafe) => ({
    ...cafe,
    reviews: cafe.reviews.map((review) => (review.id === reviewId ? updater(review) : review)),
  }));
};

const incrementReviewLikes = (reviewId: string) => {
  localStore = localStore.map((cafe) => ({
    ...cafe,
    reviews: cafe.reviews.map((review) =>
      review.id === reviewId ? { ...review, likesCount: (review.likesCount ?? 0) + 1 } : review,
    ),
  }));
};

const removeReview = (reviewId: string) => {
  localStore = localStore.map((cafe) => ({
    ...cafe,
    reviews: cafe.reviews.filter((review) => review.id !== reviewId),
  }));
};

const buildPhotoPath = (folder: string, file: File) => {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : '';
  const safeName = file.name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return [folder, `${Date.now()}-${crypto.randomUUID()}-${safeName || 'photo'}${extension ? `.${extension}` : ''}`]
    .filter(Boolean)
    .join('/');
};

const resizeImageFile = async (file: File, maxDimension: number, quality: number): Promise<File> => {
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error('Gagal memproses foto'));
        },
        'image/jpeg',
        quality,
      );
    });

    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName || 'photo'}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
};

const createImageVariants = async (file: File) => {
  const original = await resizeImageFile(file, MAX_IMAGE_DIMENSION, IMAGE_QUALITY);
  const thumbnail = await resizeImageFile(file, THUMBNAIL_DIMENSION, THUMBNAIL_QUALITY);

  return { original, thumbnail };
};

const uploadToStorage = async (files: File[], folder: string): Promise<UploadImageResult[]> => {
  if (!files.length) return [];

  const variants = await Promise.all(
    files.map(async (file) => {
      const { original, thumbnail } = await createImageVariants(file);
      return { original, thumbnail };
    }),
  );

  const uploadResults = await Promise.all(
    variants.map(async ({ original, thumbnail }, index) => {
      const originalPath = buildPhotoPath(`${folder}/originals`, original);
      const thumbnailPath = buildPhotoPath(`${folder}/thumbnails`, thumbnail);

      const [originalUpload, thumbnailUpload] = await Promise.all([
        supabase.storage.from(photoBucket).upload(originalPath, original, {
          cacheControl: '3600',
          contentType: original.type || 'application/octet-stream',
          upsert: false,
        }),
        supabase.storage.from(photoBucket).upload(thumbnailPath, thumbnail, {
          cacheControl: '3600',
          contentType: thumbnail.type || 'application/octet-stream',
          upsert: false,
        }),
      ]);

      if (originalUpload.error) {
        throw new Error(`Gagal upload foto utama ${index + 1}: ${originalUpload.error.message}`);
      }

      if (thumbnailUpload.error) {
        throw new Error(`Gagal upload thumbnail ${index + 1}: ${thumbnailUpload.error.message}`);
      }

      const { data: originalData } = supabase.storage.from(photoBucket).getPublicUrl(originalPath);
      const { data: thumbnailData } = supabase.storage.from(photoBucket).getPublicUrl(thumbnailPath);

      return {
        originalUrl: originalData.publicUrl,
        thumbnailUrl: thumbnailData.publicUrl,
      };
    }),
  );

  return uploadResults;
};

export async function uploadCafePhotoFiles(files: File[], folder: string): Promise<UploadImageResult[]> {
  if (mode !== 'supabase') {
    return files.map((file) => {
      const url = URL.createObjectURL(file);
      return { originalUrl: url, thumbnailUrl: url };
    });
  }

  return uploadToStorage(files, folder);
}

const mapCafeRows = (cafes: CafeRow[], reviews: ReviewRow[]) => {
  const reviewsByCafe = new Map<string, ReviewRow[]>();

  reviews.forEach((review) => {
    const cafeReviews = reviewsByCafe.get(review.cafe_id) ?? [];
    cafeReviews.push(review);
    reviewsByCafe.set(review.cafe_id, cafeReviews);
  });

  return cafes.map((cafe) => {
    const cafeReviews = (reviewsByCafe.get(cafe.id) ?? []).sort(
      (left, right) => right.created_at.localeCompare(left.created_at),
    );

    return {
      id: cafe.id,
      name: cafe.name,
      area: cafe.area,
      location: cafe.location ?? cafe.area,
      address: cafe.address ?? undefined,
      vibe: cafe.vibe,
      wifi: cafe.wifi,
      price: cafe.price,
      openHours: cafe.open_hours ?? 'Buka setiap hari',
      tags: cafe.tags ?? [],
      image:
        cafe.image ??
        'https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=1200&q=80',
      thumbnailImage: cafe.thumbnail_image ?? cafe.image ?? undefined,
      photoUrls: cafe.photo_urls ?? [],
      photoThumbnailUrls: cafe.photo_thumbnail_urls ?? [],
      reviews: cafeReviews.map((review) => ({
        id: review.id,
        cafeId: review.cafe_id,
        name: review.name,
        rating: review.rating,
        comment: review.comment,
        likesCount: review.likes_count ?? 0,
        photoUrl: review.photo_url ?? undefined,
        photoThumbnailUrl: review.photo_thumbnail_url ?? undefined,
        photoUrls: review.photo_urls ?? [],
        photoThumbnailUrls: review.photo_thumbnail_urls ?? [],
        recommendationVote: review.recommendation_vote ?? undefined,
        createdAt: review.created_at,
      })),
    } satisfies Cafe;
  });
};

async function fetchSupabaseCafes(): Promise<Cafe[]> {
  const [{ data: cafes, error: cafeError }, { data: reviews, error: reviewError }] = await Promise.all([
    supabase
      .from('cafes')
      .select('id,name,area,location,address,vibe,wifi,price,open_hours,tags,image,thumbnail_image,photo_urls,photo_thumbnail_urls')
      .order('created_at', { ascending: true }),
    supabase
      .from('reviews')
      .select('id,cafe_id,name,rating,comment,likes_count,photo_url,photo_thumbnail_url,photo_urls,photo_thumbnail_urls,recommendation_vote,created_at')
      .order('created_at', { ascending: false }),
  ]);

  if (cafeError) throw new Error(`Gagal memuat cafe: ${cafeError.message}`);
  if (reviewError) throw new Error(`Gagal memuat review: ${reviewError.message}`);

  return mapCafeRows((cafes ?? []) as CafeRow[], (reviews ?? []) as ReviewRow[]);
}

export async function getCafes(): Promise<Cafe[]> {
  if (mode === 'local') return cloneCafes();

  if (mode === 'apps-script') {
    if (!apiBaseUrl) {
      throw new Error('API base URL Apps Script belum diatur');
    }

    const response = await fetch(apiBaseUrl, { method: 'GET' });
    if (!response.ok) {
      throw new Error('Gagal memuat data cafe');
    }

    const payload = (await response.json()) as RecommendationResult | Cafe[];
    return Array.isArray(payload) ? payload : payload.cafes;
  }

  return fetchSupabaseCafes();
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  if (mode === 'local') {
    return username === 'arunika' && password === 'ar4925';
  }

  if (mode === 'apps-script') {
    return username === 'arunika' && password === 'ar4925';
  }

  const { data, error } = await supabase.rpc('verify_admin_login', {
    p_username: username,
    p_password: password,
  });

  if (error) {
    throw new Error(`Gagal memverifikasi admin: ${error.message}`);
  }

  return Boolean(data);
}

export async function addReview(cafeId: string, payload: ReviewInput): Promise<Cafe[]> {
  if (mode === 'local') {
    localStore = localStore.map((cafe) => {
      if (cafe.id !== cafeId) return cafe;

      return {
        ...cafe,
        reviews: [
          {
            id: crypto.randomUUID(),
            cafeId,
            name: payload.name,
            rating: payload.rating,
            comment: payload.comment,
            likesCount: 0,
            photoUrl: payload.photoUrl,
            photoThumbnailUrl: payload.photoThumbnailUrl,
            photoUrls: payload.photoUrls ?? [],
            photoThumbnailUrls: payload.photoThumbnailUrls ?? [],
            createdAt: new Date().toISOString(),
          },
          ...cafe.reviews,
        ],
      };
    });

    return cloneCafes();
  }

  if (mode === 'apps-script') {
    if (!apiBaseUrl) {
      throw new Error('API base URL Apps Script belum diatur');
    }

    const response = await fetch(apiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addReview',
        cafeId,
        review: payload,
      }),
    });

    if (!response.ok) {
      throw new Error('Gagal menyimpan review');
    }

    const result = (await response.json()) as RecommendationResult | Cafe[];
    return Array.isArray(result) ? result : result.cafes;
  }

  const { error } = await supabase.from('reviews').insert({
    cafe_id: cafeId,
    name: payload.name,
    rating: payload.rating,
    comment: payload.comment,
    photo_url: payload.photoUrl || null,
    photo_thumbnail_url: payload.photoThumbnailUrl || null,
    photo_urls: payload.photoUrls ?? [],
    photo_thumbnail_urls: payload.photoThumbnailUrls ?? [],
    likes_count: 0,
    recommendation_vote: null,
  });

  if (error) {
    throw new Error(`Gagal menyimpan review: ${error.message}`);
  }

  return fetchSupabaseCafes();
}

export async function updateCafe(cafeId: string, payload: CafeUpdateInput): Promise<Cafe[]> {
  if (mode === 'local') {
    replaceCafe(cafeId, (cafe) => ({
      ...cafe,
      name: payload.name,
      area: payload.area,
      location: payload.location,
      address: payload.address,
      vibe: payload.vibe,
      wifi: payload.wifi,
      price: payload.price,
      openHours: payload.openHours,
      image: payload.image,
      thumbnailImage: payload.thumbnailImage ?? payload.image,
      tags: payload.tags,
      photoUrls: payload.photoUrls ?? cafe.photoUrls,
      photoThumbnailUrls: payload.photoThumbnailUrls ?? cafe.photoThumbnailUrls,
    }));

    return cloneCafes();
  }

  if (mode === 'apps-script') {
    throw new Error('Edit cafe belum didukung untuk Apps Script mode');
  }

  const { error } = await supabase
    .from('cafes')
    .update({
      name: payload.name,
      area: payload.area,
      location: payload.location,
      address: payload.address,
      vibe: payload.vibe,
      wifi: payload.wifi,
      price: payload.price,
      open_hours: payload.openHours,
      image: payload.image,
      thumbnail_image: payload.thumbnailImage ?? payload.image,
      tags: payload.tags,
      photo_urls: payload.photoUrls ?? [],
      photo_thumbnail_urls: payload.photoThumbnailUrls ?? [],
    })
    .eq('id', cafeId);

  if (error) {
    throw new Error(`Gagal mengubah cafe: ${error.message}`);
  }

  return fetchSupabaseCafes();
}

export async function deleteCafe(cafeId: string): Promise<Cafe[]> {
  if (mode === 'local') {
    removeCafe(cafeId);
    return cloneCafes();
  }

  if (mode === 'apps-script') {
    throw new Error('Hapus cafe belum didukung untuk Apps Script mode');
  }

  const { error } = await supabase.from('cafes').delete().eq('id', cafeId);

  if (error) {
    throw new Error(`Gagal menghapus cafe: ${error.message}`);
  }

  return fetchSupabaseCafes();
}

export async function updateReview(reviewId: string, payload: ReviewUpdateInput): Promise<Cafe[]> {
  if (mode === 'local') {
    replaceReview(reviewId, (review) => ({
      ...review,
      name: payload.name,
      rating: payload.rating,
      comment: payload.comment,
      recommendationVote: payload.recommendationVote ?? review.recommendationVote,
      likesCount: payload.likesCount ?? review.likesCount ?? 0,
      photoUrl: payload.photoUrl ?? review.photoUrl,
      photoThumbnailUrl: payload.photoThumbnailUrl ?? review.photoThumbnailUrl,
      photoUrls: payload.photoUrls ?? review.photoUrls,
      photoThumbnailUrls: payload.photoThumbnailUrls ?? review.photoThumbnailUrls,
    }));

    return cloneCafes();
  }

  if (mode === 'apps-script') {
    throw new Error('Edit review belum didukung untuk Apps Script mode');
  }

  const { error } = await supabase
    .from('reviews')
    .update({
      name: payload.name,
      rating: payload.rating,
      comment: payload.comment,
      recommendation_vote: payload.recommendationVote ?? null,
      likes_count: payload.likesCount ?? 0,
      photo_url: payload.photoUrl ?? null,
      photo_thumbnail_url: payload.photoThumbnailUrl ?? null,
      photo_urls: payload.photoUrls ?? [],
      photo_thumbnail_urls: payload.photoThumbnailUrls ?? [],
    })
    .eq('id', reviewId);

  if (error) {
    throw new Error(`Gagal mengubah review: ${error.message}`);
  }

  return fetchSupabaseCafes();
}

export async function likeReview(reviewId: string): Promise<Cafe[]> {
  if (mode === 'local') {
    incrementReviewLikes(reviewId);
    return cloneCafes();
  }

  if (mode === 'apps-script') {
    if (!apiBaseUrl) {
      throw new Error('API base URL Apps Script belum diatur');
    }

    const response = await fetch(apiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'likeReview',
        reviewId,
      }),
    });

    if (!response.ok) {
      throw new Error('Gagal menyukai review');
    }

    const result = (await response.json()) as RecommendationResult | Cafe[];
    return Array.isArray(result) ? result : result.cafes;
  }

  const { error } = await supabase.rpc('increment_review_like', {
    p_review_id: reviewId,
  });

  if (error) {
    throw new Error(`Gagal menyukai review: ${error.message}`);
  }

  return fetchSupabaseCafes();
}

export async function deleteReview(reviewId: string): Promise<Cafe[]> {
  if (mode === 'local') {
    removeReview(reviewId);
    return cloneCafes();
  }

  if (mode === 'apps-script') {
    throw new Error('Hapus review belum didukung untuk Apps Script mode');
  }

  const { error } = await supabase.from('reviews').delete().eq('id', reviewId);

  if (error) {
    throw new Error(`Gagal menghapus review: ${error.message}`);
  }

  return fetchSupabaseCafes();
}

export async function addRecommendation(payload: RecommendationInput): Promise<Cafe[]> {
  if (mode === 'local') {
    const cafeId = crypto.randomUUID();
    const newCafe: Cafe = {
      id: cafeId,
      name: payload.coffeeShopName,
      area: payload.location,
      location: payload.location,
      address: payload.address,
      vibe: payload.recommendationVote === 'like' ? 'direkomendasikan' : 'perlu dicek',
      wifi: payload.checklist.includes('wifi cepat') ? 'cepat' : 'stabil',
      price: payload.price,
      openHours: payload.openHours || 'Berdasarkan info user',
      tags: [payload.price, ...payload.checklist.slice(0, 3)],
      image:
        payload.photoUrls[0] ??
        'https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=1200&q=80',
      thumbnailImage: payload.photoThumbnailUrls[0] ?? payload.photoUrls[0],
      photoUrls: payload.photoUrls,
      photoThumbnailUrls: payload.photoThumbnailUrls,
      reviews: [
        {
          id: crypto.randomUUID(),
          cafeId,
          name: payload.userName,
          rating: payload.rating,
          comment: payload.review,
          likesCount: 0,
          photoUrl: payload.photoUrls[0],
          photoThumbnailUrl: payload.photoThumbnailUrls[0],
          photoUrls: payload.photoUrls,
          photoThumbnailUrls: payload.photoThumbnailUrls,
          recommendationVote: payload.recommendationVote,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    localStore = [newCafe, ...localStore];
    return cloneCafes();
  }

  if (mode === 'apps-script') {
    if (!apiBaseUrl) {
      throw new Error('API base URL Apps Script belum diatur');
    }

    const response = await fetch(apiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addRecommendation',
        recommendation: payload,
      }),
    });

    if (!response.ok) {
      throw new Error('Gagal menyimpan rekomendasi');
    }

    const result = (await response.json()) as RecommendationResult;
    return result.cafes;
  }

  const { error } = await supabase.rpc('add_recommendation', {
    p_user_name: payload.userName,
    p_coffee_shop_name: payload.coffeeShopName,
    p_location: payload.location,
    p_address: payload.address,
    p_open_hours: payload.openHours,
    p_price: payload.price,
    p_rating: payload.rating,
    p_checklist: payload.checklist,
    p_review: payload.review,
    p_photo_urls: payload.photoUrls,
    p_photo_thumbnail_urls: payload.photoThumbnailUrls,
    p_recommendation_vote: payload.recommendationVote,
  });

  if (error) {
    throw new Error(`Gagal menyimpan rekomendasi: ${error.message}`);
  }

  return fetchSupabaseCafes();
}
