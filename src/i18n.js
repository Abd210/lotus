import React from 'react';

const translations = {
  en: {
    tagline: 'Fine flavors. Modern lounge.',
    menuCategories: 'Menu Categories',
    contactUs: 'Contact Us',
    openingHours: 'Opening Hours',
    findUs: 'Find Us',
    getDirections: 'Get Directions',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    mondayThu: 'Monday–Thursday:',
    friSat: 'Friday–Saturday:',
    sunday: 'Sunday:',
    subcategories: 'Subcategories',
    products: 'Products',
    viewDetails: 'View Details',
    emptyCategoryTitle: 'This category is empty.',
    emptyCategoryDesc: 'No subcategories or products have been added yet.',
    productNotFound: 'Product not found',
    goBack: 'Go back',
    back: 'Back',
    goHome: 'Go to Home',
    description: 'Description'
  },
  ro: {
    tagline: 'Arome rafinate. Lounge modern.',
    menuCategories: 'Categorii meniu',
    contactUs: 'Contact',
    openingHours: 'Program',
    findUs: 'Găsește-ne',
    getDirections: 'Obține indicații',
    privacyPolicy: 'Politica de confidențialitate',
    termsOfService: 'Termeni și condiții',
    mondayThu: 'Luni–Joi:',
    friSat: 'Vineri–Sâmbătă:',
    sunday: 'Duminică:',
    subcategories: 'Subcategorii',
    products: 'Produse',
    viewDetails: 'Vezi detalii',
    emptyCategoryTitle: 'Această categorie este goală.',
    emptyCategoryDesc: 'Nu au fost adăugate încă subcategorii sau produse.',
    productNotFound: 'Produsul nu a fost găsit',
    goBack: 'Înapoi',
    back: 'Înapoi',
    goHome: 'Mergi la Acasă',
    description: 'Descriere'
  },
  ar: {
    tagline: 'نكهات راقية. صالة عصرية.',
    menuCategories: 'فئات القائمة',
    contactUs: 'اتصل بنا',
    openingHours: 'ساعات العمل',
    findUs: 'موقعنا',
    getDirections: 'احصل على الاتجاهات',
    privacyPolicy: 'سياسة الخصوصية',
    termsOfService: 'شروط الخدمة',
    mondayThu: 'الإثنين–الخميس:',
    friSat: 'الجمعة–السبت:',
    sunday: 'الأحد:',
    subcategories: 'الفئات الفرعية',
    products: 'المنتجات',
    viewDetails: 'عرض التفاصيل',
    emptyCategoryTitle: 'هذه الفئة فارغة.',
    emptyCategoryDesc: 'لم تتم إضافة فئات فرعية أو منتجات بعد.',
    productNotFound: 'المنتج غير موجود',
    goBack: 'العودة',
    back: 'رجوع',
    goHome: 'الذهاب إلى الرئيسية',
    description: 'الوصف'
  }
};

const I18nContext = React.createContext({
  lang: 'ro',
  t: (k) => translations.ro[k] || k,
  setLang: () => {},
  toggleLang: () => {},
});

function detectInitialLang() {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('lang') : null;
  if (saved && (saved === 'ar' || saved === 'ro' || saved === 'en')) return saved;
  const nav = typeof navigator !== 'undefined' ? navigator.language || navigator.userLanguage : 'ro';
  const lower = (nav || '').toLowerCase();
  if (lower.startsWith('ar')) return 'ar';
  if (lower.startsWith('ro')) return 'ro';
  return 'en';
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = React.useState(detectInitialLang());

  React.useEffect(() => {
    // persist and set direction
    try { localStorage.setItem('lang', lang); } catch {}
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('dir', dir);
      document.documentElement.setAttribute('lang', lang);
    }
  }, [lang]);

  const setLang = React.useCallback((l) => setLangState(l), []);
  const toggleLang = React.useCallback(() => setLangState(prev => (prev === 'ar' ? 'ro' : 'ar')), []);

  const t = React.useCallback((key) => {
    const pack = translations[lang] || translations.ro;
    return pack[key] || translations.en[key] || translations.ro[key] || key;
  }, [lang]);

  const value = React.useMemo(() => ({ lang, t, setLang, toggleLang }), [lang, t, setLang, toggleLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return React.useContext(I18nContext);
}
