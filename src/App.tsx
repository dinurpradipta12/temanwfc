import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  addRecommendation,
  addReview,
  deleteCafe,
  deleteReview,
  getCafes,
  likeReview,
  updateCafe,
  updateReview,
  uploadCafePhotoFiles,
  verifyAdminCredentials,
} from './services/cafeApi';
import { Cafe, CafeReview, RecommendationVote } from './types';
import LocationPickerMap from './components/LocationPickerMap';
import logoGreen from './logo-green.png';

const ratingLabel = (rating: number) => {
  if (rating >= 4.7) return 'Paling direkomendasikan';
  if (rating >= 4.3) return 'Sangat direkomendasikan';
  if (rating >= 4) return 'Direkomendasikan';
  return 'Layak dicoba';
};

const recommendationBadge = (vote?: RecommendationVote) => {
  if (vote === 'dislike') {
    return { label: 'Tidak direkomendasikan', icon: 'thumb-down' as const };
  }

  return { label: 'Direkomendasikan', icon: 'thumb-up' as const };
};

const topRankBadge = (rank: number) => {
  if (rank === 1) return { label: 'Top 1 mingguan', tone: 'gold' as const };
  if (rank === 2) return { label: 'Top 2 mingguan', tone: 'silver' as const };
  return { label: 'Top 3 mingguan', tone: 'bronze' as const };
};

const formatRelativeTime = (value: string, now = Date.now()) => {
  const date = new Date(value);
  const diffMs = now - date.getTime();
  const diffDays = Math.max(0, Math.round(diffMs / 86400000));

  if (diffDays < 1) {
    const timeLabel = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
      .format(date)
      .toLowerCase();

    return `Hari ini - ${timeLabel}`;
  }

  if (diffDays < 30) return `${diffDays} hari lalu`;

  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} bulan lalu`;

  const diffYears = Math.round(diffMonths / 12);
  return `${diffYears} tahun lalu`;
};

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const recommendationChecklist = [
  'wifi cepat',
  'banyak colokan',
  'suasana nyaman',
  'meja luas',
  'kursi nyaman',
  'pencahayaan bagus',
  'ruangan sejuk',
  'toilet bersih',
  'parkir mudah',
  'menu kopi enak',
  'menu non-kopi',
  'harga terjangkau',
  'cocok untuk meeting',
  'tidak terlalu bising',
  'ramah untuk kerja lama',
];

const initialRecommendationForm = {
  userName: '',
  coffeeShopName: '',
  location: '',
  address: '',
  latitude: undefined as number | undefined,
  longitude: undefined as number | undefined,
  openHours: '',
  price: 'Terjangkau',
  rating: 5,
  checklist: [] as string[],
  review: '',
  recommendationVote: 'like' as RecommendationVote,
};

const initialReviewForm = {
  name: '',
  rating: 5,
  comment: '',
};

type AdminCafeFormState = {
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
  recommendationVote: RecommendationVote;
  existingPhotoUrls: string[];
  existingPhotoThumbnailUrls: string[];
};

type AdminReviewFormState = {
  name: string;
  rating: number;
  comment: string;
  recommendationVote: RecommendationVote;
};

type AdminEditorState =
  | { type: 'cafe'; cafeId: string }
  | { type: 'review'; cafeId: string; reviewId: string }
  | null;

type DeleteConfirmState =
  | { type: 'cafe'; cafeId: string }
  | { type: 'review'; cafeId: string; reviewId: string }
  | null;

const initialAdminCafeForm = (): AdminCafeFormState => ({
  userName: '',
  coffeeShopName: '',
  location: '',
  address: '',
  latitude: undefined,
  longitude: undefined,
  openHours: '',
  price: 'Terjangkau',
  rating: 5,
  checklist: [],
  review: '',
  recommendationVote: 'like',
  existingPhotoUrls: [],
  existingPhotoThumbnailUrls: [],
});

const initialAdminReviewForm = (): AdminReviewFormState => ({
  name: '',
  rating: 5,
  comment: '',
  recommendationVote: 'like',
});

type PhotoUpload = {
  file: File;
  previewUrl: string;
};

type ManagedCafePhoto = {
  id: string;
  source: 'existing' | 'new';
  file?: File;
  originalUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
};

const PAGE_STATE_KEY = 'teman-wfc-page-state';
const ADMIN_STATE_KEY = 'teman-wfc-admin-state';
const DELETED_STATE_KEY = 'teman-wfc-deleted-state';
const ONBOARDING_STATE_KEY = 'teman-wfc-onboarding-state';

const sortReviewsByPopularity = (reviews: CafeReview[]) =>
  [...reviews].sort((left, right) => {
    const likeDifference = (right.likesCount ?? 0) - (left.likesCount ?? 0);
    if (likeDifference !== 0) return likeDifference;

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

const buildMapsUrl = (latitude?: number, longitude?: number, label?: string) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return '';
  const query = `${latitude},${longitude}`;
  const suffix = label ? ` (${label})` : '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query + suffix)}`;
};

const readPersistedOnboardingState = () => {
  if (typeof window === 'undefined') {
    return {
      home: false,
      detail: false,
    };
  }

  try {
    const raw = window.localStorage.getItem(ONBOARDING_STATE_KEY);
    if (!raw) {
      return {
        home: false,
        detail: false,
      };
    }

    const parsed = JSON.parse(raw) as { home?: boolean; detail?: boolean };
    return {
      home: parsed.home ?? false,
      detail: parsed.detail ?? false,
    };
  } catch {
    return {
      home: false,
      detail: false,
    };
  }
};

const readPersistedPageState = () => {
  if (typeof window === 'undefined') {
    return {
      selectedCafeId: '',
      viewMode: 'home' as const,
      search: '',
      location: 'All',
    };
  }

  try {
    const raw = window.localStorage.getItem(PAGE_STATE_KEY);
    if (!raw) {
      return {
        selectedCafeId: '',
        viewMode: 'home' as const,
        search: '',
        location: 'All',
      };
    }

    const parsed = JSON.parse(raw) as {
      selectedCafeId?: string;
      viewMode?: 'home' | 'detail';
      search?: string;
      location?: string;
    };

    return {
      selectedCafeId: parsed.selectedCafeId ?? '',
      viewMode: parsed.viewMode ?? 'home',
      search: parsed.search ?? '',
      location: parsed.location ?? 'All',
    };
  } catch {
    return {
      selectedCafeId: '',
      viewMode: 'home' as const,
      search: '',
      location: 'All',
    };
  }
};

const readPersistedAdminState = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(ADMIN_STATE_KEY) === 'true';
  } catch {
    return false;
  }
};

const readPersistedDeletedState = () => {
  if (typeof window === 'undefined') {
    return {
      cafeIds: [] as string[],
      reviewIds: [] as string[],
    };
  }

  try {
    const raw = window.localStorage.getItem(DELETED_STATE_KEY);
    if (!raw) {
      return {
        cafeIds: [] as string[],
        reviewIds: [] as string[],
      };
    }

    const parsed = JSON.parse(raw) as {
      cafeIds?: string[];
      reviewIds?: string[];
    };

    return {
      cafeIds: parsed.cafeIds ?? [],
      reviewIds: parsed.reviewIds ?? [],
    };
  } catch {
    return {
      cafeIds: [] as string[],
      reviewIds: [] as string[],
    };
  }
};

