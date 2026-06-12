import { Cafe } from './types';

export const initialCafes: Cafe[] = [
  {
    id: 'sorelatte',
    name: 'Sore Latte',
    area: 'Batu',
    vibe: 'tenang',
    wifi: 'stabil',
    price: 'Rp25-45k',
    openHours: '08.00-22.00',
    tags: ['Quiet corner', 'Colokan banyak', 'Cocok meeting'],
    image:
      'https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=1200&q=80',
    reviews: [
      {
        id: 'r1',
        cafeId: 'sorelatte',
        name: 'Rina',
        rating: 5,
        comment: 'Meja lega, internet kencang, cocok buat ngerjain proposal.',
        createdAt: '2026-06-06T08:00:00.000Z',
      },
      {
        id: 'r2',
        cafeId: 'sorelatte',
        name: 'Naufal',
        rating: 4,
        comment: 'Suasananya hening dan baristanya ramah.',
        createdAt: '2026-06-08T11:30:00.000Z',
      },
    ],
  },
  {
    id: 'hijauhouse',
    name: 'Hijau House',
    area: 'Malang',
    vibe: 'hangat',
    wifi: 'stabil',
    price: 'Rp20-40k',
    openHours: '09.00-21.00',
    tags: ['Natural light', 'Lantai dua', 'WFC friendly'],
    image:
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80',
    reviews: [
      {
        id: 'r3',
        cafeId: 'hijauhouse',
        name: 'Dita',
        rating: 5,
        comment: 'Pencahayaan enak buat kerja lama dan fokus.',
        createdAt: '2026-06-05T13:20:00.000Z',
      },
      {
        id: 'r4',
        cafeId: 'hijauhouse',
        name: 'Bima',
        rating: 5,
        comment: 'Ada spot sepi dan menu kopinya konsisten.',
        createdAt: '2026-06-09T10:15:00.000Z',
      },
      {
        id: 'r5',
        cafeId: 'hijauhouse',
        name: 'Salsa',
        rating: 4,
        comment: 'Bisa meeting santai tanpa terlalu ramai.',
        createdAt: '2026-06-10T09:05:00.000Z',
      },
    ],
  },
  {
    id: 'kebunpagi',
    name: 'Kebun Pagi',
    area: 'Surabaya',
    vibe: 'fresh',
    wifi: 'cepat',
    price: 'Rp30-55k',
    openHours: '07.30-23.00',
    tags: ['Outdoor indoor', 'Banyak colokan', 'Cemilan enak'],
    image:
      'https://images.unsplash.com/photo-1461988091159-192b6df7054f?auto=format&fit=crop&w=1200&q=80',
    reviews: [
      {
        id: 'r6',
        cafeId: 'kebunpagi',
        name: 'Yoga',
        rating: 4,
        comment: 'Tempatnya luas dan nyaman buat kerja berjam-jam.',
        createdAt: '2026-06-04T07:40:00.000Z',
      },
    ],
  },
  {
    id: 'ruangtumbuh',
    name: 'Ruang Tumbuh',
    area: 'Bandung',
    vibe: 'minimal',
    wifi: 'stabil',
    price: 'Rp28-50k',
    openHours: '10.00-22.00',
    tags: ['Silent zone', 'Minimal noise', 'Boarding meeting'],
    image:
      'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=80',
    reviews: [
      {
        id: 'r7',
        cafeId: 'ruangtumbuh',
        name: 'Maya',
        rating: 5,
        comment: 'Rasanya seperti ruang kerja kecil yang tenang.',
        createdAt: '2026-06-02T16:00:00.000Z',
      },
      {
        id: 'r8',
        cafeId: 'ruangtumbuh',
        name: 'Farhan',
        rating: 4,
        comment: 'Bagus untuk deep work, tidak terlalu bising.',
        createdAt: '2026-06-07T15:10:00.000Z',
      },
    ],
  },
];
