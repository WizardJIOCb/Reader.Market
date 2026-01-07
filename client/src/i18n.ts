import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from './locales/en/common.json';
import enNavigation from './locales/en/navigation.json';
import enProfile from './locales/en/profile.json';
import enNotifications from './locales/en/notifications.json';
import enShelves from './locales/en/shelves.json';
import enSearch from './locales/en/search.json';
import enMessages from './locales/en/messages.json';
import enHome from './locales/en/home.json';
import enAbout from './locales/en/about.json';
import enLanding from './locales/en/landing.json';
import enBooks from './locales/en/books.json';

import ruCommon from './locales/ru/common.json';
import ruNavigation from './locales/ru/navigation.json';
import ruProfile from './locales/ru/profile.json';
import ruNotifications from './locales/ru/notifications.json';
import ruShelves from './locales/ru/shelves.json';
import ruSearch from './locales/ru/search.json';
import ruMessages from './locales/ru/messages.json';
import ruHome from './locales/ru/home.json';
import ruAbout from './locales/ru/about.json';
import ruLanding from './locales/ru/landing.json';
import ruBooks from './locales/ru/books.json';

// Define resources
const resources = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    profile: enProfile,
    notifications: enNotifications,
    shelves: enShelves,
    search: enSearch,
    messages: enMessages,
    home: enHome,
    about: enAbout,
    landing: enLanding,
    books: enBooks,
  },
  ru: {
    common: ruCommon,
    navigation: ruNavigation,
    profile: ruProfile,
    notifications: ruNotifications,
    shelves: ruShelves,
    search: ruSearch,
    messages: ruMessages,
    home: ruHome,
    about: ruAbout,
    landing: ruLanding,
    books: ruBooks,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'navigation', 'profile', 'notifications', 'shelves', 'search', 'messages', 'home', 'about', 'landing', 'books'],
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    
    react: {
      useSuspense: false,
    },
  });

export default i18n;
