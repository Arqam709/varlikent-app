import type { TranslationShape } from './en';

/**
 * العربية — Arabic.
 *
 * Typed as `TranslationShape`, so a key added to `en.ts` and forgotten here is a
 * compile error rather than an English string appearing mid-sentence on an
 * Arabic screen.
 *
 * Note: theme NAMES are left in Latin script on purpose. "Varlikent Signature",
 * "Heritage Navy" and the rest are brand product names, not descriptive words —
 * the website does not translate them either, and transliterating them would
 * make them unrecognisable to a customer comparing the app with the site. The
 * DESCRIPTIONS underneath are translated.
 */
export const ar: TranslationShape = {
  common: {
    save: 'حفظ التغييرات',
    cancel: 'إلغاء',
    retry: 'إعادة المحاولة',
    loading: 'جارٍ التحميل…',
    back: 'رجوع',
    signIn: 'تسجيل الدخول',
    createAccount: 'إنشاء حساب',
    somethingWentWrong: 'حدث خطأ ما. يُرجى المحاولة مرة أخرى.',
    optional: 'اختياري',
    all: 'الكل',
    show: 'إظهار',
    hide: 'إخفاء',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
  },

  chats: {
    gateEyebrow: 'ابق على تواصل',
    gateTitle: 'راسل مستشارينا مباشرةً',
    closed: 'مغلقة',
    loadError: 'تعذّر تحميل المحادثات',
    emptyTitle: 'لا توجد محادثات بعد',
    emptyBody: 'عند مراسلة مستشار بخصوص عقار، ستظهر محادثتك هنا.',
    browseProperties: 'تصفّح العقارات',
  },

  register: {
    title: 'إنشاء حساب',
    subtitle: 'أدخل بياناتك للبدء.',
    fullName: 'الاسم الكامل',
    fullNamePlaceholder: 'اسمك الكامل',
    passwordPlaceholder: '٦ أحرف على الأقل',
    confirmPassword: 'تأكيد كلمة المرور',
    confirmPlaceholder: 'أعد إدخال كلمة المرور',
    haveAccount: 'لديك حساب بالفعل؟ ',
    allFieldsRequired: 'يُرجى تعبئة جميع الحقول.',
    passwordMismatch: 'كلمتا المرور غير متطابقتين.',
  },

  propertyDetails: {
    title: 'تفاصيل العقار',
    loadError: 'تعذّر تحميل العقار',
    message: 'رسالة',
    listing: 'الإعلان',
    messageAgent: 'مراسلة المستشار',
    bed: 'غرفة نوم',
    beds: 'غرف نوم',
    bath: 'حمّام',
    baths: 'حمّامات',
    rooms: 'الغرف',
    floor: 'الطابق',
    buildingAge: 'عمر المبنى',
    heating: 'التدفئة',
    propertyType: 'نوع العقار',
    district: 'المنطقة',
    status: 'الحالة',
    furnished: 'مفروش',
    parking: 'موقف سيارات',
    balcony: 'شرفة',
    garden: 'حديقة',
    elevator: 'مصعد',
    conversationFailed: 'تعذّر فتح المحادثة. يُرجى المحاولة مرة أخرى.',
  },

  messageThread: {
    title: 'رسالة',
    agent: 'مستشار',
    loadOlder: 'تحميل الرسائل الأقدم',
    compose: 'اكتب رسالة...',
    send: 'إرسال الرسالة',
    loadError: 'تعذّر تحميل هذه المحادثة',
    signInTitle: 'سجّل الدخول لعرض هذه المحادثة',
    signInBody: 'الرسائل خاصة بك وبمستشارك فقط.',
    listingGone: 'الإعلان لم يعد متاحًا',
    sendFailed: 'تعذّر إرسال الرسالة. يُرجى المحاولة مرة أخرى.',
  },

  notifications: {
    minutesAgo: 'قبل {n} د',
    hoursAgo: 'قبل {n} س',
    daysAgo: 'قبل {n} ي',
    title: 'الإشعارات',
    eyebrow: 'ابقَ على اطلاع',
    loadError: 'تعذّر تحميل الإشعارات',
    emptyMatches: 'لا توجد مطابقات جديدة',
    emptyAll: 'لا توجد عقارات جديدة منذ زيارتك الأخيرة.',
    noAlertsTitle: 'لا توجد تنبيهات عقارية بعد',
    neverMiss: 'لا تفوّت أي عقار جديد',
    filterAll: 'كل الجديد',
    filterMatches: 'المطابقات',
    manageAlerts: 'إدارة التنبيهات',
    createAlert: 'إنشاء تنبيه',
    manageAccessibility: 'إدارة تنبيهات العقارات',
    matchesAlert: 'مطابق لتنبيهك',
    newlyListed: 'عقار جديد مُدرج',
    justNow: 'الآن',
  },

  alerts: {
    title: 'تنبيهات العقارات',
    eyebrow: 'تحديثات العقارات',
    loadError: 'تعذّر تحميل التنبيهات',
    emptyTitle: 'لا توجد تنبيهات عقارية بعد',
    signInTitle: 'سجّل الدخول لإدارة التنبيهات',
    createFirst: 'إنشاء تنبيه',
    createAnother: 'إنشاء تنبيه جديد',
    edit: 'تعديل',
    delete: 'حذف',
    deleteConfirmTitle: 'حذف التنبيه؟',
    deleteFailed: 'تعذّر الحذف',
    tryAgain: 'يُرجى المحاولة مرة أخرى.',
    editTitle: 'تعديل التنبيه',
    newTitle: 'تنبيه جديد',
    saveChanges: 'حفظ التغييرات',
    saveAlert: 'حفظ التنبيه',
    saveFailed: 'تعذّر حفظ هذا التنبيه. يُرجى المحاولة مرة أخرى.',
    needOneFilter: 'اختر عامل تصفية واحدًا على الأقل لحفظ هذا التنبيه.',
    signInToSave: 'سجّل الدخول لحفظ التنبيهات',
    anyDistrict: 'كل المناطق',
    anyType: 'كل الأنواع',
    any: 'الكل',
    listingType: 'نوع الإعلان',
    district: 'المنطقة',
  },

  services: {
    title: 'الخدمات',
    eyebrow: 'خبراتنا',
    explore: 'استكشاف الخدمة',
    notFound: 'الخدمة غير موجودة',
    backToServices: 'العودة إلى الخدمات',
  },

  filters: {
    title: 'عوامل التصفية',
    reset: 'إعادة تعيين',
    retry: 'إعادة المحاولة',
    close: 'إغلاق التصفية',
    districtsUnavailable: 'المناطق غير متاحة.',
    exactBedrooms: 'عدد غرف النوم بالضبط.',
    anyDistrict: 'كل المناطق',
    anyType: 'كل الأنواع',
    minPrice: 'أقل سعر بالليرة التركية',
    maxPrice: 'أعلى سعر بالليرة التركية',
    min: 'الأدنى',
    max: 'الأعلى',
  },

  tabs: {
    home: 'الرئيسية',
    properties: 'العقارات',
    chats: 'المحادثات',
    account: 'الحساب',
    chatsAccessibility: 'المحادثات، محادثاتك العقارية',
  },

  home: {
    discoverEyebrow: 'اكتشف',
    discoverTitle: 'اعثر على منزلك القادم',
    searchPlaceholder: 'ابحث عن عقارات في إسطنبول',
    featuredEyebrow: 'مختارة بعناية',
    featuredTitle: 'عقارات مميّزة',
    viewAll: 'عرض الكل',
    heroLine3: 'مساحات في إسطنبول',
    expertiseEyebrow: 'خبراتنا',
    beyondRealEstate: 'أكثر من عقارات',
    viewAllServices: 'عرض كل الخدمات',
    heroHeadline: 'نُصمّم ونبني ونُسلّم',
    heroImageAlt: 'فيلا فاخرة في إسطنبول',
    viewProperties: 'عرض العقارات',
    ourServices: 'خدماتنا',
    notifications: 'الإشعارات',
    statProperties: 'عقار',
    statYears: 'سنة',
    statDistricts: 'منطقة',
    statSatisfaction: 'رضا العملاء',
  },

  properties: {
    title: 'العقارات',
    eyebrow: 'إسطنبول',
    tagline: 'اعثر على منزلك القادم',
    filters: 'عوامل التصفية',
    buy: 'للبيع',
    rent: 'للإيجار',
    loadError: 'تعذّر تحميل العقارات',
    emptyAll: 'لا توجد عقارات متاحة حاليًا.',
    emptySale: 'لا توجد عقارات للبيع حاليًا.',
    emptyRent: 'لا توجد عقارات للإيجار حاليًا.',
    emptyFiltered: 'لا توجد عقارات مطابقة لهذه التصفية.',
    forSale: 'للبيع',
    forRent: 'للإيجار',
    featured: 'مميّز',
  },

  auth: {
    welcomeBack: 'مرحبًا بعودتك. يُرجى إدخال بياناتك.',
    signingIn: 'جارٍ تسجيل الدخول…',
    forgotPassword: 'نسيت كلمة المرور؟',
    noAccount: 'إنشاء حساب',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    credentialsRequired: 'يُرجى إدخال بريدك الإلكتروني وكلمة المرور.',
  },

  errors: {
    network: 'تعذّر الوصول إلى الخادم. تحقّق من اتصالك وحاول مرة أخرى.',
  },

  account: {
    eyebrow: 'Varlikent',
    title: 'الحساب',
    member: 'عضو',
    signedOutHeading: 'إدارة حساب Varlikent الخاص بك',
    signedOutBody: 'سجّل الدخول لتعديل ملفك الشخصي واختيار مظهر وتحديد لغتك.',

    sectionProfile: 'الملف الشخصي',
    personalInformation: 'المعلومات الشخصية',
    profilePhoto: 'صورة الملف الشخصي',

    sectionActivity: 'نشاط العقارات',
    propertyAlerts: 'تنبيهات العقارات',
    notifications: 'العقارات الجديدة',

    sectionPreferences: 'التفضيلات',
    appearance: 'المظهر',
    language: 'اللغة',

    sectionSecurity: 'الأمان',
    passwordSecurity: 'كلمة المرور والأمان',
    accountInformation: 'معلومات الحساب',

    sectionAccount: 'الحساب',
    signOut: 'تسجيل الخروج',
    deleteAccount: 'حذف الحساب',
  },

  personalInformation: {
    title: 'المعلومات الشخصية',
    subtitle: 'هذا هو الاسم والبريد الإلكتروني الظاهران في Varlikent.',
    fullName: 'الاسم الكامل',
    fullNamePlaceholder: 'اسمك الكامل',
    email: 'البريد الإلكتروني',
    emailPlaceholder: 'you@example.com',
    saved: 'تم تحديث بياناتك.',
    nameRequired: 'يُرجى إدخال اسمك.',
    emailRequired: 'يُرجى إدخال بريدك الإلكتروني.',
    emailInvalid: 'يُرجى إدخال بريد إلكتروني صحيح.',
    noChanges: 'لم يتم تغيير أي شيء بعد.',
  },

  profilePhoto: {
    title: 'صورة الملف الشخصي',
    subtitle: 'تظهر صورتك في حسابك وفي محادثاتك.',
    choose: 'اختيار صورة',
    change: 'تغيير الصورة',
    uploading: 'جارٍ الرفع…',
    updated: 'تم تحديث صورتك.',
    permissionTitle: 'مطلوب الوصول إلى الصور',
    permissionBody:
      'يحتاج Varlikent إلى إذن للوصول إلى مكتبة صورك حتى تتمكن من اختيار صورة لملفك الشخصي.',
    failed: 'لم يتم رفع صورتك. يُرجى تجربة صورة أخرى.',
    initialsNote: 'في حال عدم وجود صورة، تظهر الأحرف الأولى من اسمك.',
  },

  password: {
    title: 'كلمة المرور والأمان',
    subtitle: 'أدخل كلمة المرور الحالية، ثم اختر كلمة مرور جديدة.',
    current: 'كلمة المرور الحالية',
    new: 'كلمة المرور الجديدة',
    confirm: 'تأكيد كلمة المرور الجديدة',
    placeholder: '••••••••',
    minLength: '٦ أحرف على الأقل.',
    update: 'تحديث كلمة المرور',
    updated: 'تم تحديث كلمة المرور.',
    allRequired: 'يُرجى تعبئة جميع حقول كلمة المرور.',
    mismatch: 'كلمتا المرور الجديدتان غير متطابقتين.',
    tooShort: 'يجب أن تكون كلمة المرور الجديدة ٦ أحرف على الأقل.',
    show: 'إظهار كلمة المرور',
    hide: 'إخفاء كلمة المرور',

    socialTitle: 'تُدار بواسطة مزوّد تسجيل الدخول',
    socialBody:
      'لقد سجّلت الدخول عبر {provider}، لذا لا توجد كلمة مرور في Varlikent لتغييرها. يمكنك إدارة كلمة المرور من خلال {provider}.',
    socialResetTitle: 'هل تريد كلمة مرور خاصة بـ Varlikent؟',
    socialResetBody:
      'استخدم «نسيت كلمة المرور» في شاشة تسجيل الدخول وسنرسل إليك رابطًا لتعيين كلمة مرور.',
  },

  appearance: {
    title: 'المظهر',
    subtitle: 'اختر مظهرًا لتجربتك في Varlikent.',
    active: 'محدد',
    themes: {
      default: {
        label: 'Varlikent Signature',
        description: 'فحمي غامق وأخضر غابي — المظهر الأصلي',
      },
      classic: {
        label: 'Heritage Navy',
        description: 'كحلي عميق وكريمي مع لمسات ذهبية',
      },
      dark: {
        label: 'Dark Luxury',
        description: 'خلفيات سوداء عميقة مع ذهبي دافئ',
      },
      light: {
        label: 'Light Luxury',
        description: 'عاجي دافئ وأخضر غابي — أنيق ومنعش',
      },
      forest: {
        label: 'Forest Green',
        description: 'أخضر غابي غني مع كريمي وذهبي',
      },
    },
  },

  language: {
    title: 'اللغة',
    subtitle: 'اختر لغتك.',
    restartTitle: 'مطلوب إعادة تشغيل واحدة',
    restartBody:
      'ما زال هناك إعداد تخطيط من إصدار سابق نشطًا. أغلق Varlikent وأعد فتحه مرة واحدة لإزالته. أما تغيير اللغة فيُطبَّق فورًا.',
  },

  accountInformation: {
    title: 'معلومات الحساب',
    subtitle: 'تفاصيل حسابك في Varlikent.',
    role: 'الدور',
    memberSince: 'عضو منذ',
    status: 'الحالة',
    signInMethod: 'طريقة تسجيل الدخول',
    active: 'نشط',
    inactive: 'غير نشط',
    roles: {
      user: 'عضو',
      agent: 'مستشار عقاري',
      admin: 'مسؤول',
      owner: 'المالك',
    },
    providers: {
      local: 'البريد الإلكتروني وكلمة المرور',
      google: 'Google',
      microsoft: 'Microsoft',
      apple: 'Apple',
    },
  },

  deleteAccount: {
    title: 'حذف الحساب',
    heading: 'حذف حسابك نهائي',
    body: 'لا يمكن استعادة حسابك بعد حذفه.',
    consequenceProfile: 'سيتم حذف اسمك وبريدك الإلكتروني وصورة ملفك الشخصي.',
    consequenceMessages: 'سيتم إغلاق محادثاتك مع المستشارين.',
    consequenceAlerts: 'سيتم حذف تنبيهات العقارات المحفوظة والمفضلة.',
    supportHeading: 'يتولى فريقنا عملية الحذف',
    supportBody:
      'لحماية سجل استفساراتك، تُنجز عملية حذف الحساب بواسطة أحد موظفينا وليس تلقائيًا. راسلنا بالبريد الإلكتروني وسنحذف حسابك.',
    contactSupport: 'مراسلة الدعم',
    emailSubject: 'طلب حذف الحساب',
    cannotOpenMail: 'لم يتم فتح تطبيق البريد. يُرجى مراسلة {email}.',
  },
};

export default ar;
