import type Ionicons from '@expo/vector-icons/Ionicons';


export type ServiceId = 'architecture' | 'construction' | 'renovation' | 'interior-design';

/** One numbered capability, mirroring the website's `services` arrays. */
export type ServiceCapability = {
  /** "01"–"04", kept as a string so the leading zero is part of the content. */
  num: string;
  title: string;
  desc: string;
};

export type ServiceProcess = {
  heading: string;
  steps: string[];
};

/** Renovation only — the website's Before & After transformation lists. */
export type ServiceComparison = {
  heading: string;
  beforeLabel: string;
  afterLabel: string;
  before: string[];
  after: string[];
};

/** Construction only — the seismic engineering statement. */
export type ServiceNote = {
  eyebrow: string;
  heading: string;
  body: string;
};

export type Service = {
  id: ServiceId;
  /** Display name, e.g. "Interior Design". */
  title: string;
  /** One line for the Home preview and the services list. */
  short: string;
  /** The fuller line used on the /services screen and the detail hero. */
  description: string;
  icon: keyof typeof Ionicons.glyphMap;

  // ── Detail-screen content ──────────────────────────────────────────────
  /** The website's own breadcrumb label, e.g. "Varlikent / Architecture". */
  websiteLabel: string;
  /** Section eyebrow above the capability list — differs per service. */
  capabilitiesLabel: string;
  capabilitiesHeading: string;
  capabilities: ServiceCapability[];

  /**
   * The three optional sections below are what stop the four pages reading as
   * one template filled in four times. Each is present only where the website
   * actually has it: process on Architecture and Construction, the before/after
   * comparison on Renovation, the seismic note on Construction. Interior Design
   * has none, and is shorter as a result — which is honest.
   */
  process?: ServiceProcess;
  comparison?: ServiceComparison;
  note?: ServiceNote;

  /** Closing editorial lines. NOT a button — see the detail screen. */
  closingHeading: string;
  closingBody: string;
};

