const CAFE_SHEET = 'cafes';
const REVIEW_SHEET = 'reviews';

function doGet() {
  ensureSchema();
  return jsonResponse(getCafePayload());
}

function doPost(e) {
  ensureSchema();
  const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

  if (body.action !== 'addReview') {
    if (body.action !== 'addRecommendation') {
      return jsonResponse({ error: 'Unsupported action' }, 400);
    }
  }

  if (body.action === 'addReview') {
    addReview(body.cafeId, body.review || {});
  } else if (body.action === 'likeReview') {
    likeReview(body.reviewId);
  } else {
    addRecommendation(body.recommendation || {});
  }

  return jsonResponse({ cafes: getCafePayload() });
}

function getCafePayload() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cafesSheet = ss.getSheetByName(CAFE_SHEET);
  const reviewsSheet = ss.getSheetByName(REVIEW_SHEET);

  if (!cafesSheet || !reviewsSheet) {
    throw new Error('Expected sheets "cafes" and "reviews".');
  }

  const cafes = rowsToObjects(cafesSheet);
  const reviews = rowsToObjects(reviewsSheet);
  const reviewsByCafe = new Map();

  reviews.forEach((review) => {
    const cafeReviews = reviewsByCafe.get(review.cafeId) || [];
    cafeReviews.push(review);
    reviewsByCafe.set(review.cafeId, cafeReviews);
  });

  return cafes.map((cafe) => ({
    ...cafe,
    tags: parseTags(cafe.tags),
    photoUrls: parsePhotoUrls(cafe.photoUrls),
    reviews: (reviewsByCafe.get(cafe.id) || []).sort(
      (left, right) => new Date(right.createdAt) - new Date(left.createdAt),
    ).map((review) => ({
      ...review,
      likesCount: Number(review.likesCount || 0),
    })),
  }));
}

function ensureSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cafesSheet = ss.getSheetByName(CAFE_SHEET) || ss.insertSheet(CAFE_SHEET);
  const reviewsSheet = ss.getSheetByName(REVIEW_SHEET) || ss.insertSheet(REVIEW_SHEET);

  ensureHeaders(cafesSheet, [
    'id',
    'name',
    'area',
    'location',
    'address',
    'vibe',
    'wifi',
    'price',
    'openHours',
    'tags',
    'image',
    'photoUrls',
  ]);

  ensureHeaders(reviewsSheet, [
    'id',
    'cafeId',
    'name',
    'rating',
    'comment',
    'photoUrl',
    'photoUrls',
    'likesCount',
    'recommendationVote',
    'createdAt',
  ]);
}

function ensureHeaders(sheet, headers) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  const currentValues = range.getValues()[0];
  const hasHeaders = headers.every((header, index) => currentValues[index] === header);

  if (!hasHeaders) {
    const firstRowHasContent = currentValues.some((value) => value !== '');
    if (firstRowHasContent) {
      sheet.insertRowBefore(1);
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function addReview(cafeId, review) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reviewsSheet = ss.getSheetByName(REVIEW_SHEET);

  if (!reviewsSheet) {
    throw new Error('Missing reviews sheet.');
  }

  reviewsSheet.appendRow([
    Utilities.getUuid(),
    cafeId,
    review.name || '',
    Number(review.rating || 0),
    review.comment || '',
    Number(review.likesCount || 0),
    review.photoUrl || '',
    JSON.stringify(Array.isArray(review.photoUrls) ? review.photoUrls : []),
    review.recommendationVote || '',
    new Date().toISOString(),
  ]);
}

function likeReview(reviewId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reviewsSheet = ss.getSheetByName(REVIEW_SHEET);

  if (!reviewsSheet) {
    throw new Error('Missing reviews sheet.');
  }

  const values = reviewsSheet.getDataRange().getValues();
  if (values.length < 2) {
    throw new Error('No review rows found.');
  }

  const [headers, ...rows] = values;
  const idColumn = headers.indexOf('id');
  const likesColumn = headers.indexOf('likesCount');

  if (idColumn < 0) {
    throw new Error('Missing id column.');
  }

  if (likesColumn < 0) {
    throw new Error('Missing likesCount column.');
  }

  const rowIndex = rows.findIndex((row) => row[idColumn] === reviewId);
  if (rowIndex < 0) {
    throw new Error('Review tidak ditemukan.');
  }

  const sheetRow = rowIndex + 2;
  const currentLikes = Number(rows[rowIndex][likesColumn] || 0);
  reviewsSheet.getRange(sheetRow, likesColumn + 1).setValue(currentLikes + 1);
}

function addRecommendation(recommendation) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cafesSheet = ss.getSheetByName(CAFE_SHEET);
  const reviewsSheet = ss.getSheetByName(REVIEW_SHEET);

  if (!cafesSheet || !reviewsSheet) {
    throw new Error('Expected sheets "cafes" and "reviews".');
  }

  const cafeId = Utilities.getUuid();
  const reviewId = Utilities.getUuid();
  const photoUrls = Array.isArray(recommendation.photoUrls) ? recommendation.photoUrls : [];
  const firstPhoto = photoUrls[0] || '';
  const checklist = Array.isArray(recommendation.checklist) ? recommendation.checklist : [];

  cafesSheet.appendRow([
    cafeId,
    recommendation.coffeeShopName || '',
    recommendation.location || '',
    recommendation.location || '',
    recommendation.address || '',
    recommendation.recommendationVote === 'like' ? 'direkomendasikan' : 'perlu dicek',
    checklist.includes('wifi cepat') ? 'cepat' : 'stabil',
    recommendation.price || (checklist.includes('harga terjangkau') ? 'Terjangkau' : 'Variatif'),
    recommendation.openHours || 'Berdasarkan info user',
    checklist.join(', '),
    firstPhoto,
    JSON.stringify(photoUrls),
  ]);

  reviewsSheet.appendRow([
    reviewId,
    cafeId,
    recommendation.userName || '',
    Number(recommendation.rating || 0),
    recommendation.review || '',
    0,
    firstPhoto,
    JSON.stringify(photoUrls),
    recommendation.recommendationVote || '',
    new Date().toISOString(),
  ]);
}

function rowsToObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const [headers, ...rows] = values;

  return rows
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) =>
      headers.reduce((accumulator, header, index) => {
        accumulator[String(header)] = row[index];
        return accumulator;
      }, {}),
    );
}

function parseTags(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parsePhotoUrls(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function jsonResponse(payload, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );

  if (statusCode && statusCode >= 400) {
    return output;
  }

  return output;
}
