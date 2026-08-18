import type { TranslationShape } from './en';

/**
 * Türkçe.
 *
 * Typed as `TranslationShape`, so a key added to `en.ts` and forgotten here is a
 * compile error rather than an English string appearing mid-sentence on a
 * Turkish screen.
 */
export const tr: TranslationShape = {
  common: {
    save: 'Değişiklikleri Kaydet',
    cancel: 'İptal',
    retry: 'Tekrar Dene',
    loading: 'Yükleniyor…',
    back: 'Geri dön',
    signIn: 'Giriş Yap',
    createAccount: 'Hesap Oluştur',
    somethingWentWrong: 'Bir şeyler ters gitti. Lütfen tekrar deneyin.',
    optional: 'İsteğe bağlı',
    all: 'Tümü',
    show: 'Göster',
    hide: 'Gizle',
    showPassword: 'Şifreyi göster',
    hidePassword: 'Şifreyi gizle',
  },

  chats: {
    gateEyebrow: 'İletişimde kalın',
    gateTitle: 'Danışmanlarımıza doğrudan yazın',
    closed: 'Kapalı',
    loadError: 'Sohbetler yüklenemedi',
    emptyTitle: 'Henüz sohbet yok',
    emptyBody: 'Bir ilan hakkında danışmana mesaj gönderdiğinizde görüşmeniz burada görünür.',
    browseProperties: 'İlanlara Göz At',
  },

  register: {
    title: 'Hesap Oluştur',
    subtitle: 'Başlamak için bilgilerinizi girin.',
    fullName: 'Ad Soyad',
    fullNamePlaceholder: 'Adınız ve soyadınız',
    passwordPlaceholder: 'En az 6 karakter',
    confirmPassword: 'Şifreyi Onayla',
    confirmPlaceholder: 'Şifreyi tekrar girin',
    haveAccount: 'Zaten hesabınız var mı? ',
    allFieldsRequired: 'Lütfen tüm alanları doldurun.',
    passwordMismatch: 'Şifreler eşleşmiyor.',
  },

  propertyDetails: {
    title: 'İlan Detayları',
    loadError: 'İlan yüklenemedi',
    message: 'Mesaj',
    listing: 'İlan',
    messageAgent: 'Danışmana mesaj gönder',
    bed: 'Yatak Odası',
    beds: 'Yatak Odası',
    bath: 'Banyo',
    baths: 'Banyo',
    rooms: 'Oda',
    floor: 'Kat',
    buildingAge: 'Bina Yaşı',
    heating: 'Isıtma',
    propertyType: 'Emlak Tipi',
    district: 'İlçe',
    status: 'Durum',
    furnished: 'Eşyalı',
    parking: 'Otopark',
    balcony: 'Balkon',
    garden: 'Bahçe',
    elevator: 'Asansör',
    conversationFailed: 'Görüşme açılamadı. Lütfen tekrar deneyin.',
  },

  messageThread: {
    title: 'Mesaj',
    agent: 'Danışman',
    loadOlder: 'Daha eski mesajları yükle',
    compose: 'Bir mesaj yazın...',
    send: 'Mesaj gönder',
    loadError: 'Bu görüşme yüklenemedi',
    signInTitle: 'Bu görüşmeyi görmek için giriş yapın',
    signInBody: 'Mesajlar yalnızca siz ve danışmanınız arasındadır.',
    listingGone: 'İlan artık mevcut değil',
    sendFailed: 'Mesaj gönderilemedi. Lütfen tekrar deneyin.',
  },

  notifications: {
    minutesAgo: '{n} dk önce',
    hoursAgo: '{n} sa önce',
    daysAgo: '{n} gün önce',
    title: 'Bildirimler',
    eyebrow: 'Güncel Kalın',
    loadError: 'Bildirimler yüklenemedi',
    emptyMatches: 'Yeni eşleşme yok',
    emptyAll: 'Son ziyaretinizden bu yana yeni ilan yok.',
    noAlertsTitle: 'Henüz emlak uyarınız yok',
    neverMiss: 'Yeni ilanları kaçırmayın',
    filterAll: 'Tüm Yeniler',
    filterMatches: 'Eşleşmeler',
    manageAlerts: 'Uyarıları Yönet',
    createAlert: 'Uyarı Oluştur',
    manageAccessibility: 'Emlak uyarılarını yönet',
    matchesAlert: 'Uyarınızla eşleşiyor',
    newlyListed: 'Yeni ilan eklendi',
    justNow: 'Az önce',
  },

  alerts: {
    title: 'Emlak Uyarıları',
    eyebrow: 'Emlak Güncellemeleri',
    loadError: 'Uyarılar yüklenemedi',
    emptyTitle: 'Henüz emlak uyarınız yok',
    signInTitle: 'Uyarıları yönetmek için giriş yapın',
    createFirst: 'Uyarı Oluştur',
    createAnother: 'Yeni Uyarı Oluştur',
    edit: 'Düzenle',
    delete: 'Sil',
    deleteConfirmTitle: 'Uyarı silinsin mi?',
    deleteFailed: 'Silinemedi',
    tryAgain: 'Lütfen tekrar deneyin.',
    editTitle: 'Uyarıyı Düzenle',
    newTitle: 'Yeni Uyarı',
    saveChanges: 'Değişiklikleri Kaydet',
    saveAlert: 'Uyarıyı Kaydet',
    saveFailed: 'Bu uyarı kaydedilemedi. Lütfen tekrar deneyin.',
    needOneFilter: 'Bu uyarıyı kaydetmek için en az bir filtre seçin.',
    signInToSave: 'Uyarıları kaydetmek için giriş yapın',
    anyDistrict: 'Tüm ilçeler',
    anyType: 'Tüm tipler',
    any: 'Farketmez',
    listingType: 'İlan Tipi',
    district: 'İlçe',
  },

  services: {
    title: 'Hizmetler',
    eyebrow: 'Uzmanlığımız',
    explore: 'Hizmeti İncele',
    notFound: 'Hizmet bulunamadı',
    backToServices: 'Hizmetlere Dön',
  },

  filters: {
    title: 'Filtreler',
    reset: 'Sıfırla',
    retry: 'Tekrar Dene',
    close: 'Filtreleri kapat',
    districtsUnavailable: 'İlçeler yüklenemedi.',
    exactBedrooms: 'Tam yatak odası sayısı.',
    anyDistrict: 'Tüm ilçeler',
    anyType: 'Tüm tipler',
    minPrice: 'Türk Lirası cinsinden en düşük fiyat',
    maxPrice: 'Türk Lirası cinsinden en yüksek fiyat',
    min: 'En az',
    max: 'En çok',
  },

  tabs: {
    home: 'Ana Sayfa',
    properties: 'Emlak',
    chats: 'Sohbetler',
    account: 'Hesap',
    chatsAccessibility: 'Sohbetler, emlak görüşmeleriniz',
  },

  home: {
    discoverEyebrow: 'Keşfedin',
    discoverTitle: 'Yeni evinizi bulun',
    searchPlaceholder: 'İstanbul\'da ilan ara',
    featuredEyebrow: 'Seçkin',
    featuredTitle: 'Öne Çıkan İlanlar',
    viewAll: 'Tümünü Gör',
    heroLine3: 'İstanbul\'da Yaşam Alanları',
    expertiseEyebrow: 'Uzmanlığımız',
    beyondRealEstate: 'Emlaktan Fazlası',
    viewAllServices: 'Tüm Hizmetleri Gör',
    heroHeadline: 'Tasarlıyor, İnşa Ediyor ve Teslim Ediyoruz',
    heroImageAlt: 'Lüks İstanbul villası',
    viewProperties: 'İlanları Görüntüle',
    ourServices: 'Hizmetlerimiz',
    notifications: 'Bildirimler',
    statProperties: 'İlan',
    statYears: 'Yıl',
    statDistricts: 'İlçe',
    statSatisfaction: 'Memnuniyet',
  },

  properties: {
    title: 'Emlak',
    eyebrow: 'İstanbul',
    tagline: 'Yeni evinizi bulun',
    filters: 'Filtreler',
    buy: 'Satılık',
    rent: 'Kiralık',
    loadError: 'İlanlar yüklenemedi',
    emptyAll: 'Şu anda uygun ilan bulunmuyor.',
    emptySale: 'Şu anda satılık ilan bulunmuyor.',
    emptyRent: 'Şu anda kiralık ilan bulunmuyor.',
    emptyFiltered: 'Bu filtrelere uygun ilan bulunamadı.',
    forSale: 'Satılık',
    forRent: 'Kiralık',
    featured: 'Öne Çıkan',
  },

  auth: {
    welcomeBack: 'Tekrar hoş geldiniz. Lütfen bilgilerinizi girin.',
    signingIn: 'Giriş yapılıyor…',
    forgotPassword: 'Şifremi unuttum',
    noAccount: 'Kayıt olun',
    email: 'E-posta',
    password: 'Şifre',
    credentialsRequired: 'Lütfen e-posta adresinizi ve şifrenizi girin.',
  },

  errors: {
    network: 'Sunucuya ulaşılamıyor. Bağlantınızı kontrol edip tekrar deneyin.',
  },

  account: {
    eyebrow: 'Varlikent',
    title: 'Hesap',
    member: 'Üye',
    signedOutHeading: 'Varlikent hesabınızı yönetin',
    signedOutBody:
      'Profilinizi düzenlemek, tema seçmek ve dilinizi belirlemek için giriş yapın.',

    sectionProfile: 'Profil',
    personalInformation: 'Kişisel Bilgiler',
    profilePhoto: 'Profil Fotoğrafı',

    sectionActivity: 'Emlak Etkinliği',
    propertyAlerts: 'Emlak Uyarıları',
    notifications: 'Yeni İlanlar',

    sectionPreferences: 'Tercihler',
    appearance: 'Görünüm',
    language: 'Dil',

    sectionSecurity: 'Güvenlik',
    passwordSecurity: 'Şifre ve Güvenlik',
    accountInformation: 'Hesap Bilgileri',

    sectionAccount: 'Hesap',
    signOut: 'Çıkış Yap',
    deleteAccount: 'Hesabı Sil',
  },

  personalInformation: {
    title: 'Kişisel Bilgiler',
    subtitle: 'Bu, Varlikent genelinde görünen adınız ve e-postanızdır.',
    fullName: 'Ad Soyad',
    fullNamePlaceholder: 'Adınız ve soyadınız',
    email: 'E-posta Adresi',
    emailPlaceholder: 'siz@ornek.com',
    saved: 'Bilgileriniz güncellendi.',
    nameRequired: 'Lütfen adınızı girin.',
    emailRequired: 'Lütfen e-posta adresinizi girin.',
    emailInvalid: 'Lütfen geçerli bir e-posta adresi girin.',
    noChanges: 'Henüz bir değişiklik yapılmadı.',
  },

  profilePhoto: {
    title: 'Profil Fotoğrafı',
    subtitle: 'Fotoğrafınız hesabınızda ve görüşmelerinizde görünür.',
    choose: 'Fotoğraf Seç',
    change: 'Fotoğrafı Değiştir',
    uploading: 'Yükleniyor…',
    updated: 'Fotoğrafınız güncellendi.',
    permissionTitle: 'Fotoğraf erişimi gerekli',
    permissionBody:
      'Profil fotoğrafı seçebilmeniz için Varlikent’in fotoğraf galerinize erişim izni gerekiyor.',
    failed: 'Fotoğrafınız yüklenemedi. Lütfen başka bir görsel deneyin.',
    initialsNote: 'Fotoğraf olmadığında baş harfleriniz gösterilir.',
  },

  password: {
    title: 'Şifre ve Güvenlik',
    subtitle: 'Mevcut şifrenizi girin, ardından yeni bir şifre belirleyin.',
    current: 'Mevcut Şifre',
    new: 'Yeni Şifre',
    confirm: 'Yeni Şifreyi Onayla',
    placeholder: '••••••••',
    minLength: 'En az 6 karakter.',
    update: 'Şifreyi Güncelle',
    updated: 'Şifreniz güncellendi.',
    allRequired: 'Lütfen tüm şifre alanlarını doldurun.',
    mismatch: 'Yeni şifreler birbiriyle eşleşmiyor.',
    tooShort: 'Yeni şifreniz en az 6 karakter olmalıdır.',
    show: 'Şifreyi göster',
    hide: 'Şifreyi gizle',

    socialTitle: 'Giriş sağlayıcınız tarafından yönetiliyor',
    socialBody:
      '{provider} ile giriş yaptınız, bu nedenle Varlikent’te değiştirebileceğiniz bir şifre bulunmuyor. Şifrenizi {provider} üzerinden yönetin.',
    socialResetTitle: 'Varlikent şifresi ister misiniz?',
    socialResetBody:
      'Giriş ekranındaki “Şifremi unuttum” bağlantısını kullanın; şifre belirlemeniz için size e-posta göndeririz.',
  },

  appearance: {
    title: 'Görünüm',
    subtitle: 'Varlikent deneyiminiz için bir tema seçin.',
    active: 'Seçili',
    themes: {
      default: {
        label: 'Varlikent Signature',
        description: 'Koyu antrasit ve orman yeşili — orijinal',
      },
      classic: {
        label: 'Heritage Navy',
        description: 'Derin lacivert ve krem, altın vurgularla',
      },
      dark: {
        label: 'Dark Luxury',
        description: 'Obsidyen zeminler ve sıcak altın',
      },
      light: {
        label: 'Light Luxury',
        description: 'Sıcak fildişi ve orman yeşili — zarif ve ferah',
      },
      forest: {
        label: 'Forest Green',
        description: 'Zengin orman yeşilleri, krem ve altınla',
      },
    },
  },

  language: {
    title: 'Dil',
    subtitle: 'Dilinizi seçin.',
    restartTitle: 'Bir kez yeniden başlatın',
    restartBody:
      'Önceki sürümden kalan bir düzen ayarı hâlâ etkin. Temizlemek için Varlikent’i bir kez kapatıp açın. Dil değişikliği anında uygulanır.',
  },

  accountInformation: {
    title: 'Hesap Bilgileri',
    subtitle: 'Varlikent hesabınıza dair bilgiler.',
    role: 'Rol',
    memberSince: 'Üyelik tarihi',
    status: 'Durum',
    signInMethod: 'Giriş yöntemi',
    active: 'Aktif',
    inactive: 'Pasif',
    roles: {
      user: 'Üye',
      agent: 'Danışman',
      admin: 'Yönetici',
      owner: 'Sahip',
    },
    providers: {
      local: 'E-posta ve şifre',
      google: 'Google',
      microsoft: 'Microsoft',
      apple: 'Apple',
    },
  },

  deleteAccount: {
    title: 'Hesabı Sil',
    heading: 'Hesabınızı silmek kalıcıdır',
    body: 'Hesabınız silindikten sonra geri alınamaz.',
    consequenceProfile: 'Adınız, e-postanız ve profil fotoğrafınız kaldırılır.',
    consequenceMessages: 'Danışmanlarla olan görüşmeleriniz kapatılır.',
    consequenceAlerts: 'Kayıtlı emlak uyarılarınız ve favorileriniz silinir.',
    supportHeading: 'Silme işlemi ekibimiz tarafından yapılır',
    supportBody:
      'Talep geçmişinizi korumak için hesap silme işlemi otomatik değil, bir yetkili tarafından tamamlanır. Bize e-posta gönderin, hesabınızı kaldıralım.',
    contactSupport: 'Destek’e E-posta Gönder',
    emailSubject: 'Hesap silme talebi',
    cannotOpenMail: 'E-posta uygulamanız açılamadı. Lütfen {email} adresine yazın.',
  },
};

export default tr;
