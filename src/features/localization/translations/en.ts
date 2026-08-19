/**
 * English — the SOURCE OF TRUTH for every translation key.
 *
 * ── Relationship to the website ─────────────────────────────────────────
 * The website keeps one large `src/locales/translations.js` holding all three
 * languages in a single object, reached as `t.nav.home` (an object, not a
 * function). Mobile splits one file per language and reads through a `t()`
 * FUNCTION instead, because a function can fall back: a key missing from
 * Turkish or Arabic resolves to the English string rather than rendering
 * `undefined` on a customer's screen. With the object form, a missing key is a
 * crash or a blank.
 *
 * `en` is typed as the canonical shape, and `tr`/`ar` are checked against it —
 * so adding a key here without translating it is a TYPE ERROR, not a silent
 * gap discovered by a user.
 */
export const en = {
  common: {
    save: 'Save Changes',
    cancel: 'Cancel',
    retry: 'Try Again',
    loading: 'Loading…',
    back: 'Go back',
    signIn: 'Sign In',
    createAccount: 'Create Account',
    somethingWentWrong: 'Something went wrong. Please try again.',
    optional: 'Optional',
    all: 'All',
    show: 'Show',
    hide: 'Hide',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  },

  chats: {
    gateEyebrow: 'Stay in touch',
    gateTitle: 'Message our agents directly',
    closed: 'Closed',
    loadError: 'Unable to load chats',
    emptyTitle: 'No chats yet',
    emptyBody: 'When you message an agent about a property, your conversation will appear here.',
    browseProperties: 'Browse Properties',
  },

  register: {
    title: 'Create Account',
    subtitle: 'Fill in your details to get started.',
    fullName: 'Full Name',
    fullNamePlaceholder: 'Your full name',
    passwordPlaceholder: 'Min. 6 characters',
    confirmPassword: 'Confirm Password',
    confirmPlaceholder: 'Repeat password',
    haveAccount: 'Already have an account? ',
    allFieldsRequired: 'Please fill in all fields.',
    passwordMismatch: 'Passwords do not match.',
  },

  propertyDetails: {
    details: 'Property details',
    features: 'Features',
    listedBy: 'Listed by',
    about: 'About this property',
    loadFailed: 'Unable to load property',
    title: 'Property Details',
    loadError: 'Unable to load property',
    message: 'Message',
    listing: 'Listing',
    messageAgent: 'Message the agent',
    bed: 'Bed',
    beds: 'Beds',
    bath: 'Bath',
    baths: 'Baths',
    rooms: 'Rooms',
    floor: 'Floor',
    buildingAge: 'Building Age',
    heating: 'Heating',
    propertyType: 'Property Type',
    district: 'District',
    status: 'Status',
    furnished: 'Furnished',
    parking: 'Parking',
    balcony: 'Balcony',
    garden: 'Garden',
    elevator: 'Elevator',
    conversationFailed: 'Could not open the conversation. Please try again.',
  },

  messageThread: {
    propertyLink: 'View Property',
    title: 'Message',
    agent: 'Agent',
    loadOlder: 'Load older messages',
    compose: 'Write a message...',
    send: 'Send message',
    loadError: 'Unable to load this conversation',
    signInTitle: 'Sign in to view this conversation',
    signInBody: 'Messages are private to you and your agent.',
    listingGone: 'Listing no longer available',
    sendFailed: 'Message could not be sent. Please try again.',
  },

  notifications: {
    minutesAgo: '{n}m ago',
    hoursAgo: '{n}h ago',
    daysAgo: '{n}d ago',
    title: 'Notifications',
    eyebrow: 'Stay Updated',
    loadError: 'Unable to load notifications',
    emptyMatches: 'No new matches',
    emptyAll: 'No new properties since your last visit.',
    noAlertsTitle: 'No property alerts yet',
    neverMiss: 'Never miss a new property',
    filterAll: 'All New',
    filterMatches: 'Matches',
    manageAlerts: 'Manage Alerts',
    createAlert: 'Create Alert',
    manageAccessibility: 'Manage property alerts',
    matchesAlert: 'Matches your alert',
    newlyListed: 'New property listed',
    justNow: 'Just now',
  },

  alerts: {
    minBedrooms: 'Minimum Bedrooms',
    title: 'Property Alerts',
    eyebrow: 'Property Updates',
    loadError: 'Unable to load alerts',
    emptyTitle: 'No property alerts yet',
    signInTitle: 'Sign in to manage alerts',
    createFirst: 'Create Alert',
    createAnother: 'Create New Alert',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirmTitle: 'Delete alert?',
    deleteFailed: 'Could not delete',
    tryAgain: 'Please try again.',
    editTitle: 'Edit Alert',
    newTitle: 'New Alert',
    saveChanges: 'Save Changes',
    saveAlert: 'Save Alert',
    saveFailed: 'Could not save this alert. Please try again.',
    needOneFilter: 'Choose at least one filter to save this alert.',
    signInToSave: 'Sign in to save alerts',
    anyDistrict: 'Any district',
    anyType: 'Any type',
    any: 'Any',
    listingType: 'Listing Type',
    district: 'District',
  },

  services: {
    howWeWork: 'How We Work',
    theTransformation: 'The Transformation',
    intro: 'From the first sketch to the final sale — we cover every stage of the property lifecycle.',
    items: {
      architecture: {
        title: 'Architecture',
        short: 'Iconic designs rooted in Istanbul\'s heritage, built for the future.',
        description: 'We design buildings that endure — rooted in Istanbul\'s heritage, shaped for the future.',
        websiteLabel: 'Varlikent / Architecture',
        capabilitiesLabel: 'What We Offer',
        capabilitiesHeading: 'Services',
        caps: {
          conceptDesign: { title: 'Concept & Design', desc: 'From initial brief to detailed architectural plans — space that inspires.' },
          structuralEngineering: { title: 'Structural Engineering', desc: 'Robust, code-compliant systems for every building typology.' },
          urbanPlanning: { title: 'Urban Planning', desc: 'Master plans aligned with Istanbul\'s evolving urban fabric.' },
          projectManagement: { title: 'Project Management', desc: 'Full oversight from groundbreaking to handover.' },
        },
        process: { heading: 'Process', steps: { s1: 'Brief & Research', s2: 'Concept Design', s3: 'Technical Development', s4: 'Construction Oversight', } },
        closingHeading: 'Have a vision?',
        closingBody: 'Contact us to discuss your project.',
      },
      construction: {
        title: 'Construction',
        short: 'Turn-key builds delivered to the highest seismic and quality standards.',
        description: 'High-performance construction for Istanbul\'s most ambitious developments.',
        websiteLabel: 'Varlikent / Construction',
        capabilitiesLabel: 'What We Build',
        capabilitiesHeading: 'Construction Services',
        caps: {
          generalContracting: { title: 'General Contracting', desc: 'Turn-key construction for residential, commercial and mixed-use developments.' },
          structuralWorks: { title: 'Structural Works', desc: 'Reinforced concrete and steel frame solutions built to seismic zone standards.' },
          mepEngineering: { title: 'MEP Engineering', desc: 'Mechanical, electrical and plumbing systems fully integrated into the build.' },
          envelopeFacade: { title: 'Envelope & Façade', desc: 'Glass curtain walls, cladding systems and high-performance insulation.' },
        },
        process: { heading: 'Our Process', steps: { s1: 'Site Survey', s2: 'Foundation', s3: 'Structural Frame', s4: 'Fit-Out', s5: 'Handover', } },
        note: { eyebrow: 'Built to Withstand', heading: 'Earthquake-Resistant Engineering', body: 'Istanbul sits in an active seismic zone. Every structure we deliver is engineered to current Turkish seismic design codes, with safety margins verified at each stage of construction — not assumed.' },
        closingHeading: 'Ready to Break Ground?',
        closingBody: 'Partner with our construction team for your next Istanbul development.',
      },
      renovation: {
        title: 'Renovation',
        short: 'Precision upgrades that transform existing spaces into premium properties.',
        description: 'Transform any space with premium finishes, intelligent layout, and expert craftsmanship.',
        websiteLabel: 'Varlikent / Renovation',
        capabilitiesLabel: 'What We Do',
        capabilitiesHeading: 'Renovation Services',
        caps: {
          windowsDoors: { title: 'Window & Door Replacement', desc: 'Thermally broken aluminium and timber joinery with acoustic glazing.' },
          structuralAlterations: { title: 'Structural Alterations', desc: 'Safe load-bearing modifications, wall removals and ceiling raising.' },
          electricalLighting: { title: 'Electrical & Lighting', desc: 'Full rewire, smart home integration and bespoke lighting design.' },
          bathroomKitchen: { title: 'Bathroom & Kitchen', desc: 'Marble wet rooms, bespoke cabinetry and premium appliance fit-out.' },
        },
        comparison: { heading: 'Before & After', beforeLabel: 'Before', afterLabel: 'After',
          before: { b1: 'Dated finishes', b2: 'Poor natural lighting', b3: 'Inefficient layout', b4: 'Original 1990s fixtures', },
          after: { a1: 'Premium marble surfaces', a2: 'Architectural lighting design', a3: 'Open-plan remodel', a4: 'Smart home integration', } },
        closingHeading: 'Transform Your Space',
        closingBody: 'Let\'s discuss your renovation project and bring your vision to life.',
      },
      interiorDesign: {
        title: 'Interior Design',
        short: 'Curated interiors crafted for sophisticated, effortless living.',
        description: 'Spaces that breathe sophistication — from the first concept to the final detail.',
        websiteLabel: 'Varlikent / Interior Design',
        capabilitiesLabel: 'Our Expertise',
        capabilitiesHeading: 'Interior Design Services',
        caps: {
          conceptMoodBoards: { title: 'Concept & Mood Boards', desc: 'Visual direction for every room — colour stories, material palettes and spatial flow.' },
          furnitureSourcing: { title: 'Furniture Sourcing', desc: 'Curated selection from Italian and Scandinavian premium suppliers, delivered and installed.' },
          artAccessories: { title: 'Art & Accessories', desc: 'Original artwork, sculptures and decorative objects that elevate every corner.' },
          lightingDesign: { title: 'Lighting Design', desc: 'Layered ambient, task and accent lighting to create mood and highlight architecture.' },
        },
        closingHeading: 'Design Your Dream Space',
        closingBody: 'Book a complimentary 30-minute consultation with our design team.',
      },
    },
    title: 'Services',
    eyebrow: 'Our Expertise',
    explore: 'Explore Service',
    notFound: 'Service not found',
    backToServices: 'Back to Services',
  },

  filters: {
    district: 'District',
    propertyType: 'Property Type',
    price: 'Price',
    bedrooms: 'Bedrooms',
    any: 'Any',
    apply: 'Apply Filters',
    title: 'Filters',
    reset: 'Reset',
    retry: 'Retry',
    close: 'Close filters',
    districtsUnavailable: 'Districts unavailable.',
    exactBedrooms: 'Exact number of bedrooms.',
    anyDistrict: 'Any district',
    anyType: 'Any type',
    minPrice: 'Minimum price in Turkish Lira',
    maxPrice: 'Maximum price in Turkish Lira',
    min: 'Min',
    max: 'Max',
  },

  tabs: {
    home: 'Home',
    properties: 'Properties',
    chats: 'Chats',
    account: 'Account',
    chatsAccessibility: 'Chats, your property conversations',
  },

  home: {
    heroEyebrow: 'Istanbul · Real Estate',
    buyTitle: 'Buy a Home',
    buySubtitle: 'Explore properties for sale',
    rentTitle: 'Rent a Home',
    rentSubtitle: 'Find a place to rent',
    featuredLoadError: 'Featured properties couldn’t load.',
    discoverEyebrow: 'Discover',
    discoverTitle: 'Find your next home',
    searchPlaceholder: 'Search properties in Istanbul',
    featuredEyebrow: 'Handpicked',
    featuredTitle: 'Featured Properties',
    viewAll: 'View All',
    heroLine3: 'Spaces in Istanbul',
    expertiseEyebrow: 'Our Expertise',
    beyondRealEstate: 'Beyond Real Estate',
    viewAllServices: 'View All Services',
    heroHeadline: 'We Design, Build & Deliver',
    heroImageAlt: 'Luxury Istanbul villa',
    viewProperties: 'View Properties',
    ourServices: 'Our Services',
    notifications: 'Notifications',
    statProperties: 'Properties',
    statYears: 'Years',
    statDistricts: 'Districts',
    statSatisfaction: 'Satisfaction',
  },

  properties: {
    clearFilters: 'Clear Filters',
    bed: 'Bed',
    beds: 'Beds',
    bath: 'Bath',
    baths: 'Baths',
    all: 'All',
    title: 'Properties',
    eyebrow: 'Istanbul',
    tagline: 'Find your next home',
    filters: 'Filters',
    buy: 'Buy',
    rent: 'Rent',
    loadError: 'Unable to load properties',
    emptyAll: 'No properties available right now.',
    emptySale: 'No properties for sale are available right now.',
    emptyRent: 'No properties for rent are available right now.',
    emptyFiltered: 'No properties match these filters.',
    forSale: 'For Sale',
    forRent: 'For Rent',
    featured: 'Featured',
  },

  auth: {
    welcomeBack: 'Welcome back. Please enter your details.',
    signingIn: 'Signing In…',
    forgotPassword: 'Forgot password?',
    noAccount: 'Sign up',
    email: 'Email',
    password: 'Password',
    credentialsRequired: 'Please enter your email and password.',
  },

  errors: {
    /** Local validation and transport states only — never a translated copy of
     *  a backend message, which is returned already-written and stays as sent. */
    network: 'Cannot reach the server. Check your connection and try again.',
  },

  account: {
    eyebrow: 'Varlikent',
    title: 'Account',
    member: 'Member',
    signedOutHeading: 'Manage your Varlikent account',
    signedOutBody: 'Sign in to edit your profile, choose a theme and set your language.',

    sectionProfile: 'Profile',
    personalInformation: 'Personal Information',
    profilePhoto: 'Profile Photo',

    sectionActivity: 'Property Activity',
    propertyAlerts: 'Property Alerts',
    notifications: 'New Listings',

    sectionPreferences: 'Preferences',
    appearance: 'Appearance',
    language: 'Language',

    sectionSecurity: 'Security',
    passwordSecurity: 'Password & Security',
    accountInformation: 'Account Information',

    sectionAccount: 'Account',
    signOut: 'Sign Out',
    deleteAccount: 'Delete Account',
  },

  personalInformation: {
    title: 'Personal Information',
    subtitle: 'This is the name and email shown across Varlikent.',
    fullName: 'Full Name',
    fullNamePlaceholder: 'Your full name',
    email: 'Email Address',
    emailPlaceholder: 'you@example.com',
    saved: 'Your details have been updated.',
    nameRequired: 'Please enter your name.',
    emailRequired: 'Please enter your email address.',
    emailInvalid: 'Please enter a valid email address.',
    noChanges: 'Nothing has changed yet.',
  },

  profilePhoto: {
    title: 'Profile Photo',
    subtitle: 'Your photo appears on your account and in your conversations.',
    choose: 'Choose a Photo',
    change: 'Change Photo',
    uploading: 'Uploading…',
    updated: 'Your photo has been updated.',
    permissionTitle: 'Photo access needed',
    permissionBody:
      'Varlikent needs permission to open your photo library so you can choose a profile photo.',
    failed: 'Your photo could not be uploaded. Please try another image.',
    initialsNote: 'Without a photo, your initials are shown instead.',
  },

  password: {
    title: 'Password & Security',
    subtitle: 'Enter your current password, then choose a new one.',
    current: 'Current Password',
    new: 'New Password',
    confirm: 'Confirm New Password',
    placeholder: '••••••••',
    minLength: 'At least 6 characters.',
    update: 'Update Password',
    updated: 'Your password has been updated.',
    allRequired: 'Please fill in all password fields.',
    mismatch: 'The new passwords do not match.',
    tooShort: 'Your new password must be at least 6 characters.',
    show: 'Show password',
    hide: 'Hide password',

    // Shown when the account was created through Google or Microsoft.
    socialTitle: 'Managed by your sign-in provider',
    socialBody:
      'You signed in with {provider}, so Varlikent has no password for you to change. Manage your password with {provider} instead.',
    socialResetTitle: 'Want a Varlikent password?',
    socialResetBody:
      'Use "Forgot password" on the sign-in screen and we will email you a link to set one.',
  },

  appearance: {
    title: 'Appearance',
    subtitle: 'Choose a theme for your Varlikent experience.',
    active: 'Selected',
    themes: {
      default: {
        label: 'Varlikent Signature',
        description: 'Dark charcoal & forest green — the original',
      },
      classic: {
        label: 'Heritage Navy',
        description: 'Deep navy & cream with gold accents',
      },
      dark: {
        label: 'Dark Luxury',
        description: 'Obsidian backgrounds with warm gold',
      },
      light: {
        label: 'Light Luxury',
        description: 'Warm ivory & forest green — refined and airy',
      },
      forest: {
        label: 'Forest Green',
        description: 'Rich forest greens with cream & gold',
      },
    },
  },

  language: {
    title: 'Language',
    subtitle: 'Choose your language.',
    restartTitle: 'One restart needed',
    restartBody:
      'A layout setting from an earlier version is still active. Close and reopen Varlikent once to clear it. Switching language itself takes effect immediately.',
  },

  accountInformation: {
    title: 'Account Information',
    subtitle: 'Details we hold about your Varlikent account.',
    role: 'Role',
    memberSince: 'Member since',
    status: 'Status',
    signInMethod: 'Sign-in method',
    active: 'Active',
    inactive: 'Inactive',
    roles: {
      user: 'Member',
      agent: 'Agent',
      admin: 'Administrator',
      owner: 'Owner',
    },
    providers: {
      local: 'Email & password',
      google: 'Google',
      microsoft: 'Microsoft',
      apple: 'Apple',
    },
  },

  deleteAccount: {
    title: 'Delete Account',
    heading: 'Deleting your account is permanent',
    body: 'Once your account is deleted it cannot be recovered.',
    consequenceProfile: 'Your name, email and profile photo are removed.',
    consequenceMessages: 'Your conversations with agents are closed.',
    consequenceAlerts: 'Your saved property alerts and favourites are deleted.',
    supportHeading: 'Deletion is handled by our team',
    supportBody:
      'To protect your enquiry history, account deletion is completed by a person rather than automatically. Email us and we will remove your account.',
    contactSupport: 'Email Support',
    emailSubject: 'Account deletion request',
    cannotOpenMail: 'Could not open your mail app. Please email {email}.',
  },
} as const;

/**
 * The canonical translation shape. `tr` and `ar` must satisfy this exactly.
 *
 * ── Why the values are widened to `string` ──────────────────────────────
 * `en` is declared `as const`, which makes every value a LITERAL type
 * ('Save Changes', not string). Typing another bundle as `typeof en` would then
 * demand that the Turkish file also say "Save Changes" — every translated
 * string would be a type error.
 *
 * `Widen` recurses through the object replacing each string leaf with `string`
 * while leaving the KEY structure intact. That is the half worth keeping: a key
 * present in English and missing from Arabic is still a compile error, and a
 * typo'd key name is still caught, but the actual translations are free.
 */
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export type TranslationShape = Widen<typeof en>;

export default en;
