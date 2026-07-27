// Synthetic company and delegate generator with ≥40% GCC representation

const GCC_COUNTRIES = ['UAE', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Oman', 'Kuwait'];
const GCC_CITIES = [
  // UAE
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Fujairah',
  // Saudi Arabia
  'Riyadh', 'Jeddah', 'Dammam', 'Khobar',
  // Qatar
  'Doha', 'Al Rayyan',
  // Bahrain
  'Manama', 'Muharraq',
  // Oman
  'Muscat', 'Salalah',
  // Kuwait
  'Kuwait City', 'Hawalli'
];

const GLOBAL_CITIES = [
  'London', 'Singapore', 'Hong Kong', 'New York', 'Houston', 'Rotterdam',
  'Hamburg', 'Shanghai', 'Mumbai', 'Tokyo', 'Sydney', 'Toronto',
  'São Paulo', 'Mexico City', 'Buenos Aires', 'Cape Town', 'Lagos',
  'Istanbul', 'Moscow', 'Delhi', 'Bangkok', 'Manila', 'Jakarta'
];

const COMPANY_SUFFIXES = [
  'Trading LLC', 'Global Ltd', 'International Corp', 'Holdings Ltd',
  'Commodities Ltd', 'Trading Co', 'Energy LLC', 'Resources Ltd',
  'International Trading', 'Global Solutions', 'Trading House',
  'Metals Ltd', 'Energy Corp', 'International LLC', 'Trading FZ'
];

const INDUSTRY_PREFIXES = [
  'Gulf', 'Emirates', 'Arabian', 'Middle East', 'Global', 'International',
  'Premium', 'Elite', 'Prime', 'Strategic', 'Advanced', 'Superior',
  'United', 'Royal', 'Imperial', 'Continental', 'Trans', 'Metro',
  'Alpha', 'Delta', 'Omega', 'Apex', 'Summit', 'Peak'
];

const ARABIC_NAMES = {
  male: [
    'Ahmed', 'Mohammed', 'Abdullah', 'Omar', 'Khalid', 'Ali', 'Hassan', 'Saeed',
    'Rashid', 'Hamad', 'Faisal', 'Tariq', 'Nasser', 'Mansour', 'Waleed', 'Youssef'
  ],
  female: [
    'Fatima', 'Aisha', 'Maryam', 'Zahra', 'Amina', 'Layla', 'Sara', 'Noor',
    'Haya', 'Reem', 'Yasmin', 'Salma', 'Dina', 'Rana', 'Lina', 'Jana'
  ],
  surnames: [
    'Al-Rashid', 'Al-Maktoum', 'Al-Thani', 'Al-Sabah', 'Al-Khalifa', 'Al-Said',
    'Al-Nuaimi', 'Al-Mansouri', 'Al-Zaabi', 'Al-Shamsi', 'Al-Marri', 'Al-Kuwari'
  ]
};

const GLOBAL_NAMES = {
  male: [
    'James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Joseph',
    'Thomas', 'Christopher', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Donald', 'Steven',
    'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Edward',
    'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas'
  ],
  female: [
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica',
    'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Helen', 'Sandra', 'Donna',
    'Carol', 'Ruth', 'Sharon', 'Michelle', 'Laura', 'Sarah', 'Kimberly', 'Deborah',
    'Dorothy', 'Lisa', 'Nancy', 'Karen', 'Betty', 'Helen', 'Sandra', 'Donna'
  ],
  surnames: [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
    'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
    'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young'
  ]
};

const ROLE_TITLES = [
  'Trading Manager',
  'Senior Trader',
  'Chief Procurement Officer',
  'Commodity Specialist',
  'Business Development Director',
  'Regional Sales Manager',
  'Supply Chain Director',
  'Market Analyst',
  'Trading Director',
  'Procurement Specialist',
  'Energy Trading Manager',
  'Metals Trading Specialist',
  'Agricultural Trader',
  'Precious Metals Specialist',
  'Commodity Trading Director',
  'Senior Procurement Manager'
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateCompanyName(isGCC: boolean): { name: string; location: string; country: string } {
  const prefix = getRandomElement(INDUSTRY_PREFIXES);
  const suffix = getRandomElement(COMPANY_SUFFIXES);
  
  if (isGCC) {
    const city = getRandomElement(GCC_CITIES);
    const country = GCC_COUNTRIES.find(c => 
      (c === 'UAE' && ['Dubai', 'Abu Dhabi', 'Sharjah', 'Fujairah'].includes(city)) ||
      (c === 'Saudi Arabia' && ['Riyadh', 'Jeddah', 'Dammam', 'Khobar'].includes(city)) ||
      (c === 'Qatar' && ['Doha', 'Al Rayyan'].includes(city)) ||
      (c === 'Bahrain' && ['Manama', 'Muharraq'].includes(city)) ||
      (c === 'Oman' && ['Muscat', 'Salalah'].includes(city)) ||
      (c === 'Kuwait' && ['Kuwait City', 'Hawalli'].includes(city))
    ) || 'UAE';
    
    return {
      name: `${prefix} ${suffix}`,
      location: `${city}, ${country}`,
      country
    };
  } else {
    const city = getRandomElement(GLOBAL_CITIES);
    const country = city === 'London' ? 'UK' : 
                   city === 'Singapore' ? 'Singapore' :
                   city === 'Hong Kong' ? 'Hong Kong' :
                   city === 'New York' || city === 'Houston' ? 'USA' :
                   city === 'Rotterdam' || city === 'Hamburg' ? 'Netherlands' :
                   city === 'Shanghai' ? 'China' :
                   city === 'Mumbai' || city === 'Delhi' ? 'India' :
                   city === 'Tokyo' ? 'Japan' :
                   city === 'Sydney' ? 'Australia' :
                   city === 'Toronto' ? 'Canada' :
                   city === 'São Paulo' ? 'Brazil' :
                   'International';
                   
    return {
      name: `${prefix} ${suffix}`,
      location: `${city}, ${country}`,
      country
    };
  }
}

function generateDelegate(isGCC: boolean): { 
  fullName: string; 
  firstName: string; 
  lastName: string; 
  roleTitle: string; 
  isAuthorized: boolean 
} {
  const roleTitle = getRandomElement(ROLE_TITLES);
  const isAuthorized = Math.random() > 0.15; // 85% authorized
  
  if (isGCC) {
    const gender = Math.random() > 0.7 ? 'female' : 'male'; // 30% female
    const firstName = getRandomElement(ARABIC_NAMES[gender]);
    const lastName = getRandomElement(ARABIC_NAMES.surnames);
    
    return {
      fullName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      roleTitle,
      isAuthorized
    };
  } else {
    const gender = Math.random() > 0.5 ? 'female' : 'male';
    const firstName = getRandomElement(GLOBAL_NAMES[gender]);
    const lastName = getRandomElement(GLOBAL_NAMES.surnames);
    
    return {
      fullName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      roleTitle,
      isAuthorized
    };
  }
}

export function generateSyntheticIdentity(): {
  company: {
    id: string;
    name: string;
    location: string;
    country: string;
    verified: boolean;
    rating: number;
  };
  delegate: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    roleTitle: string;
    isAuthorized: boolean;
  };
} {
  // Ensure ≥40% GCC representation
  const isGCC = Math.random() < 0.45; // Slightly higher to ensure we meet minimum
  
  const company = generateCompanyName(isGCC);
  const delegate = generateDelegate(isGCC);
  
  return {
    company: {
      id: `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: company.name,
      location: company.location,
      country: company.country,
      verified: Math.random() > 0.1, // 90% verified
      rating: Math.round((Math.random() * 1.5 + 3.5) * 10) / 10 // 3.5-5.0 rating
    },
    delegate: {
      id: `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fullName: delegate.fullName,
      firstName: delegate.firstName,
      lastName: delegate.lastName,
      roleTitle: delegate.roleTitle,
      isAuthorized: delegate.isAuthorized
    }
  };
}

export function seedMissingIdentities(offers: any[]): any[] {
  return offers.map(offer => {
    // Check if company/delegate info is missing or incomplete
    const needsCompany = !offer.sellerOrgName || !offer.sellerOrgId;
    const needsDelegate = !offer.delegateFullName || !offer.delegateId;
    
    if (needsCompany || needsDelegate) {
      const identity = generateSyntheticIdentity();
      
      return {
        ...offer,
        // Company info
        sellerOrgId: offer.sellerOrgId || identity.company.id,
        sellerOrgName: offer.sellerOrgName || identity.company.name,
        sellerOrgVerified: offer.sellerOrgVerified ?? identity.company.verified,
        sellerOrgRating: offer.sellerOrgRating || identity.company.rating,
        sellerOrgLocation: offer.sellerOrgLocation || identity.company.location,
        sellerOrgCountry: offer.sellerOrgCountry || identity.company.country,
        
        // Delegate info
        delegateId: offer.delegateId || identity.delegate.id,
        delegateFullName: offer.delegateFullName || identity.delegate.fullName,
        delegateRoleTitle: offer.delegateRoleTitle || identity.delegate.roleTitle,
        delegateIsAuthorized: offer.delegateIsAuthorized ?? identity.delegate.isAuthorized
      };
    }
    
    return offer;
  });
}