export const SERVICES: Service[] = [
  {
    id: 'architecture',
    title: 'Architecture',
    short: "Iconic designs rooted in Istanbul's heritage, built for the future.",
    description:
      "We design buildings that endure — rooted in Istanbul's heritage, shaped for the future.",
    icon: 'compass-outline',
    websiteLabel: 'Varlikent / Architecture',
    capabilitiesLabel: 'What We Offer',
    capabilitiesHeading: 'Services',
    capabilities: [
      {
        num: '01',
        title: 'Concept & Design',
        desc: 'From initial brief to detailed architectural plans — space that inspires.',
      },
      {
        num: '02',
        title: 'Structural Engineering',
        desc: 'Robust, code-compliant systems for every building typology.',
      },
      {
        num: '03',
        title: 'Urban Planning',
        desc: "Master plans aligned with Istanbul's evolving urban fabric.",
      },
      {
        num: '04',
        title: 'Project Management',
        desc: 'Full oversight from groundbreaking to handover.',
      },
    ],
    process: {
      heading: 'Process',
      steps: ['Brief & Research', 'Concept Design', 'Technical Development', 'Construction Oversight'],
    },
    closingHeading: 'Have a vision?',
    closingBody: 'Contact us to discuss your project.',
  },
  {
    id: 'construction',
    title: 'Construction',
    short: 'Turn-key builds delivered to the highest seismic and quality standards.',
    description: "High-performance construction for Istanbul's most ambitious developments.",
    icon: 'construct-outline',
    websiteLabel: 'Varlikent / Construction',
    capabilitiesLabel: 'What We Build',
    capabilitiesHeading: 'Construction Services',
    capabilities: [
      {
        num: '01',
        title: 'General Contracting',
        desc: 'Turn-key construction for residential, commercial and mixed-use developments.',
      },
      {
        num: '02',
        title: 'Structural Works',
        desc: 'Reinforced concrete and steel frame solutions built to seismic zone standards.',
      },
      {
        num: '03',
        title: 'MEP Engineering',
        desc: 'Mechanical, electrical and plumbing systems fully integrated into the build.',
      },
      {
        num: '04',
        title: 'Envelope & Façade',
        desc: 'Glass curtain walls, cladding systems and high-performance insulation.',
      },
    ],
    process: {
      heading: 'Our Process',
      steps: ['Site Survey', 'Foundation', 'Structural Frame', 'Fit-Out', 'Handover'],
    },
    note: {
      eyebrow: 'Built to Withstand',
      heading: 'Earthquake-Resistant Engineering',
      body: 'Istanbul sits in an active seismic zone. Every structure we deliver is engineered to current Turkish seismic design codes, with safety margins verified at each stage of construction — not assumed.',
    },
    closingHeading: 'Ready to Break Ground?',
    closingBody: 'Partner with our construction team for your next Istanbul development.',
  },
  {
    id: 'renovation',
    title: 'Renovation',
    short: 'Precision upgrades that transform existing spaces into premium properties.',
    description:
      'Transform any space with premium finishes, intelligent layout, and expert craftsmanship.',
    icon: 'hammer-outline',
    websiteLabel: 'Varlikent / Renovation',
    capabilitiesLabel: 'What We Do',
    capabilitiesHeading: 'Renovation Services',
    capabilities: [
      {
        num: '01',
        title: 'Window & Door Replacement',
        desc: 'Thermally broken aluminium and timber joinery with acoustic glazing.',
      },
      {
        num: '02',
        title: 'Structural Alterations',
        desc: 'Safe load-bearing modifications, wall removals and ceiling raising.',
      },
      {
        num: '03',
        title: 'Electrical & Lighting',
        desc: 'Full rewire, smart home integration and bespoke lighting design.',
      },
      {
        num: '04',
        title: 'Bathroom & Kitchen',
        desc: 'Marble wet rooms, bespoke cabinetry and premium appliance fit-out.',
      },
    ],
    comparison: {
      heading: 'Before & After',
      beforeLabel: 'Before',
      afterLabel: 'After',
      before: [
        'Dated finishes',
        'Poor natural lighting',
        'Inefficient layout',
        'Original 1990s fixtures',
      ],
      after: [
        'Premium marble surfaces',
        'Architectural lighting design',
        'Open-plan remodel',
        'Smart home integration',
      ],
    },
    closingHeading: 'Transform Your Space',
    closingBody: "Let's discuss your renovation project and bring your vision to life.",
  },
  {
    id: 'interior-design',
    title: 'Interior Design',
    short: 'Curated interiors crafted for sophisticated, effortless living.',
    description: 'Spaces that breathe sophistication — from the first concept to the final detail.',
    icon: 'color-palette-outline',
    websiteLabel: 'Varlikent / Interior Design',
    capabilitiesLabel: 'Our Expertise',
    capabilitiesHeading: 'Interior Design Services',
    capabilities: [
      {
        num: '01',
        title: 'Concept & Mood Boards',
        desc: 'Visual direction for every room — colour stories, material palettes and spatial flow.',
      },
      {
        num: '02',
        title: 'Furniture Sourcing',
        desc: 'Curated selection from Italian and Scandinavian premium suppliers, delivered and installed.',
      },
      {
        num: '03',
        title: 'Art & Accessories',
        desc: 'Original artwork, sculptures and decorative objects that elevate every corner.',
      },
      {
        num: '04',
        title: 'Lighting Design',
        desc: 'Layered ambient, task and accent lighting to create mood and highlight architecture.',
      },
    ],
    // No process and no comparison: the website's Interior Design page has
    // neither. Its extra surfaces are the 3D model and showroom, which are
    // API/WebGL features rather than copy, so this page is simply shorter.
    closingHeading: 'Design Your Dream Space',
    closingBody: 'Book a complimentary 30-minute consultation with our design team.',
  },
];

/**
 * Safely resolves a route param to a service.
 *
 * Route params are external input — `/services/banana` is a URL anyone can
 * type or deep-link. Returning `undefined` rather than casting to ServiceId
 * forces the screen to handle the miss instead of crashing on a property of
 * `undefined`.
 */
export function getServiceById(id: string | undefined): Service | undefined {
  if (!id) return undefined;
  return SERVICES.find((service) => service.id === id);
}

/**
 * The website's own summary of what the services add up to
 * (services.subheading). Used as the intro line on both surfaces.
 */
export const SERVICES_INTRO =
  'From the first sketch to the final sale — we cover every stage of the property lifecycle.';
