# UI Translation to English and Language Selection Feature

## Overview

This design addresses the requirement to translate all remaining Russian text in the user interface to English and implement a language selection feature in the user profile that allows switching between English and Russian interfaces.

## Background

The application currently contains mixed language content - some components use English while navigation menu items and various UI elements still display Russian text. The goal is to:

1. Translate all remaining Russian text in the frontend to English
2. Implement a language selection system allowing users to choose between English and Russian
3. Persist the language preference per user

## Goals

- Complete translation of all Russian UI text to English
- Implement internationalization (i18n) infrastructure
- Add language preference selection in user profile
- Ensure consistent language display across all components
- Maintain user language preference across sessions

## Requirements

### Functional Requirements

1. **Complete UI Translation**
   - Translate all navigation menu items (Главная, Поиск, Мои полки, О проекте, Сообщения, Профиль)
   - Translate all page titles and headers
   - Translate all form labels, placeholders, and buttons
   - Translate all toast notifications and error messages
   - Translate all static text content

2. **Language Selection System**
   - Add language preference option in user profile settings
   - Support English (en) and Russian (ru) languages initially
   - Display language selector with clear language labels
   - Apply selected language immediately across the interface

3. **User Preference Persistence**
   - Store language preference in user profile
   - Load user's language preference on authentication
   - Default to English for unauthenticated users or users without preference
   - Sync language preference across all user sessions

### Non-Functional Requirements

1. **Performance**
   - Language switching should be instant without page reload
   - Translation files should be loaded efficiently
   - No significant performance impact on page load times

2. **Scalability**
   - i18n infrastructure should support adding more languages in the future
   - Translation key structure should be maintainable and organized

3. **User Experience**
   - Language selection should be intuitive and easily accessible
   - Interface should update completely when language is changed
   - No mixed-language content should appear after language selection

## Current State Analysis

### Russian Text Locations Identified

**Navigation Components:**
- Navbar.tsx: Главная, Поиск, Мои полки, О проекте, Сообщения, Профиль
- MobileMenu.tsx: Same menu items plus screen reader labels (Открыть меню, Закрыть меню)

**Page Components:**
- Search.tsx: "Глобальный Поиск"
- Shelves.tsx: "Мои полки", "Поиск книг..."
- Profile.tsx: Multiple Russian labels including form labels, buttons, and status messages
- Messages.tsx: Search placeholders for users and groups

**Form Elements:**
- Various search placeholders
- Button labels
- Form field labels
- Status messages

**Toast Notifications:**
- Profile.tsx: "Профиль обновлен", "Сообщение отправлено", "Ошибка", "Аватар обновлен", "Ссылка скопирована"
- Various error and success messages throughout the application

## Design Solution

### Internationalization (i18n) Architecture

#### Technology Choice

Use **react-i18next** library which provides:
- React hooks integration
- Component-based translation
- Context-based language switching
- TypeScript support
- Lazy loading of translation files

#### Translation File Structure

Organize translations by feature/component domain:

```
client/src/locales/
├── en/
│   ├── common.json          # Common UI elements
│   ├── navigation.json      # Navigation menu items
│   ├── profile.json         # Profile page translations
│   ├── messages.json        # Messages feature translations
│   ├── books.json           # Book-related translations
│   ├── auth.json            # Authentication pages
│   ├── shelves.json         # Shelves page translations
│   └── notifications.json   # Toast notifications and alerts
└── ru/
    ├── common.json
    ├── navigation.json
    ├── profile.json
    ├── messages.json
    ├── books.json
    ├── auth.json
    ├── shelves.json
    └── notifications.json
```

#### Translation Key Structure

Use hierarchical dot notation for organization:

```
navigation.home
navigation.search
navigation.shelves
navigation.about
navigation.messages
navigation.profile

profile.editProfile
profile.saveProfile
profile.uploadAvatar
profile.bio
profile.fullName

notifications.success.profileUpdated
notifications.error.loadFailed
```

### Database Schema Extension

Extend the users table to store language preference:

**Table: users**

| Column | Type | Description |
|--------|------|-------------|
| language | varchar(10) | User's preferred language code (e.g., 'en', 'ru') |

Default value: 'en'

### API Endpoints

#### Update User Language Preference

**Endpoint:** `PUT /api/profile/language`

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| language | string | Yes | Language code ('en' or 'ru') |

**Response:**
| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Operation status |
| language | string | Updated language code |

**Status Codes:**
- 200: Successfully updated
- 400: Invalid language code
- 401: Unauthorized
- 500: Server error

### Frontend Implementation Strategy

#### i18n Configuration

Create centralized i18n configuration that:
- Initializes i18next with default language
- Loads translation resources
- Configures fallback language (English)
- Sets up detection of user preference

#### Language Provider Context

Wrap the application with i18n provider to:
- Make translation functions available throughout component tree
- Provide language switching functionality
- Track current language state

#### User Language Initialization

On application load:
1. Check if user is authenticated
2. If authenticated, load user's language preference from profile
3. If not authenticated, use browser language or default to English
4. Initialize i18n with determined language

