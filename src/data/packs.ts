// src/data/packs.ts
import { Category } from '../types';

export type Pack = {
  id: string;
  title: string;
  price: number;
  features: string[];
  category: Category;
  demoUrl?: string;
};

export const FEATURED_IDS = ['basic', 'standard', 'premium'] as const;

export const ALL_PACKS: Pack[] = [
  { id: 'basic',      title: 'E-Ticaret Temel',    price: 299,  features: ['10 Ürün', 'Temel Tema', 'SSL Sertifikası'], category: 'Temel' },
  { id: 'starter',    title: 'Başlangıç',          price: 399,  features: ['50 Ürün', 'Tema Seçimi', 'SSL Sertifikası'], category: 'Temel' },
  { id: 'standard',   title: 'E-Ticaret Standart', price: 599,  features: ['Sınırsız Ürün', 'Gelişmiş Tema', 'Çoklu Kargo'], category: 'Standart' },
  { id: 'pro',        title: 'Pro',                price: 899,  features: ['Sınırsız Ürün', 'Blog', 'Canlı Destek'], category: 'Premium' },
  { id: 'premium',    title: 'Premium',            price: 1299, features: ['B2B Modülü', 'Pazaryeri Entegrasyonu', 'Raporlama'], category: 'Premium' },
  { id: 'enterprise', title: 'Kurumsal',           price: 1999, features: ['Kurumsal SLA', 'SAML SSO', 'Özel Geliştirme'], category: 'Kurumsal' },
];
