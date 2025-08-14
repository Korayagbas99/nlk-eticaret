// src/assets/index.ts
import { ImageSourcePropType } from 'react-native';

/**
 * Asset manifest — bütün görseller tek yerden, sabit require() ile.
 * DİKKAT: Bu dosya src/assets/ altında. Root'taki /assets klasörüne çıkmak için ../../ kullanıyoruz.
 */
export const IMAGES: Record<string, ImageSourcePropType> = {
  logo: require('../../assets/nlk.png'),          // header logoları vb.
  splash: require('../../assets/splash.png'),     // Expo splash
  icon: require('../../assets/icon.png'),         // uygulama ikonu
  adaptiveIcon: require('../../assets/adaptive-icon.png'), // Android adaptive icon
  // favicon: require('../../assets/favicon.png'), // (opsiyonel, web için)
} as const;