#### Language Switching Flow

When user changes language preference:
1. Update UI immediately using i18n.changeLanguage()
2. If user is authenticated, persist preference via API
3. Show confirmation notification in new language
4. Ensure all components re-render with new translations

### UI Components Changes

#### Profile Page Language Selector

Add language selection section in profile page:

**Location:** Below profile statistics, above recently read books section

**Component Structure:**
- Section heading: "Language Preference" / "Язык интерфейса"
- Description text explaining language selection
- Radio button group or dropdown with language options:
  - English (English)
  - Русский (Russian)
- Save button or auto-save on selection change

**Visual Design:**
- Card layout consistent with profile sections
- Clear visual indication of selected language
- Immediate feedback when language changes

#### Component Translation Updates

All components requiring translation updates:

**Navigation Components:**
- Navbar: Replace all hardcoded Russian text with translation keys
- MobileMenu: Replace text and accessibility labels

**Page Components:**
- Profile: Replace all Russian labels, buttons, and messages
- Search: Replace page title and placeholder text
- Shelves: Replace page title and search placeholder
- Messages: Replace search placeholders and tab labels
- Login: Already in English, verify completeness
- Register: Already in English, verify completeness

**Shared Components:**
- PageHeader: Ensure it accepts translated titles
- BookCard: Verify genre and status labels support translation
- Toast notifications: Replace all hardcoded messages

### Translation Content Mapping

#### Navigation Translations

| Key | English | Russian |
|-----|---------|---------|
| navigation.home | Home | Главная |
| navigation.search | Search | Поиск |
| navigation.shelves | My Shelves | Мои полки |
| navigation.about | About Project | О проекте |
| navigation.messages | Messages | Сообщения |
| navigation.profile | Profile | Профиль |
| navigation.openMenu | Open menu | Открыть меню |
| navigation.closeMenu | Close menu | Закрыть меню |

#### Profile Page Translations

| Key | English | Russian |
|-----|---------|---------|
| profile.editProfile | Edit Profile | Редактировать профиль |
| profile.saveProfile | Save | Сохранить |
| profile.cancel | Cancel | Отмена |
| profile.uploadAvatar | Upload Avatar | Добавить аватар |
| profile.changeAvatar | Change Avatar | Изменить аватар |
| profile.deleteAvatar | Delete Avatar | Удалить аватар |
| profile.shareProfile | Share Profile | Поделиться профилем |
| profile.fullName | Full Name | Полное имя |
| profile.bio | About Me | О себе |
| profile.bioPlaceholder | Tell us about yourself... | Расскажите о себе... |
| profile.stats.booksRead | Books Read | Книг прочитано |
| profile.stats.wordsRead | Words Read | Слов прочитано |
| profile.stats.lettersRead | Letters Read | Букв прочитано |
| profile.recentlyRead | Recently Read | Недавно читал |
| profile.shelves | Bookshelves | Книжные полки |
| profile.emptyShelf | Shelf is empty | Полка пуста |
| profile.noRecentBooks | No recently read books | Нет недавно прочитанных книг |
| profile.loading | Loading... | Загрузка... |
| profile.notFound | Profile not found | Профиль не найден |
| profile.languagePreference | Language Preference | Язык интерфейса |

#### Notification Translations

| Key | English | Russian |
|-----|---------|---------|
| notifications.success.profileUpdated | Profile Updated | Профиль обновлен |
| notifications.success.profileDescription | Your profile was successfully updated | Ваш профиль успешно обновлен |
| notifications.success.messageSent | Message Sent | Сообщение отправлено |
| notifications.success.avatarUpdated | Avatar Updated | Аватар обновлен |
| notifications.success.avatarDescription | Your avatar was successfully uploaded | Ваш аватар успешно загружен |
| notifications.success.avatarDeleted | Avatar Deleted | Аватар удален |
| notifications.success.linkCopied | Link Copied | Ссылка скопирована |
| notifications.success.linkDescription | Profile link copied to clipboard | Ссылка на профиль скопирована |
| notifications.error.title | Error | Ошибка |
| notifications.error.loadFailed | Failed to load | Не удалось загрузить |
| notifications.error.updateFailed | Failed to update | Не удалось обновить |
| notifications.error.uploadFailed | Failed to upload | Не удалось загрузить |
| notifications.error.invalidImageFormat | Please upload JPEG, PNG, GIF or WebP image | Пожалуйста, загрузите изображение в формате JPEG, PNG, GIF или WebP |
| notifications.error.fileTooLarge | File size must not exceed 5MB | Размер файла не должен превышать 5MB |

#### Common UI Translations

| Key | English | Russian |
|-----|---------|---------|
| common.login | Login | Вход |
| common.register | Register | Регистрация |
| common.logout | Logout | Выход |
| common.loading | Loading... | Загрузка... |
| common.save | Save | Сохранить |
| common.cancel | Cancel | Отмена |
| common.edit | Edit | Редактировать |
| common.delete | Delete | Удалить |
| common.search | Search | Поиск |
| common.searchPlaceholder | Search... | Поиск... |