function App() {
  const persistedPageState = readPersistedPageState();
  const persistedAdminMode = readPersistedAdminState();
  const persistedDeletedState = readPersistedDeletedState();
  const persistedOnboardingState = readPersistedOnboardingState();
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [selectedCafeId, setSelectedCafeId] = useState<string>(persistedPageState.selectedCafeId);
  const [viewMode, setViewMode] = useState<'home' | 'detail'>(persistedPageState.viewMode);
  const [search, setSearch] = useState(persistedPageState.search);
  const [locationFilter, setLocationFilter] = useState(persistedPageState.location);
  const [isAdminMode, setIsAdminMode] = useState(persistedAdminMode);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [adminLoginName, setAdminLoginName] = useState('');
  const [adminLoginPassword, setAdminLoginPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminEditor, setAdminEditor] = useState<AdminEditorState>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [adminCafeForm, setAdminCafeForm] = useState<AdminCafeFormState>(initialAdminCafeForm());
  const [adminReviewForm, setAdminReviewForm] = useState<AdminReviewFormState>(initialAdminReviewForm());
  const [adminCafePhotos, setAdminCafePhotos] = useState<PhotoUpload[]>([]);
  const [adminCafeEditPhotos, setAdminCafeEditPhotos] = useState<ManagedCafePhoto[]>([]);
  const [adminActionError, setAdminActionError] = useState('');
  const [deletedCafeIds, setDeletedCafeIds] = useState<string[]>(persistedDeletedState.cafeIds);
  const [deletedReviewIds, setDeletedReviewIds] = useState<string[]>(persistedDeletedState.reviewIds);
  const [isRecommendationSubmitting, setIsRecommendationSubmitting] = useState(false);
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [recommendationError, setRecommendationError] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [recommendationForm, setRecommendationForm] = useState(initialRecommendationForm);
  const [reviewForm, setReviewForm] = useState(initialReviewForm);
  const [recommendationPhotos, setRecommendationPhotos] = useState<PhotoUpload[]>([]);
  const [reviewPhotos, setReviewPhotos] = useState<PhotoUpload[]>([]);
  const [photoViewer, setPhotoViewer] = useState<{ reviewId: string; index: number } | null>(null);
  const [detailPhotoViewerIndex, setDetailPhotoViewerIndex] = useState<number | null>(null);
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [onboardingSeen, setOnboardingSeen] = useState(persistedOnboardingState);

  useEffect(() => {
    let mounted = true;

    getCafes()
      .then((data) => {
        if (!mounted) return;
        setCafes(data);
        const persistedCafeExists = data.some((cafe) => cafe.id === persistedPageState.selectedCafeId);
        if (!persistedCafeExists) {
          setSelectedCafeId(data[0]?.id ?? '');
          if (persistedPageState.viewMode === 'detail') {
            setViewMode(data[0]?.id ? 'detail' : 'home');
          }
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat data');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    window.localStorage.setItem(
      PAGE_STATE_KEY,
      JSON.stringify({
        selectedCafeId,
        viewMode,
        search,
        location: locationFilter,
      }),
    );
  }, [selectedCafeId, viewMode, search, locationFilter, isLoading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ADMIN_STATE_KEY, String(isAdminMode));
  }, [isAdminMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      DELETED_STATE_KEY,
      JSON.stringify({
        cafeIds: deletedCafeIds,
        reviewIds: deletedReviewIds,
      }),
    );
  }, [deletedCafeIds, deletedReviewIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(onboardingSeen));
  }, [onboardingSeen]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockTick(Date.now());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (
      !isRecommendationOpen &&
      !isReviewOpen &&
      !photoViewer &&
      detailPhotoViewerIndex === null &&
      !isAdminLoginOpen &&
      !adminEditor &&
      !deleteConfirm
    )
      return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsRecommendationOpen(false);
        setIsReviewOpen(false);
        setPhotoViewer(null);
        setDetailPhotoViewerIndex(null);
        setIsAdminLoginOpen(false);
        setAdminEditor(null);
        setDeleteConfirm(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailPhotoViewerIndex, isRecommendationOpen, isReviewOpen, photoViewer, isAdminLoginOpen, adminEditor, deleteConfirm]);

  useEffect(() => {
    setDetailPhotoIndex(0);
  }, [selectedCafeId]);

  const cafesWithScore = useMemo(() => {
    return cafes
      .filter((cafe) => !deletedCafeIds.includes(cafe.id))
      .map((cafe) => ({
        ...cafe,
        reviews: cafe.reviews.filter((review) => !deletedReviewIds.includes(review.id)),
      }))
      .map((cafe) => {
        const reviewCount = cafe.reviews.length;
        const averageRating = reviewCount
          ? cafe.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
          : 0;

        return {
          ...cafe,
          reviewCount,
          averageRating,
        };
      })
      .sort((a, b) => {
        if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
        return b.averageRating - a.averageRating;
      });
  }, [cafes, deletedCafeIds, deletedReviewIds]);

  const filteredCafes = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const normalizedLocation = locationFilter.trim().toLowerCase();
    return cafesWithScore.filter((cafe) => {
      const haystack = [cafe.name, cafe.area, cafe.vibe, cafe.wifi, cafe.price, ...cafe.tags]
        .join(' ')
        .toLowerCase();
      const matchesKeyword = !keyword || haystack.includes(keyword);
      const matchesLocation =
        normalizedLocation === 'all' ||
        normalizedLocation === '' ||
        cafe.area.toLowerCase() === normalizedLocation ||
        (cafe.location?.toLowerCase() ?? '') === normalizedLocation;

      return matchesKeyword && matchesLocation;
    });
  }, [cafesWithScore, search, locationFilter]);

  const displayedCafes = useMemo(() => filteredCafes.slice(0, 4), [filteredCafes]);

  const weeklyTopCafes = useMemo(() => {
    const now = Date.now();
    const last7Days = 7 * 24 * 60 * 60 * 1000;

    const ranked = filteredCafes
      .map((cafe) => {
        const weeklyReviews = cafe.reviews.filter((review) => now - new Date(review.createdAt).getTime() <= last7Days);
        const weeklyReviewCount = weeklyReviews.length;
        const weeklyAverageRating = weeklyReviewCount
          ? weeklyReviews.reduce((sum, review) => sum + review.rating, 0) / weeklyReviewCount
          : 0;

        return {
          ...cafe,
          weeklyReviewCount,
          weeklyAverageRating,
        };
      })
      .sort((left, right) => {
        if (right.weeklyAverageRating !== left.weeklyAverageRating) {
          return right.weeklyAverageRating - left.weeklyAverageRating;
        }
        if (right.weeklyReviewCount !== left.weeklyReviewCount) {
          return right.weeklyReviewCount - left.weeklyReviewCount;
        }
        if (right.averageRating !== left.averageRating) {
          return right.averageRating - left.averageRating;
        }
        return right.reviewCount - left.reviewCount;
      });

    const withWeeklyReviews = ranked.filter((cafe) => cafe.weeklyReviewCount > 0);
    const fallback = ranked.filter((cafe) => cafe.weeklyReviewCount === 0);

    return [...withWeeklyReviews, ...fallback].slice(0, 3);
  }, [filteredCafes]);

  const locationOptions = useMemo(() => {
    const locations = new Set<string>();
    cafesWithScore.forEach((cafe) => {
      const value = cafe.area?.trim() || cafe.location?.trim();
      if (value) locations.add(value);
    });

    return ['All', ...Array.from(locations).sort((left, right) => left.localeCompare(right))];
  }, [cafesWithScore]);

  const selectedCafe = useMemo(
    () => cafesWithScore.find((cafe) => cafe.id === selectedCafeId) ?? cafesWithScore[0] ?? null,
    [cafesWithScore, selectedCafeId],
  );

  useEffect(() => {
    if (isLoading) return;
    if (!cafesWithScore.length) {
      if (viewMode !== 'home') {
        setViewMode('home');
      }
      if (selectedCafeId) {
        setSelectedCafeId('');
      }
      return;
    }

    const selectedCafeExists = cafesWithScore.some((cafe) => cafe.id === selectedCafeId);
    if (!selectedCafeExists) {
      setSelectedCafeId(cafesWithScore[0].id);
      if (viewMode !== 'detail') {
        setViewMode('detail');
      }
    }
  }, [cafesWithScore, isLoading, selectedCafeId, viewMode]);

  const selectedCafePhotos = useMemo(() => {
    if (!selectedCafe) return [];

    if (selectedCafe.photoUrls?.length) {
      return selectedCafe.photoUrls;
    }

    const fallbackImage = selectedCafe.thumbnailImage ?? selectedCafe.image;
    return fallbackImage ? [fallbackImage] : [];
  }, [selectedCafe]);

  const activeDetailPhoto =
    selectedCafePhotos[detailPhotoIndex] ?? selectedCafe?.thumbnailImage ?? selectedCafe?.image ?? '';

  const selectedCafeRatingBreakdown = useMemo(() => {
    const reviews = selectedCafe?.reviews ?? [];
    const total = reviews.length || 1;

    return [5, 4, 3, 2, 1].map((rating) => {
      const count = reviews.filter((review) => review.rating === rating).length;
      return {
        rating,
        count,
        percentage: (count / total) * 100,
      };
    });
  }, [selectedCafe]);

  const sortedCafeReviews = useMemo(() => {
    if (!selectedCafe) return [];
    return sortReviewsByPopularity(selectedCafe.reviews);
  }, [selectedCafe]);

  const primaryReview = sortedCafeReviews[0] ?? null;
  const otherReviews = sortedCafeReviews.slice(1);

  const reviewPhotoSources = (review: Cafe['reviews'][number]) =>
    (review.photoUrls?.length ? review.photoUrls : review.photoUrl ? [review.photoUrl] : [])
      .slice(0, 4);

  const activePhotoViewerReview = useMemo(
    () => (photoViewer ? selectedCafe?.reviews.find((review) => review.id === photoViewer.reviewId) ?? null : null),
    [photoViewer, selectedCafe],
  );

  const activePhotoViewerImages = useMemo(
    () => (activePhotoViewerReview ? reviewPhotoSources(activePhotoViewerReview) : []),
    [activePhotoViewerReview],
  );

  useEffect(() => {
    setDetailPhotoIndex(0);
  }, [selectedCafeId]);

  const openCafeDetail = (cafeId: string) => {
    setSelectedCafeId(cafeId);
    setViewMode('detail');
  };

  const openAdminLogin = () => {
    setAdminLoginError('');
    setIsAdminLoginOpen(true);
  };

  const closeAdminLogin = () => {
    setIsAdminLoginOpen(false);
    setAdminLoginPassword('');
    setAdminLoginName('');
    setAdminLoginError('');
  };

  const openCafeEditor = (cafe: Cafe) => {
    setAdminActionError('');
    const primaryReview = sortReviewsByPopularity(cafe.reviews)[0];
    const existingPhotoUrls = cafe.photoUrls?.length ? cafe.photoUrls : [cafe.image].filter(Boolean);
    const existingPhotoThumbnailUrls = cafe.photoThumbnailUrls?.length
      ? cafe.photoThumbnailUrls
      : [cafe.thumbnailImage ?? cafe.image].filter(Boolean);
    setAdminCafeForm({
      userName: primaryReview?.name ?? '',
      coffeeShopName: cafe.name,
      location: cafe.location ?? cafe.area,
      address: cafe.address ?? '',
      latitude: cafe.latitude,
      longitude: cafe.longitude,
      openHours: cafe.openHours,
      price: cafe.price,
      rating: primaryReview?.rating ?? 5,
      checklist: cafe.tags ?? [],
      review: primaryReview?.comment ?? '',
      recommendationVote: primaryReview?.recommendationVote ?? 'like',
      existingPhotoUrls,
      existingPhotoThumbnailUrls,
    });
    setAdminCafeEditPhotos(
      existingPhotoUrls.slice(0, 5).map((originalUrl, index) => ({
        id: `${cafe.id}-${index}-${originalUrl}`,
        source: 'existing',
        originalUrl,
        thumbnailUrl: existingPhotoThumbnailUrls[index] ?? originalUrl,
        previewUrl: existingPhotoThumbnailUrls[index] ?? originalUrl,
      })),
    );
    setAdminCafePhotos([]);
    setAdminEditor({ type: 'cafe', cafeId: cafe.id });
  };

  const openReviewEditor = (cafeId: string, review: CafeReview) => {
    setAdminActionError('');
    setAdminReviewForm({
      name: review.name,
      rating: review.rating,
      comment: review.comment,
      recommendationVote: review.recommendationVote ?? 'like',
    });
    setAdminEditor({ type: 'review', cafeId, reviewId: review.id });
  };

  const toggleAdminCafeChecklist = (item: string) => {
    setAdminCafeForm((current) => {
      const hasItem = current.checklist.includes(item);
      return {
        ...current,
        checklist: hasItem
          ? current.checklist.filter((entry) => entry !== item)
          : [...current.checklist, item],
      };
    });
  };

  const handleAdminCafePhotoUpload = async (files: FileList | null) => {
    if (!files?.length) return;

    const selectedFiles = Array.from(files).slice(0, Math.max(0, 5 - adminCafePhotos.length));
    const nextPhotos = selectedFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setAdminCafePhotos((current) => [...current, ...nextPhotos].slice(0, 5));
  };

  const handleAdminCafeEditPhotoUpload = async (files: FileList | null) => {
    if (!files?.length) return;

    const selectedFiles = Array.from(files).slice(0, Math.max(0, 5 - adminCafeEditPhotos.length));
    const nextPhotos = selectedFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      return {
        id: `${Date.now()}-${crypto.randomUUID()}`,
        source: 'new' as const,
        file,
        originalUrl: previewUrl,
        thumbnailUrl: previewUrl,
        previewUrl,
      };
    });

    setAdminCafeEditPhotos((current) => [...current, ...nextPhotos].slice(0, 5));
  };

  const handleAdminCafeEditPhotoReplace = async (index: number, files: FileList | null) => {
    if (!files?.length) return;
    const [file] = Array.from(files);
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAdminCafeEditPhotos((current) =>
      current.map((photo, photoIndex) => {
        if (photoIndex !== index) return photo;
        if (photo.source === 'new') {
          URL.revokeObjectURL(photo.previewUrl);
        }

        return {
          id: `${Date.now()}-${crypto.randomUUID()}`,
          source: 'new',
          file,
          originalUrl: previewUrl,
          thumbnailUrl: previewUrl,
          previewUrl,
        };
      }),
    );
  };

  const removeAdminCafePhoto = (index: number) => {
    setAdminCafePhotos((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  };

  const moveAdminCafeEditPhoto = (index: number, direction: -1 | 1) => {
    setAdminCafeEditPhotos((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const removeAdminCafeEditPhoto = (index: number) => {
    setAdminCafeEditPhotos((current) => {
      const target = current[index];
      if (target?.source === 'new') {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  };

  const closeAdminEditor = () => {
    adminCafePhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    adminCafeEditPhotos.forEach((photo) => {
      if (photo.source === 'new') {
        URL.revokeObjectURL(photo.previewUrl);
      }
    });
    setAdminCafePhotos([]);
    setAdminCafeEditPhotos([]);
    setAdminEditor(null);
    setAdminActionError('');
    setAdminCafeForm(initialAdminCafeForm());
    setAdminReviewForm(initialAdminReviewForm());
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirm(null);
    setAdminActionError('');
  };

  const handleAdminLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdminLoginError('');

    try {
      const isValid = await verifyAdminCredentials(adminLoginName.trim(), adminLoginPassword);
      if (!isValid) {
        setAdminLoginError('Kredensial admin tidak valid.');
        return;
      }

      setIsAdminMode(true);
      closeAdminLogin();
    } catch (submissionError) {
      setAdminLoginError(submissionError instanceof Error ? submissionError.message : 'Gagal login admin');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminMode(false);
    setIsAdminLoginOpen(false);
    setAdminEditor(null);
    setAdminActionError('');
  };

  const handleCafeEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminEditor || adminEditor.type !== 'cafe') return;

    setAdminActionError('');

    try {
      const sourceCafe = cafes.find((cafe) => cafe.id === adminEditor.cafeId);
      if (!sourceCafe) {
        throw new Error('Cafe tidak ditemukan');
      }

      const photosWithFiles = adminCafeEditPhotos.filter((photo): photo is ManagedCafePhoto & { file: File } =>
        Boolean(photo.file),
      );
      const uploadedPhotos = photosWithFiles.length
        ? await uploadCafePhotoFiles(
            photosWithFiles.map((photo) => photo.file),
            `cafes/${adminEditor.cafeId}`,
          )
        : [];
      const primaryReview = sortReviewsByPopularity(sourceCafe.reviews)[0];
      let uploadedPhotoIndex = 0;
      const photoUrls = adminCafeEditPhotos.map((photo) => {
        if (photo.file) {
          const uploadedPhoto = uploadedPhotos[uploadedPhotoIndex];
          uploadedPhotoIndex += 1;
          return uploadedPhoto?.originalUrl ?? photo.originalUrl;
        }

        return photo.originalUrl;
      });

      let uploadedThumbnailIndex = 0;
      const photoThumbnailUrls = adminCafeEditPhotos.map((photo) => {
        if (photo.file) {
          const uploadedPhoto = uploadedPhotos[uploadedThumbnailIndex];
          uploadedThumbnailIndex += 1;
          return uploadedPhoto?.thumbnailUrl ?? photo.thumbnailUrl;
        }

        return photo.thumbnailUrl;
      });

      const nextCafeData = {
        name: adminCafeForm.coffeeShopName,
        area: adminCafeForm.location,
        location: adminCafeForm.location,
        address: adminCafeForm.address,
        latitude: adminCafeForm.latitude,
        longitude: adminCafeForm.longitude,
        vibe: adminCafeForm.recommendationVote === 'like' ? 'direkomendasikan' : 'perlu dicek',
        wifi: adminCafeForm.checklist.includes('wifi cepat') ? 'cepat' : 'stabil',
        price: adminCafeForm.price,
        openHours: adminCafeForm.openHours,
        image: photoUrls[0] ?? sourceCafe.image,
        thumbnailImage: photoThumbnailUrls[0] ?? photoUrls[0] ?? sourceCafe.thumbnailImage ?? sourceCafe.image,
        tags: adminCafeForm.checklist,
        photoUrls,
        photoThumbnailUrls,
      };

      setCafes((current) =>
        current.map((cafe) =>
          cafe.id !== sourceCafe.id
            ? cafe
            : {
                ...cafe,
                ...nextCafeData,
                reviews: cafe.reviews.map((review) =>
                  review.id === primaryReview?.id
                    ? {
                        ...review,
                        name: adminCafeForm.userName,
                        rating: adminCafeForm.rating,
                        comment: adminCafeForm.review,
                        recommendationVote: adminCafeForm.recommendationVote,
                        photoUrl: photoUrls[0],
                        photoThumbnailUrl: photoThumbnailUrls[0],
                        photoUrls,
                        photoThumbnailUrls,
                      }
                    : review,
                ),
              },
        ),
      );
      setSelectedCafeId(sourceCafe.id);
      setDetailPhotoIndex(0);

      await updateCafe(adminEditor.cafeId, {
        ...nextCafeData,
      });

      if (primaryReview) {
        await updateReview(primaryReview.id, {
          name: adminCafeForm.userName,
          rating: adminCafeForm.rating,
          comment: adminCafeForm.review,
          recommendationVote: adminCafeForm.recommendationVote,
          photoUrl: photoUrls[0],
          photoThumbnailUrl: photoThumbnailUrls[0],
          photoUrls,
          photoThumbnailUrls,
        });
      }

      // Re-sync from backend so post-save state matches what a full refresh will load.
      setCafes(await getCafes());

      adminCafeEditPhotos.forEach((photo) => {
        if (photo.source === 'new') {
          URL.revokeObjectURL(photo.previewUrl);
        }
      });
      setAdminCafePhotos([]);
      setAdminCafeEditPhotos([]);
      closeAdminEditor();
    } catch (submissionError) {
      setAdminActionError(submissionError instanceof Error ? submissionError.message : 'Gagal mengubah cafe');
    }
  };

  const handleReviewEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminEditor || adminEditor.type !== 'review') return;

    setAdminActionError('');

    try {
      const updated = await updateReview(adminEditor.reviewId, adminReviewForm);
      setCafes(updated);
      closeAdminEditor();
    } catch (submissionError) {
      setAdminActionError(submissionError instanceof Error ? submissionError.message : 'Gagal mengubah review');
    }
  };

  const handleDeleteCafe = async (cafeId: string) => {
    setDeleteConfirm({ type: 'cafe', cafeId });
  };

  const handleDeleteReview = async (cafeId: string, reviewId: string) => {
    setDeleteConfirm({ type: 'review', cafeId, reviewId });
  };

  const handleLikeReview = async (reviewId: string) => {
    setAdminActionError('');

    try {
      const updated = await likeReview(reviewId);
      setCafes(updated);
    } catch (submissionError) {
      setAdminActionError(submissionError instanceof Error ? submissionError.message : 'Gagal menyukai review');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setAdminActionError('');

    try {
      if (deleteConfirm.type === 'cafe') {
        setDeletedCafeIds((current) => Array.from(new Set([...current, deleteConfirm.cafeId])));
        setDeletedReviewIds((current) => [
          ...current,
          ...(cafes.find((cafe) => cafe.id === deleteConfirm.cafeId)?.reviews.map((review) => review.id) ?? []),
        ]);
        setCafes((current) => current.filter((cafe) => cafe.id !== deleteConfirm.cafeId));
        if (selectedCafeId === deleteConfirm.cafeId) {
          setSelectedCafeId('');
          setViewMode('home');
        }
      } else {
        setDeletedReviewIds((current) => Array.from(new Set([...current, deleteConfirm.reviewId])));
        setCafes((current) =>
          current.map((cafe) => ({
            ...cafe,
            reviews: cafe.reviews.filter((review) => review.id !== deleteConfirm.reviewId),
          })),
        );
      }

      if (deleteConfirm.type === 'cafe') {
        await deleteCafe(deleteConfirm.cafeId);
        if (selectedCafeId === deleteConfirm.cafeId) {
          setSelectedCafeId(cafes.find((cafe) => cafe.id !== deleteConfirm.cafeId)?.id ?? '');
          setViewMode(cafes.some((cafe) => cafe.id !== deleteConfirm.cafeId) ? 'detail' : 'home');
        }
      } else {
        if (selectedCafeId === deleteConfirm.cafeId && deleteConfirm.reviewId === selectedCafe?.reviews[0]?.id) {
          setSelectedCafeId(deleteConfirm.cafeId);
        }
        await deleteReview(deleteConfirm.reviewId);
      }
      closeDeleteConfirm();
    } catch (submissionError) {
      setAdminActionError(
        submissionError instanceof Error
          ? submissionError.message
          : deleteConfirm.type === 'cafe'
            ? 'Gagal menghapus cafe'
            : 'Gagal menghapus review',
      );
    }
  };

  const goToPreviousDetailPhoto = () => {
    setDetailPhotoIndex((current) => {
      if (!selectedCafePhotos.length) return 0;
      return (current - 1 + selectedCafePhotos.length) % selectedCafePhotos.length;
    });
  };

  const goToNextDetailPhoto = () => {
    setDetailPhotoIndex((current) => {
      if (!selectedCafePhotos.length) return 0;
      return (current + 1) % selectedCafePhotos.length;
    });
  };

  const openReviewPhotoViewer = (reviewId: string, index: number) => {
    setPhotoViewer({ reviewId, index });
  };

  const openDetailPhotoViewer = () => {
    if (!selectedCafePhotos.length) return;
    setDetailPhotoViewerIndex(detailPhotoIndex);
  };

  const closeDetailPhotoViewer = () => {
    setDetailPhotoViewerIndex(null);
  };

  const goToNextDetailPhotoViewer = () => {
    setDetailPhotoViewerIndex((current) => {
      if (current === null || !selectedCafePhotos.length) return current;
      return (current + 1) % selectedCafePhotos.length;
    });
  };

  const goToPreviousDetailPhotoViewer = () => {
    setDetailPhotoViewerIndex((current) => {
      if (current === null || !selectedCafePhotos.length) return current;
      return (current - 1 + selectedCafePhotos.length) % selectedCafePhotos.length;
    });
  };

  const closeReviewPhotoViewer = () => {
    setPhotoViewer(null);
  };

  const goToNextReviewPhoto = () => {
    setPhotoViewer((current) => {
      if (!current || !activePhotoViewerImages.length) return current;
      return {
        ...current,
        index: (current.index + 1) % activePhotoViewerImages.length,
      };
    });
  };

  const goToPreviousReviewPhoto = () => {
    setPhotoViewer((current) => {
      if (!current || !activePhotoViewerImages.length) return current;
      return {
        ...current,
        index: (current.index - 1 + activePhotoViewerImages.length) % activePhotoViewerImages.length,
      };
    });
  };

  const handleRecommendationPhotoUpload = async (files: FileList | null) => {
    if (!files?.length) return;

    const selectedFiles = Array.from(files).slice(0, Math.max(0, 5 - recommendationPhotos.length));
    const nextPhotos = selectedFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setRecommendationPhotos((current) => [...current, ...nextPhotos].slice(0, 5));
  };

  const handleReviewPhotoUpload = async (files: FileList | null) => {
    if (!files?.length) return;

    const selectedFiles = Array.from(files).slice(0, Math.max(0, 5 - reviewPhotos.length));
    const nextPhotos = selectedFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setReviewPhotos((current) => [...current, ...nextPhotos].slice(0, 5));
  };

  const toggleRecommendationChecklist = (item: string) => {
    setRecommendationForm((current) => {
      const hasItem = current.checklist.includes(item);
      return {
        ...current,
        checklist: hasItem
          ? current.checklist.filter((entry) => entry !== item)
          : [...current.checklist, item],
      };
    });
  };

  const removeRecommendationPhoto = (index: number) => {
    setRecommendationPhotos((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  };

  const removeReviewPhoto = (index: number) => {
    setReviewPhotos((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  };

  const handleRecommendationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsRecommendationSubmitting(true);
    setRecommendationError('');

    try {
      const uploadedPhotos = await uploadCafePhotoFiles(
        recommendationPhotos.map((photo) => photo.file),
        `cafes/${recommendationForm.coffeeShopName}`,
      );

      const updated = await addRecommendation({
        ...recommendationForm,
        photoUrls: uploadedPhotos.map((photo) => photo.originalUrl),
        photoThumbnailUrls: uploadedPhotos.map((photo) => photo.thumbnailUrl),
      });

      setCafes(updated);
      const createdCafe = [...updated].reverse().find(
        (cafe) =>
          cafe.name === recommendationForm.coffeeShopName &&
          (cafe.location ?? cafe.area) === recommendationForm.location,
      );
      setSelectedCafeId(createdCafe?.id ?? updated[0]?.id ?? '');
      setViewMode('detail');
      setRecommendationForm(initialRecommendationForm);
      recommendationPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setRecommendationPhotos([]);
      setIsRecommendationOpen(false);
    } catch (submissionError) {
      setRecommendationError(
        submissionError instanceof Error ? submissionError.message : 'Gagal menyimpan rekomendasi',
      );
    } finally {
      setIsRecommendationSubmitting(false);
    }
  };

  const handleReviewSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCafe) return;

    setIsReviewSubmitting(true);
    setReviewError('');

    try {
      const uploadedPhotos = await uploadCafePhotoFiles(reviewPhotos.map((photo) => photo.file), `cafes/${selectedCafe.id}/reviews`);

      const updated = await addReview(selectedCafe.id, {
        ...reviewForm,
        photoUrl: uploadedPhotos[0]?.originalUrl,
        photoThumbnailUrl: uploadedPhotos[0]?.thumbnailUrl,
        photoUrls: uploadedPhotos.map((photo) => photo.originalUrl),
        photoThumbnailUrls: uploadedPhotos.map((photo) => photo.thumbnailUrl),
      });

      setCafes(updated);
      setReviewForm(initialReviewForm);
      reviewPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setReviewPhotos([]);
      setIsReviewOpen(false);
    } catch (submissionError) {
      setReviewError(submissionError instanceof Error ? submissionError.message : 'Gagal menyimpan review');
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    const totalReviews = displayedCafes.reduce((sum, cafe) => sum + cafe.reviews.length, 0);
    const averageRating =
      totalReviews > 0
        ? displayedCafes.reduce(
            (sum, cafe) => sum + cafe.reviews.reduce((cafeSum, review) => cafeSum + review.rating, 0),
            0,
          ) / totalReviews
        : 0;

    return { totalReviews, averageRating };
  }, [displayedCafes]);

  const recommendationStars = [1, 2, 3, 4, 5];
  const shouldShowOnboarding =
    !isLoading && !isRecommendationOpen && !isReviewOpen && !isAdminLoginOpen && !adminEditor && !deleteConfirm;
  const shouldShowWeeklyHighlight = search.trim().length === 0;

  const dismissOnboarding = (page: 'home' | 'detail') => {
    setOnboardingSeen((current) => ({
      ...current,
      [page]: true,
    }));
  };

  return (
    <div className="page-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <main className="app-shell">
        {viewMode === 'home' ? (
          <>
            <section className="hero-card">
              <div className="hero-copy">
                <div className="hero-brand-row">
                  <button
                    className="hero-logo-button"
                    type="button"
                    onClick={openAdminLogin}
                    aria-label="Buka login administrator"
                  >
                    <img className="hero-logo" src={logoGreen} alt="Teman WFC" />
                  </button>
                  {isAdminMode ? (
                    <button className="admin-mode-button" type="button" onClick={openAdminLogin}>
                      Admin aktif
                    </button>
                  ) : null}
                </div>
                <h1>Nyari tempat buat WFC?</h1>
                <p className="hero-subline">
                  ini rekomendasi tempat WFC dari sesama remote worker yang ada di sekitarmu.
                </p>

                <div className="hero-actions">
                  <div className="hero-actions-top">
                    <div className="hero-stats">
                      <div>
                        <strong>{displayedCafes.length}</strong>
                        <span>Cofeeshop</span>
                      </div>
                      <div>
                        <strong>{stats.totalReviews}</strong>
                        <span>Review</span>
                      </div>
                      <div>
                        <strong>{stats.averageRating.toFixed(1)}</strong>
                        <span>Rata-rata</span>
                      </div>
                    </div>
                    <div className="search-filters">
                      <label className="search-box">
                        <span>Bisa dicari nama coffeeshop, lokasi, atau kota</span>
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Cari coffeeshop..."
                        />
                      </label>
                      <label className="search-box location-filter">
                        <span>Filter lokasi</span>
                        <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
                          {locationOptions.map((location) => (
                            <option key={location} value={location}>
                              {location}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {shouldShowOnboarding && !onboardingSeen.home ? (
              <section className="onboarding-card onboarding-card-home">
                <div>
                  <span className="section-kicker">Mini tutorial</span>
                  <h3>Mulai dari sini</h3>
                </div>
                <p>
                  Gunakan filter lokasi untuk menyesuaikan kota, cek `Top 3 Mingguan`, lalu klik card coffeeshop untuk
                  buka detail dan ulasan.
                </p>
                <div className="onboarding-steps">
                  <span>1. Cari nama atau kota</span>
                  <span>2. Pilih lokasi terdekat</span>
                  <span>3. Buka detail coffeeshop</span>
                </div>
                <button type="button" className="onboarding-dismiss" onClick={() => dismissOnboarding('home')}>
                  Mengerti
                </button>
              </section>
            ) : null}

            {shouldShowWeeklyHighlight ? (
              <section className="weekly-highlight-panel compact-panel">
                <div className="section-head">
                  <div>
                    <span className="section-kicker">Highlight mingguan</span>
                    <h2>Top 3 coffeeshop rating tertinggi minggu ini</h2>
                  </div>
                  <span className="muted">{weeklyTopCafes.length} pilihan</span>
                </div>

                <div className="weekly-highlight-grid">
                  {weeklyTopCafes.map((cafe, index) => {
                    const rankBadge = topRankBadge(index + 1);
                    const badge = recommendationBadge(cafe.reviews[0]?.recommendationVote);

                    return (
                      <article
                        key={`weekly-${cafe.id}`}
                        className="weekly-highlight-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => openCafeDetail(cafe.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openCafeDetail(cafe.id);
                          }
                        }}
                      >
                        <img src={cafe.thumbnailImage ?? cafe.image} alt={cafe.name} />
                        <div className="weekly-highlight-copy">
                          <div className="weekly-highlight-badges">
                            <span className={`rank-badge ${rankBadge.tone}`}>{rankBadge.label}</span>
                            <span className={`card-badge ${badge.icon === 'thumb-down' ? 'negative' : 'positive'}`}>
                              <span>{badge.label}</span>
                            </span>
                          </div>

                          <div className="weekly-highlight-head">
                            <h3>{cafe.name}</h3>
                            <div className="card-rating">
                              <div className="card-stars" aria-label={`${cafe.averageRating.toFixed(1)} bintang`}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span key={star} className={cafe.averageRating >= star ? 'active' : ''}>
                                    ★
                                  </span>
                                ))}
                              </div>
                              <strong>{cafe.averageRating.toFixed(1)}</strong>
                            </div>
                          </div>

                          <p className="weekly-highlight-meta">
                            {cafe.location ?? cafe.area} · {cafe.openHours}
                          </p>
                          <p className="weekly-highlight-address">{cafe.address ?? 'Alamat belum diisi'}</p>
                          <div className="weekly-highlight-tags">
                            {cafe.tags.slice(0, 4).map((tag) => (
                              <span key={`${cafe.id}-${tag}`}>{tag}</span>
                            ))}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="gallery-panel compact-panel">
              <div className="section-head">
                <div>
                  <h2>Daftar coffeeshop untuk WFC</h2>
                </div>
                <span className="muted">{displayedCafes.length} hasil</span>
              </div>

              {isLoading ? (
                <div className="empty-state">Memuat data coffeeshop...</div>
              ) : error ? (
                <div className="empty-state error-state">{error}</div>
              ) : (
                <div className="gallery-grid">
                  {displayedCafes.map((cafe) => {
                    const badge = recommendationBadge(cafe.reviews[0]?.recommendationVote);

                    return (
                    <article
                      key={cafe.id}
                      className={`cafe-card ${selectedCafeId === cafe.id ? 'active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => openCafeDetail(cafe.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openCafeDetail(cafe.id);
                        }
                      }}
                    >
                      <img src={cafe.thumbnailImage ?? cafe.image} alt={cafe.name} />
                      <div className="card-body">
                        <div className="card-badge-row">
                          <span className={`card-badge ${badge.icon === 'thumb-down' ? 'negative' : 'positive'}`}>
                            {badge.icon === 'thumb-down' ? (
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M4 14h4v8H4zM20.5 11c0-.83-.67-1.5-1.5-1.5h-6.31l.95-4.57.03-.33c0-.41-.17-.79-.44-1.06L11.17 2 5.59 7.59C5.22 7.95 5 8.45 5 9v10c0 1.1.9 2 2 2h9c.79 0 1.5-.47 1.8-1.16l3-7.01c.12-.29.2-.61.2-.94z" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M2 21h4V9H2zM22 10.5c0-.83-.67-1.5-1.5-1.5H14l1.01-4.84.03-.33c0-.42-.17-.81-.44-1.09L13 2 7.59 7.41C7.22 7.78 7 8.28 7 8.83V19c0 1.1.9 2 2 2h7c.79 0 1.5-.47 1.8-1.16l4-9.2c.12-.29.2-.61.2-.94z" />
                              </svg>
                            )}
                            <span>{badge.label}</span>
                          </span>
                        </div>
                        <div className="card-topline">
                          <h3>{cafe.name}</h3>
                          <div className="card-rating">
                            <div className="card-stars" aria-label={`${cafe.averageRating.toFixed(1)} bintang`}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span key={star} className={cafe.averageRating >= star ? 'active' : ''}>
                                  ★
                                </span>
                              ))}
                            </div>
                            <strong>{cafe.averageRating.toFixed(1)}</strong>
                          </div>
                        </div>
                        <p>
                          {cafe.location ?? cafe.area} · {cafe.openHours}
                        </p>
                        <div className="card-meta">
                          <span>{cafe.reviewCount} review</span>
                        </div>
                        {isAdminMode ? (
                          <div className="admin-card-actions">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                openCafeEditor(cafe);
                              }}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleDeleteCafe(cafe.id);
                              }}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                              }}
                            >
                              Hapus
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : selectedCafe ? (
          <section className="detail-page">
            <div className="detail-page-topbar">
              <button className="back-button" type="button" onClick={() => setViewMode('home')}>
                ← Kembali
              </button>
              <div className="detail-topbar-actions">
                <span className="muted">Detail coffeeshop</span>
                {isAdminMode ? (
                  <button className="admin-mode-button small" type="button" onClick={openAdminLogin}>
                    Admin mode
                  </button>
                ) : null}
              </div>
            </div>

            {shouldShowOnboarding && !onboardingSeen.detail ? (
              <section className="onboarding-card onboarding-card-detail">
                <div>
                  <span className="section-kicker">Mini tutorial</span>
                  <h3>Cara baca halaman detail</h3>
                </div>
                <p>
                  Klik foto untuk preview, lihat `Most liked` sebagai top review, lalu pakai tombol `Tulis review`
                  untuk menambah ulasan baru.
                </p>
                <div className="onboarding-steps">
                  <span>1. Preview foto coffeeshop</span>
                  <span>2. Cek review paling membantu</span>
                  <span>3. Tambahkan review kamu</span>
                </div>
                <button type="button" className="onboarding-dismiss" onClick={() => dismissOnboarding('detail')}>
                  Mengerti
                </button>
              </section>
            ) : null}

            <article className="detail-hero">
              <div className="detail-hero-image-wrap">
                <button
                  type="button"
                  className="detail-photo-nav detail-photo-nav-left"
                  onClick={goToPreviousDetailPhoto}
                  aria-label="Foto sebelumnya"
                  disabled={selectedCafePhotos.length <= 1}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="detail-photo-preview"
                  onClick={openDetailPhotoViewer}
                  aria-label={`Buka preview foto ${detailPhotoIndex + 1}`}
                >
                  <img src={activeDetailPhoto} alt={selectedCafe.name} />
                </button>
                <button
                  type="button"
                  className="detail-photo-nav detail-photo-nav-right"
                  onClick={goToNextDetailPhoto}
                  aria-label="Foto selanjutnya"
                  disabled={selectedCafePhotos.length <= 1}
                >
                  ›
                </button>
                {selectedCafePhotos.length > 1 ? (
                  <div className="detail-photo-dots" aria-label="Urutan foto coffeeshop">
                    {selectedCafePhotos.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        className={index === detailPhotoIndex ? 'active' : ''}
                        onClick={() => setDetailPhotoIndex(index)}
                        aria-label={`Buka foto ${index + 1}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="detail-hero-copy">
                <div className="detail-hero-head">
                  <span className="section-kicker">Review coffeeshop</span>
                  <div className="detail-hero-actions">
                    <div className="detail-hero-status">
                      <span
                        className={`detail-status-icon ${
                          primaryReview?.recommendationVote === 'dislike' ? 'negative' : 'positive'
                        }`}
                      >
                        {primaryReview?.recommendationVote === 'dislike' ? (
                          <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                            <path d="M10 3h2v10h-2zm-4 6c0-.55.45-1 1-1h5.17l-.82-3.91-.03-.34c0-.44.18-.85.46-1.15L11.83 3l5.59 5.59C17.78 9.03 18 9.52 18 10v6c0 1.1-.9 2-2 2h-6c-.78 0-1.46-.45-1.79-1.11L5.19 10.86A1.5 1.5 0 0 1 6 10z" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                            <path d="M14 3h-2v10h2zm4 6c0-.55-.45-1-1-1h-5.17l.82-3.91.03-.34c0-.44-.18-.85-.46-1.15L12.17 3 6.58 8.59C6.22 8.95 6 9.44 6 9.92V16c0 1.1.9 2 2 2h6c.78 0 1.46-.45 1.79-1.11l3.02-6.03c.12-.23.19-.49.19-.76z" />
                          </svg>
                        )}
                      </span>
                      <strong>{recommendationBadge(primaryReview?.recommendationVote).label}</strong>
                    </div>
                    <button className="write-review-button hero" type="button" onClick={() => setIsReviewOpen(true)}>
                      Tulis review
                    </button>
                  </div>
                </div>
                <h2>{selectedCafe.name}</h2>
                <div className="detail-summary-row" aria-label={`Rating ${selectedCafe.averageRating.toFixed(1)} dari ${selectedCafe.reviewCount} review`}>
                  <strong className="detail-summary-rating-number">{selectedCafe.averageRating.toFixed(1)}</strong>
                  <div className="detail-summary-stars" aria-label={`${selectedCafe.averageRating.toFixed(1)} bintang`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <span key={index} className={selectedCafe.averageRating >= index + 1 ? 'active' : ''}>
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="detail-summary-reviews">({selectedCafe.reviewCount})</span>
                </div>
                <p>
                  {selectedCafe.location ?? selectedCafe.area} · {selectedCafe.price} · buka {selectedCafe.openHours}
                </p>
                {selectedCafe.address ? <p>{selectedCafe.address}</p> : null}
                {typeof selectedCafe.latitude === 'number' && typeof selectedCafe.longitude === 'number' ? (
                  <div className="detail-map-action-row">
                    <a
                      className="map-link-button"
                      href={buildMapsUrl(selectedCafe.latitude, selectedCafe.longitude, selectedCafe.name)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Buka titik lokasi
                    </a>
                    <span className="muted map-coordinates-label">
                      {selectedCafe.latitude.toFixed(6)}, {selectedCafe.longitude.toFixed(6)}
                    </span>
                  </div>
                ) : null}
                <div className="tag-row">
                  {selectedCafe.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                {primaryReview ? (
                  <section className="primary-review-panel inline">
                    <article className="primary-review-card">
                      <div className="primary-review-meta">
                        <div className="review-avatar large">{getInitials(primaryReview.name) || 'W'}</div>
                        <div className="review-user">
                          <strong>{primaryReview.name}</strong>
                        <span>{formatRelativeTime(primaryReview.createdAt, clockTick)}</span>
                        </div>
                        <div className="primary-review-score">
                          <strong>{primaryReview.rating.toFixed(1)}</strong>
                          <div className="mini-stars" aria-label={`${primaryReview.rating} bintang`}>
                            {Array.from({ length: 5 }, (_, index) => (
                              <span key={index} className={primaryReview.rating >= index + 1 ? 'active' : ''}>
                                ★
                              </span>
                            ))}
                          </div>
                          <span className="top-review-badge">
                            <svg viewBox="0 0 24 24" role="presentation" focusable="false" aria-hidden="true">
                              <path d="M12 2.5 14.8 8l6.2.9-4.5 4.4 1.1 6.2L12 16.8 6.4 19.5l1.1-6.2L3 8.9l6.2-.9z" />
                            </svg>
                            Most liked
                          </span>
                        </div>
                      </div>

                      <p>{primaryReview.comment}</p>

                      <div className="review-actions">
                        <button type="button" onClick={() => void handleLikeReview(primaryReview.id)}>
                          {primaryReview.likesCount ?? 0} suka
                        </button>
                      </div>
                      {isAdminMode ? (
                        <div className="admin-review-actions">
                          <button type="button" onClick={() => openReviewEditor(selectedCafe.id, primaryReview)}>
                            Edit komentar
                          </button>
                          <button type="button" onClick={() => void handleDeleteReview(selectedCafe.id, primaryReview.id)}>
                            Hapus komentar
                          </button>
                        </div>
                      ) : null}
                    </article>
                  </section>
                ) : null}
                {isAdminMode ? (
                  <div className="admin-detail-actions">
                    <button type="button" onClick={() => openCafeEditor(selectedCafe)}>
                      Edit coffeeshop
                    </button>
                    <button type="button" onClick={() => void handleDeleteCafe(selectedCafe.id)}>
                      Hapus coffeeshop
                    </button>
                    <button type="button" onClick={handleAdminLogout}>
                      Keluar admin
                    </button>
                  </div>
                ) : null}
              </div>
            </article>

            <section className="review-summary-panel">
              <div className="section-head compact">
                <div>
                  <span className="section-kicker">Ringkasan ulasan</span>
                  <h2>Ulasan coffeeshop</h2>
                </div>
                <span className="muted">{selectedCafe.reviewCount} ulasan</span>
              </div>

              <div className="review-summary-grid">
                <div className="review-summary-bars">
                  {selectedCafeRatingBreakdown.map((item) => (
                    <div className="review-summary-row" key={item.rating}>
                      <span className="review-summary-label">{item.rating}</span>
                      <div className="review-summary-track" aria-hidden="true">
                        <div
                          className="review-summary-fill"
                          style={{ width: `${Math.max(item.percentage, item.count ? 8 : 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="review-summary-score">
                  <strong>{selectedCafe.averageRating.toFixed(1)}</strong>
                  <div className="review-summary-stars" aria-label={`${selectedCafe.averageRating.toFixed(1)} bintang`}>
                    {Array.from({ length: 5 }, (_, index) => {
                      const starNumber = index + 1;
                      return (
                        <span key={starNumber} className={selectedCafe.averageRating >= starNumber ? 'active' : ''}>
                          ★
                        </span>
                      );
                    })}
                  </div>
                  <span className="muted">{selectedCafe.reviewCount} ulasan</span>
                </div>
              </div>
            </section>

            <section className="detail-review-list">
                <div className="section-head compact">
                  <div>
                    <span className="section-kicker">Ulasan</span>
                    <h2>Review lainnya</h2>
                  </div>
                </div>

              {otherReviews.length ? (
                <div className="google-review-list">
                  {otherReviews.map((review) => {
                    const reviewImages = reviewPhotoSources(review);

                    return (
                      <article className="google-review-item" key={review.id}>
                        <div className="google-review-head">
                          <div className="review-avatar">{getInitials(review.name) || 'W'}</div>
                          <div className="review-user">
                            <strong>{review.name}</strong>
                            <span>{review.photoUrls?.length ?? 0} foto</span>
                          </div>
                          <button type="button" className="review-menu" aria-label="Opsi review">
                            ⋮
                          </button>
                        </div>

                        <div className="google-review-rating-row">
                          <div className="mini-stars" aria-label={`${review.rating} bintang`}>
                            {Array.from({ length: 5 }, (_, index) => (
                              <span key={index} className={review.rating >= index + 1 ? 'active' : ''}>
                                ★
                              </span>
                            ))}
                          </div>
                          <span>{formatRelativeTime(review.createdAt, clockTick)}</span>
                        </div>

                        <p>{review.comment}</p>

                        {reviewImages.length ? (
                          <div className={`review-photo-grid count-${Math.min(reviewImages.length, 4)}`}>
                            {reviewImages.slice(0, 4).map((photoUrl, index) => {
                              const extraCount = reviewImages.length - 4;
                              const isLast = index === 3 && extraCount > 0;

                              return (
                                <button
                                  key={`${photoUrl}-${index}`}
                                  type="button"
                                  className={`review-photo-tile ${isLast ? 'has-more' : ''}`}
                                  onClick={() => openReviewPhotoViewer(review.id, index)}
                                >
                                  <img src={photoUrl} alt={`Foto review ${index + 1}`} />
                                  {isLast ? <span>+{extraCount}</span> : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}

                        <div className="review-actions">
                          <button type="button" onClick={() => void handleLikeReview(review.id)}>
                            {review.likesCount ?? 0} suka
                          </button>
                        </div>
                        {isAdminMode ? (
                          <div className="admin-review-actions">
                            <button type="button" onClick={() => openReviewEditor(selectedCafe.id, review)}>
                              Edit komentar
                            </button>
                            <button type="button" onClick={() => void handleDeleteReview(selectedCafe.id, review.id)}>
                              Hapus komentar
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">Belum ada review lain untuk coffeeshop ini.</div>
              )}
            </section>

          </section>
        ) : (
          <div className="empty-state">Cofeeshop tidak ditemukan.</div>
        )}

        <button
          className="floating-recommendation-button"
          type="button"
          onClick={() => setIsRecommendationOpen(true)}
          aria-label="Tambahkan rekomendasi"
        >
          <span className="floating-recommendation-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M5.5 4.5h13A2.5 2.5 0 0 1 21 7v7.5A2.5 2.5 0 0 1 18.5 17H12l-4.5 3.5V17H5.5A2.5 2.5 0 0 1 3 14.5V7A2.5 2.5 0 0 1 5.5 4.5Z" />
              <circle cx="8.25" cy="10" r="1.1" />
              <circle cx="12" cy="10" r="1.1" />
              <circle cx="15.75" cy="10" r="1.1" />
            </svg>
          </span>
          <span>Tambahkan rekomendasi</span>
        </button>

        {photoViewer && activePhotoViewerImages.length && activePhotoViewerReview ? (
          <div className="modal-backdrop gallery-backdrop" onClick={closeReviewPhotoViewer}>
            <div className="gallery-viewer" onClick={(event) => event.stopPropagation()}>
              <div className="gallery-viewer-head">
                <div>
                  <span className="section-kicker">Galeri foto review</span>
                  <h2>{activePhotoViewerReview.name}</h2>
                </div>
                <button className="modal-close" type="button" onClick={closeReviewPhotoViewer} aria-label="Tutup galeri">
                  ×
                </button>
              </div>

              <div className="gallery-viewer-stage">
                <button type="button" className="gallery-nav" onClick={goToPreviousReviewPhoto} aria-label="Foto sebelumnya">
                  ‹
                </button>
                <img
                  src={activePhotoViewerImages[photoViewer.index] ?? activePhotoViewerImages[0]}
                  alt={`${activePhotoViewerReview.name} foto ${photoViewer.index + 1}`}
                />
                <button type="button" className="gallery-nav" onClick={goToNextReviewPhoto} aria-label="Foto selanjutnya">
                  ›
                </button>
              </div>

              <div className="gallery-viewer-foot">
                <span>
                  {photoViewer.index + 1} / {activePhotoViewerImages.length}
                </span>
                <div className="gallery-dots" aria-label="Urutan foto">
                  {activePhotoViewerImages.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={index === photoViewer.index ? 'active' : ''}
                      onClick={() => setPhotoViewer({ reviewId: activePhotoViewerReview.id, index })}
                      aria-label={`Buka foto ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {detailPhotoViewerIndex !== null && selectedCafePhotos.length ? (
          <div className="modal-backdrop gallery-backdrop" onClick={closeDetailPhotoViewer}>
            <div className="gallery-viewer" onClick={(event) => event.stopPropagation()}>
              <div className="gallery-viewer-head">
                <div>
                  <span className="section-kicker">Preview foto coffeeshop</span>
                  <h2>{selectedCafe?.name}</h2>
                </div>
                <button className="modal-close" type="button" onClick={closeDetailPhotoViewer} aria-label="Tutup galeri">
                  ×
                </button>
              </div>

              <div className="gallery-viewer-stage">
                <button
                  type="button"
                  className="gallery-nav"
                  onClick={goToPreviousDetailPhotoViewer}
                  aria-label="Foto sebelumnya"
                  disabled={selectedCafePhotos.length <= 1}
                >
                  ‹
                </button>
                <img
                  src={selectedCafePhotos[detailPhotoViewerIndex] ?? selectedCafePhotos[0]}
                  alt={`${selectedCafe?.name} foto ${detailPhotoViewerIndex + 1}`}
                />
                <button
                  type="button"
                  className="gallery-nav"
                  onClick={goToNextDetailPhotoViewer}
                  aria-label="Foto selanjutnya"
                  disabled={selectedCafePhotos.length <= 1}
                >
                  ›
                </button>
              </div>

              <div className="gallery-viewer-foot">
                <span>
                  {detailPhotoViewerIndex + 1} / {selectedCafePhotos.length}
                </span>
                <div className="gallery-dots" aria-label="Urutan foto coffeeshop">
                  {selectedCafePhotos.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={index === detailPhotoViewerIndex ? 'active' : ''}
                      onClick={() => setDetailPhotoViewerIndex(index)}
                      aria-label={`Buka foto ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {deleteConfirm ? (
          <div className="modal-backdrop delete-backdrop" onClick={closeDeleteConfirm}>
            <div className="delete-modal" onClick={(event) => event.stopPropagation()}>
              <div className="delete-modal-icon">!</div>
              <div className="delete-modal-copy">
                <h2>
                  {deleteConfirm.type === 'cafe'
                    ? 'Hapus coffeeshop ini beserta semua review-nya?'
                    : 'Hapus review ini?'}
                </h2>
                <p>
                  {deleteConfirm.type === 'cafe'
                    ? 'Tindakan ini akan menghapus coffeeshop dan seluruh komentar yang terhubung.'
                    : 'Tindakan ini akan menghapus komentar ini dari halaman detail.'}
                </p>
              </div>
              <div className="delete-modal-actions">
                <button className="delete-modal-cancel" type="button" onClick={closeDeleteConfirm}>
                  Cancel
                </button>
                <button className="delete-modal-okay" type="button" onClick={() => void confirmDelete()}>
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isAdminLoginOpen ? (
          <div className="modal-backdrop" onClick={closeAdminLogin}>
            <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <span className="section-kicker">Administrator</span>
                  <h2>{isAdminMode ? 'Mode admin aktif' : 'Login administrator'}</h2>
                </div>
                <button className="modal-close" type="button" onClick={closeAdminLogin} aria-label="Tutup modal">
                  ×
                </button>
              </div>

              {isAdminMode ? (
                <div className="admin-status-panel">
                  <div className="admin-status-card">
                    <strong>Mode admin aktif</strong>
                    <p>Gallery, detail coffeeshop, dan komentar sekarang bisa diedit atau dihapus.</p>
                  </div>
                  <div className="modal-actions">
                    <button className="modal-secondary" type="button" onClick={handleAdminLogout}>
                      Logout
                    </button>
                    <button className="submit-button" type="button" onClick={closeAdminLogin}>
                      Tutup
                    </button>
                  </div>
                </div>
              ) : (
                <form className="admin-login-form" onSubmit={handleAdminLogin}>
                  <p className="admin-login-note">
                    Gunakan akun administrator tetap untuk mengelola coffeeshop dan komentar dari perangkat mana pun.
                  </p>
                  <div className="admin-login-grid">
                    <label>
                      Username
                      <input
                        required
                        value={adminLoginName}
                        onChange={(event) => setAdminLoginName(event.target.value)}
                        autoComplete="username"
                        placeholder="Masukkan username"
                      />
                    </label>
                    <label>
                      Password
                      <input
                        required
                        type="password"
                        value={adminLoginPassword}
                        onChange={(event) => setAdminLoginPassword(event.target.value)}
                        autoComplete="current-password"
                        placeholder="Masukkan password"
                      />
                    </label>
                  </div>
                  {adminLoginError ? <div className="empty-state error-state">{adminLoginError}</div> : null}
                  <div className="modal-actions">
                    <button className="modal-secondary" type="button" onClick={closeAdminLogin}>
                      Batal
                    </button>
                    <button className="submit-button" type="submit">
                      Masuk admin
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : null}

        {adminEditor?.type === 'cafe' ? (
          <div className="modal-backdrop" onClick={closeAdminEditor}>
            <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <span className="section-kicker">Edit coffeeshop</span>
                  <h2>Ubah detail coffeeshop</h2>
                </div>
                <button className="modal-close" type="button" onClick={closeAdminEditor} aria-label="Tutup modal">
                  ×
                </button>
              </div>

              <form className="recommendation-form" onSubmit={handleCafeEditSubmit}>
                <div className="modal-grid">
                  <label>
                    Nama user
                    <input
                      required
                      value={adminCafeForm.userName}
                      onChange={(event) => setAdminCafeForm({ ...adminCafeForm, userName: event.target.value })}
                      placeholder="Nama kamu"
                    />
                  </label>
                  <label>
                    Nama Coffeeshop
                    <input
                      required
                      value={adminCafeForm.coffeeShopName}
                      onChange={(event) =>
                        setAdminCafeForm({ ...adminCafeForm, coffeeShopName: event.target.value })
                      }
                        placeholder="Nama coffeeshop"
                    />
                  </label>
                  <label>
                    Lokasi Coffeeshop
                    <input
                      required
                      value={adminCafeForm.location}
                      onChange={(event) => setAdminCafeForm({ ...adminCafeForm, location: event.target.value })}
                      placeholder="Contoh: Bandung"
                    />
                  </label>
                  <label>
                    Alamat Coffeeshop
                    <input
                      required
                      value={adminCafeForm.address}
                      onChange={(event) => setAdminCafeForm({ ...adminCafeForm, address: event.target.value })}
                      placeholder="Alamat lengkap"
                    />
                  </label>
                  <label>
                    Jam buka Coffeeshop
                    <input
                      required
                      value={adminCafeForm.openHours}
                      onChange={(event) => setAdminCafeForm({ ...adminCafeForm, openHours: event.target.value })}
                      placeholder="Contoh: 08.00 - 22.00"
                    />
                  </label>
                  <label>
                    Tipe Coffeeshop
                    <select
                      required
                      value={adminCafeForm.price}
                      onChange={(event) => setAdminCafeForm({ ...adminCafeForm, price: event.target.value })}
                    >
                      <option value="Murah">Murah</option>
                      <option value="Terjangkau">Terjangkau</option>
                      <option value="Mahal">Mahal</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </label>
                </div>

                <div className="modal-section">
                  <div className="modal-section-head">
                    <span className="modal-label">Titik lokasi Coffeeshop</span>
                    <button
                      type="button"
                      className="map-clear-button"
                      onClick={() => setAdminCafeForm({ ...adminCafeForm, latitude: undefined, longitude: undefined })}
                    >
                      Reset titik
                    </button>
                  </div>
                  <div className="map-coordinate-readout">
                    {typeof adminCafeForm.latitude === 'number' && typeof adminCafeForm.longitude === 'number'
                      ? `${adminCafeForm.latitude.toFixed(6)}, ${adminCafeForm.longitude.toFixed(6)}`
                      : 'Belum ada titik dipilih'}
                  </div>
                  <LocationPickerMap
                    value={
                      typeof adminCafeForm.latitude === 'number' && typeof adminCafeForm.longitude === 'number'
                        ? { latitude: adminCafeForm.latitude, longitude: adminCafeForm.longitude }
                        : undefined
                    }
                    locationLabel={adminCafeForm.location}
                    onChange={({ latitude, longitude }) =>
                      setAdminCafeForm({
                        ...adminCafeForm,
                        latitude,
                        longitude,
                      })
                    }
                  />
                </div>

                <div className="modal-section">
                  <span className="modal-label">Rating</span>
                  <div className="star-rating" aria-label="rating">
                    {recommendationStars.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`star-button ${adminCafeForm.rating >= value ? 'active' : ''}`}
                        onClick={() => setAdminCafeForm({ ...adminCafeForm, rating: value })}
                        aria-label={`${value} bintang`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="rating-hint">{adminCafeForm.rating}/5</span>
                  </div>
                </div>

                <div className="modal-section">
                  <span className="modal-label">Checklist kebutuhan WFC</span>
                  <div className="checklist-grid">
                    {recommendationChecklist.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`check-pill ${adminCafeForm.checklist.includes(item) ? 'active' : ''}`}
                        onClick={() => toggleAdminCafeChecklist(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <label>
                  Review tentang coffeeshop
                  <textarea
                    required
                    rows={4}
                    value={adminCafeForm.review}
                    onChange={(event) => setAdminCafeForm({ ...adminCafeForm, review: event.target.value })}
                    placeholder="Ceritakan kenapa coffeeshop ini cocok untuk WFC..."
                  />
                </label>

                <div className="modal-section">
                  <div className="modal-section-head">
                    <span className="modal-label">Foto Coffeeshop</span>
                    <span className="muted">Maksimal 5 foto: depan, dalam, ambience, menu, vibes</span>
                  </div>
                  <div className="photo-manage-grid">
                    {adminCafeEditPhotos.map((photo, index) => (
                      <div key={photo.id} className="photo-manage-card">
                        <img src={photo.previewUrl} alt={`Foto coffeeshop ${index + 1}`} />
                        <div className="photo-manage-meta">
                          <span>{photo.source === 'existing' ? 'Foto tersimpan' : 'Foto baru'}</span>
                          <span>
                            {index + 1}/{adminCafeEditPhotos.length}
                          </span>
                        </div>
                        <div className="photo-manage-actions">
                          <label className="photo-action photo-action-secondary">
                            Ganti
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                void handleAdminCafeEditPhotoReplace(index, event.target.files);
                                event.currentTarget.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="photo-action"
                            onClick={() => moveAdminCafeEditPhoto(index, -1)}
                            disabled={index === 0}
                          >
                            Naik
                          </button>
                          <button
                            type="button"
                            className="photo-action"
                            onClick={() => moveAdminCafeEditPhoto(index, 1)}
                            disabled={index === adminCafeEditPhotos.length - 1}
                          >
                            Turun
                          </button>
                          <button
                            type="button"
                            className="photo-action photo-action-danger"
                            onClick={() => removeAdminCafeEditPhoto(index)}
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                    {adminCafeEditPhotos.length < 5 ? (
                      <label className="photo-add-card">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) => {
                            void handleAdminCafeEditPhotoUpload(event.target.files);
                            event.currentTarget.value = '';
                          }}
                          disabled={adminCafeEditPhotos.length >= 5}
                        />
                        <span>Tambah foto</span>
                        <small>Upload maksimal 5 foto</small>
                      </label>
                    ) : null}
                  </div>
                </div>

                <div className="modal-section">
                  <span className="modal-label">Pilihan rekomendasi</span>
                  <div className="vote-row">
                    <button
                      type="button"
                      className={`vote-button ${adminCafeForm.recommendationVote === 'like' ? 'active' : ''}`}
                      onClick={() => setAdminCafeForm({ ...adminCafeForm, recommendationVote: 'like' })}
                    >
                      Direkomendasikan
                    </button>
                    <button
                      type="button"
                      className={`vote-button ${adminCafeForm.recommendationVote === 'dislike' ? 'active' : ''}`}
                      onClick={() => setAdminCafeForm({ ...adminCafeForm, recommendationVote: 'dislike' })}
                    >
                      Tidak direkomendasikan
                    </button>
                  </div>
                </div>

                {adminActionError ? <div className="empty-state error-state">{adminActionError}</div> : null}

                <div className="modal-actions">
                  <button className="modal-secondary" type="button" onClick={closeAdminEditor}>
                    Batal
                  </button>
                  <button className="submit-button" type="submit">
                    Simpan perubahan
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {adminEditor?.type === 'review' ? (
          <div className="modal-backdrop" onClick={closeAdminEditor}>
            <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <span className="section-kicker">Edit komentar</span>
                  <h2>Ubah review</h2>
                </div>
                <button className="modal-close" type="button" onClick={closeAdminEditor} aria-label="Tutup modal">
                  ×
                </button>
              </div>

              <form className="recommendation-form" onSubmit={handleReviewEditSubmit}>
                <div className="modal-grid">
                  <label>
                    Nama
                    <input
                      required
                      value={adminReviewForm.name}
                      onChange={(event) => setAdminReviewForm({ ...adminReviewForm, name: event.target.value })}
                    />
                  </label>
                  <label>
                    Rating
                    <select
                      required
                      value={adminReviewForm.rating}
                      onChange={(event) =>
                        setAdminReviewForm({ ...adminReviewForm, rating: Number(event.target.value) })
                      }
                    >
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value} bintang
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Komentar
                  <textarea
                    required
                    rows={4}
                    value={adminReviewForm.comment}
                    onChange={(event) => setAdminReviewForm({ ...adminReviewForm, comment: event.target.value })}
                  />
                </label>
                <label>
                  Rekomendasi
                  <select
                    value={adminReviewForm.recommendationVote}
                    onChange={(event) =>
                      setAdminReviewForm({
                        ...adminReviewForm,
                        recommendationVote: event.target.value as RecommendationVote,
                      })
                    }
                  >
                    <option value="like">Direkomendasikan</option>
                    <option value="dislike">Tidak direkomendasikan</option>
                  </select>
                </label>

                {adminActionError ? <div className="empty-state error-state">{adminActionError}</div> : null}

                <div className="modal-actions">
                  <button className="modal-secondary" type="button" onClick={closeAdminEditor}>
                    Batal
                  </button>
                  <button className="submit-button" type="submit">
                    Simpan komentar
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {isRecommendationOpen ? (
          <div className="modal-backdrop" onClick={() => setIsRecommendationOpen(false)}>
            <div className="recommendation-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <span className="section-kicker">Rekomendasi</span>
                  <h2>Tambahkan coffeeshop WFC</h2>
                </div>
                <button className="modal-close" type="button" onClick={() => setIsRecommendationOpen(false)} aria-label="Tutup modal">
                  ×
                </button>
              </div>

              <form className="recommendation-form" onSubmit={handleRecommendationSubmit}>
                <div className="modal-grid">
                  <label>
                    Nama user
                    <input
                      required
                      value={recommendationForm.userName}
                      onChange={(event) => setRecommendationForm({ ...recommendationForm, userName: event.target.value })}
                      placeholder="Nama kamu"
                    />
                  </label>
                  <label>
                    Nama Coffeeshop
                    <input
                      required
                      value={recommendationForm.coffeeShopName}
                      onChange={(event) =>
                        setRecommendationForm({ ...recommendationForm, coffeeShopName: event.target.value })
                      }
                      placeholder="Nama coffee shop"
                    />
                  </label>
                  <label>
                    Lokasi Coffeeshop
                    <input
                      required
                      value={recommendationForm.location}
                      onChange={(event) => setRecommendationForm({ ...recommendationForm, location: event.target.value })}
                      placeholder="Contoh: Bandung"
                    />
                  </label>
                  <label>
                    Alamat Coffeeshop
                    <input
                      required
                      value={recommendationForm.address}
                      onChange={(event) => setRecommendationForm({ ...recommendationForm, address: event.target.value })}
                      placeholder="Alamat lengkap"
                    />
                  </label>
                  <label>
                    Jam buka Coffeeshop
                    <input
                      required
                      value={recommendationForm.openHours}
                      onChange={(event) =>
                        setRecommendationForm({ ...recommendationForm, openHours: event.target.value })
                      }
                      placeholder="Contoh: 08.00 - 22.00"
                    />
                  </label>
                  <label>
                    Tipe Coffeeshop
                    <select
                      required
                      value={recommendationForm.price}
                      onChange={(event) => setRecommendationForm({ ...recommendationForm, price: event.target.value })}
                    >
                      <option value="Murah">Murah</option>
                      <option value="Terjangkau">Terjangkau</option>
                      <option value="Mahal">Mahal</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </label>
                </div>

                <div className="modal-section">
                  <div className="modal-section-head">
                    <span className="modal-label">Titik lokasi Coffeeshop</span>
                    <button
                      type="button"
                      className="map-clear-button"
                      onClick={() =>
                        setRecommendationForm({ ...recommendationForm, latitude: undefined, longitude: undefined })
                      }
                    >
                      Reset titik
                    </button>
                  </div>
                  <div className="map-coordinate-readout">
                    {typeof recommendationForm.latitude === 'number' && typeof recommendationForm.longitude === 'number'
                      ? `${recommendationForm.latitude.toFixed(6)}, ${recommendationForm.longitude.toFixed(6)}`
                      : 'Belum ada titik dipilih'}
                  </div>
                  <LocationPickerMap
                    value={
                      typeof recommendationForm.latitude === 'number' &&
                      typeof recommendationForm.longitude === 'number'
                        ? { latitude: recommendationForm.latitude, longitude: recommendationForm.longitude }
                        : undefined
                    }
                    locationLabel={recommendationForm.location}
                    onChange={({ latitude, longitude }) =>
                      setRecommendationForm({
                        ...recommendationForm,
                        latitude,
                        longitude,
                      })
                    }
                  />
                </div>

                <div className="modal-section">
                  <span className="modal-label">Rating</span>
                  <div className="star-rating" aria-label="rating">
                    {recommendationStars.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`star-button ${recommendationForm.rating >= value ? 'active' : ''}`}
                        onClick={() => setRecommendationForm({ ...recommendationForm, rating: value })}
                        aria-label={`${value} bintang`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="rating-hint">{recommendationForm.rating}/5</span>
                  </div>
                </div>

                <div className="modal-section">
                  <span className="modal-label">Checklist kebutuhan WFC</span>
                  <div className="checklist-grid">
                    {recommendationChecklist.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`check-pill ${recommendationForm.checklist.includes(item) ? 'active' : ''}`}
                        onClick={() => toggleRecommendationChecklist(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <label>
                  Review tentang coffeeshop
                  <textarea
                    required
                    rows={4}
                    value={recommendationForm.review}
                    onChange={(event) => setRecommendationForm({ ...recommendationForm, review: event.target.value })}
                    placeholder="Ceritakan kenapa coffeeshop ini cocok untuk WFC..."
                  />
                </label>

                <div className="modal-section">
                  <div className="modal-section-head">
                    <span className="modal-label">Foto Coffeeshop</span>
                    <span className="muted">Maksimal 5 foto: depan, dalam, ambience, menu, vibes</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => {
                      void handleRecommendationPhotoUpload(event.target.files);
                    }}
                    disabled={recommendationPhotos.length >= 5}
                  />
                  <div className="photo-preview-grid">
                    {recommendationPhotos.map((photo, index) => (
                      <div key={`${photo.previewUrl}-${index}`} className="photo-preview">
                        <img src={photo.previewUrl} alt={`Preview ${index + 1}`} />
                        <button type="button" className="photo-remove" onClick={() => removeRecommendationPhoto(index)}>
                          Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="modal-section">
                  <span className="modal-label">Pilihan rekomendasi</span>
                  <div className="vote-row">
                    <button
                      type="button"
                      className={`vote-button ${recommendationForm.recommendationVote === 'like' ? 'active' : ''}`}
                      onClick={() => setRecommendationForm({ ...recommendationForm, recommendationVote: 'like' })}
                    >
                      Direkomendasikan
                    </button>
                    <button
                      type="button"
                      className={`vote-button ${recommendationForm.recommendationVote === 'dislike' ? 'active' : ''}`}
                      onClick={() =>
                        setRecommendationForm({ ...recommendationForm, recommendationVote: 'dislike' })
                      }
                    >
                      Tidak direkomendasikan
                    </button>
                  </div>
                </div>

                {recommendationError ? <div className="empty-state error-state">{recommendationError}</div> : null}

                <div className="modal-actions">
                  <button className="modal-secondary" type="button" onClick={() => setIsRecommendationOpen(false)}>
                    Batal
                  </button>
                  <button className="submit-button" type="submit" disabled={isRecommendationSubmitting}>
                    {isRecommendationSubmitting ? 'Menyimpan...' : 'Simpan rekomendasi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {isReviewOpen && selectedCafe ? (
          <div className="modal-backdrop" onClick={() => setIsReviewOpen(false)}>
            <div className="recommendation-modal review-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <span className="section-kicker">Review</span>
                  <h2>Tulis review</h2>
                </div>
                <button className="modal-close" type="button" onClick={() => setIsReviewOpen(false)} aria-label="Tutup modal">
                  ×
                </button>
              </div>

              <form className="recommendation-form" onSubmit={handleReviewSubmit}>
                <div className="modal-grid">
                  <label>
                    Nama
                    <input
                      required
                      value={reviewForm.name}
                      onChange={(event) => setReviewForm({ ...reviewForm, name: event.target.value })}
                      placeholder="Nama kamu"
                    />
                  </label>
                  <label>
                    Rating
                    <div className="star-rating" aria-label="rating">
                      {recommendationStars.map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={`star-button ${reviewForm.rating >= value ? 'active' : ''}`}
                          onClick={() => setReviewForm({ ...reviewForm, rating: value })}
                          aria-label={`${value} bintang`}
                        >
                          ★
                        </button>
                      ))}
                      <span className="rating-hint">{reviewForm.rating}/5</span>
                    </div>
                  </label>
                </div>

                <label>
                  Review
                  <textarea
                    required
                    rows={4}
                    value={reviewForm.comment}
                    onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })}
                    placeholder="Ceritakan suasana, wifi, colokan, dan kenyamanan kerja..."
                  />
                </label>

                <div className="modal-section">
                  <div className="modal-section-head">
                    <span className="modal-label">Foto review</span>
                    <span className="muted">Maksimal 5 foto</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => {
                      void handleReviewPhotoUpload(event.target.files);
                    }}
                    disabled={reviewPhotos.length >= 5}
                  />
                  <div className="photo-preview-grid">
                    {reviewPhotos.map((photo, index) => (
                      <div key={`${photo.previewUrl}-${index}`} className="photo-preview">
                        <img src={photo.previewUrl} alt={`Preview review ${index + 1}`} />
                        <button type="button" className="photo-remove" onClick={() => removeReviewPhoto(index)}>
                          Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {reviewError ? <div className="empty-state error-state">{reviewError}</div> : null}

                <div className="modal-actions">
                  <button className="modal-secondary" type="button" onClick={() => setIsReviewOpen(false)}>
                    Batal
                  </button>
                  <button className="submit-button" type="submit" disabled={isReviewSubmitting}>
                    {isReviewSubmitting ? 'Menyimpan...' : 'Simpan review'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default App;
