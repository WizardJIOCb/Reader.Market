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
import enStream from './locales/en/stream.json';
import enAuth from './locales/en/auth.json';
import enOAuth from './locales/en/oauth.json';
import enAdmin from './locales/en/admin.json';
import enUsers from './locales/en/users.json';
import enComments from './locales/en/comments.json';
import enReactions from './locales/en/reactions.json';
import enTts from './locales/en/tts.json';


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
import ruStream from './locales/ru/stream.json';
import ruAuth from './locales/ru/auth.json';
import ruOAuth from './locales/ru/oauth.json';
import ruAdmin from './locales/ru/admin.json';
import ruUsers from './locales/ru/users.json';
import ruComments from './locales/ru/comments.json';
import ruReactions from './locales/ru/reactions.json';
import ruTts from './locales/ru/tts.json';


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
    stream: enStream,
    auth: enAuth,
    oauth: enOAuth,
    admin: enAdmin,
    users: enUsers,
    comments: enComments,
    reactions: enReactions,
    tts: enTts
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
    stream: ruStream,
    auth: ruAuth,
    oauth: ruOAuth,
    admin: ruAdmin,
    users: ruUsers,
    comments: ruComments,
    reactions: ruReactions,
    tts: ruTts
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'navigation', 'profile', 'notifications', 'shelves', 'search', 'messages', 'home', 'about', 'landing', 'books', 'stream', 'auth', 'oauth', 'admin', 'users', 'comments', 'reactions', 'tts'],
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'i18nextLng',
    },
    
    react: {
      useSuspense: false,
    },
  });

export default i18n;