#### Shelves Page Translations

| Key | English | Russian |
|-----|---------|---------|
| shelves.title | My Shelves | Мои полки |
| shelves.searchBooks | Search books... | Поиск книг... |

#### Search Page Translations

| Key | English | Russian |
|-----|---------|---------|
| search.title | Global Search | Глобальный Поиск |

#### Messages Page Translations

| Key | English | Russian |
|-----|---------|---------|
| messages.searchUsers | Search users... | Поиск пользователей... |
| messages.searchGroups | Search groups... | Поиск групп... |

### Migration Strategy

Create database migration to add language column to users table:

**Migration Name:** `add_user_language_preference`

**Operations:**
1. Add `language` column to `users` table
2. Set default value to 'en'
3. Create index on language column for query optimization
4. Backfill existing users with 'en' as default language

## Implementation Workflow

### Phase 1: Infrastructure Setup

1. Install i18n dependencies (react-i18next, i18next)
2. Create translation file structure
3. Configure i18n initialization
4. Set up language provider context
5. Create database migration for language preference

### Phase 2: Translation Content Creation

1. Extract all Russian text from components
2. Create English translations
3. Organize translations into appropriate JSON files
4. Define translation key naming conventions
5. Document translation structure

### Phase 3: Component Updates

1. Update navigation components (Navbar, MobileMenu)
2. Update Profile page with translation keys
3. Update Search, Shelves, Messages pages
4. Update toast notifications throughout application
5. Update form labels and placeholders
6. Verify all Russian text is replaced

### Phase 4: Language Selection Feature

1. Implement API endpoint for language preference update
2. Add language selector UI in profile page
3. Implement language switching logic
4. Connect language preference to user profile
5. Test language persistence across sessions

### Phase 5: Testing and Validation

1. Verify all UI text translates correctly
2. Test language switching functionality
3. Verify language preference persistence
4. Test with different user states (authenticated/unauthenticated)
5. Ensure no mixed-language content appears
6. Test edge cases and error scenarios

## Edge Cases and Considerations

### Language Detection Priority

For unauthenticated users:
1. Check browser language setting
2. If browser language is supported (en/ru), use it
3. Otherwise, default to English

### Language Switching Timing

- Language changes should apply immediately to visible UI
- No page reload required
- All toast notifications after language change should use new language

### Partial Translation Fallback

If translation key is missing:
- Fall back to English translation
- Log missing translation for future addition
- Do not display translation keys to users

### User Profile Migration

For existing users without language preference:
- Default to English
- Allow users to change language preference anytime
- No forced language selection on first login

### RTL Language Support

Current implementation focuses on LTR languages (English, Russian):
- RTL support is not included in this phase
- Future RTL language additions would require layout adjustments

## Verification Criteria

### Translation Completeness

- No Russian text visible in UI when English is selected
- No English text visible in UI when Russian is selected (except proper nouns like "Reader.Market")
- All navigation menu items translated
- All form labels and placeholders translated
- All notification messages translated

### Functionality Verification

- Language selector appears in user profile
- Language selection persists across sessions
- Language applies immediately without page reload
- Unauthenticated users see interface in default/browser language
- API endpoint successfully updates language preference

### User Experience Validation

- Language switching is intuitive and clear
- No UI layout breaks with different languages
- Consistent translation quality across all pages
- No mixed-language content in any view

## Future Enhancements

### Additional Language Support

Framework supports adding more languages:
- Create new translation files in locales directory
- Add language option to profile selector
- No code changes required for new languages

### Dynamic Content Translation

For user-generated content (book descriptions, comments):
- Consider integration with translation API
- Provide "translate" button for user content
- Cache translations for performance

### Language-Specific Formatting

Consider locale-specific formatting for:
- Date and time display
- Number formatting (already using locale-aware formatters)
- Currency display if e-commerce features added

### Translation Management

For larger scale:
- Consider translation management platform integration
- Implement translation review workflow
- Track translation coverage metrics

## Dependencies

### External Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| react-i18next | Latest stable | React integration for i18next |
| i18next | Latest stable | Core internationalization framework |
| i18next-browser-languagedetector | Latest stable | Browser language detection |

### Internal Dependencies

- User authentication system (to load user preferences)
- Profile API (to persist language preference)
- Database migration system (to add language column)

## Risk Assessment

### Low Risk

- Translation infrastructure is well-established pattern
- Limited number of languages reduces complexity
- Fallback mechanisms ensure UI always displays text

### Medium Risk

- Incomplete translation could result in mixed-language UI
- Translation quality depends on accurate content mapping
- Component re-renders on language change could impact performance

### Mitigation Strategies

- Comprehensive translation audit before deployment
- Automated tests to verify all translation keys exist
- Performance testing of language switching
- Staged rollout with monitoring

## Success Metrics

- 100% of UI text supports both English and Russian
- Language preference persists across 100% of user sessions
- Language switching completes in under 100ms
- Zero reports of mixed-language content
- User language preference successfully saved for 100% of attempts- Zero reports of mixed-language content
- User language preference successfully saved for 100% of attempts