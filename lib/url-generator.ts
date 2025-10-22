// Cute phrase-based URL generator for sharing documents
// Generates URLs like: /glowy-worm-like-santa-9a4b

const adjectives = [
  'glowy', 'happy', 'sleepy', 'bouncy', 'fuzzy', 'shiny', 'cosmic', 'magical',
  'dreamy', 'sparkly', 'misty', 'cloudy', 'starry', 'lunar', 'solar', 'crystal',
  'fluffy', 'silky', 'velvet', 'golden', 'silver', 'bronze', 'radiant', 'vibrant',
  'peaceful', 'calm', 'gentle', 'soft', 'warm', 'cool', 'breezy', 'stormy',
  'sunny', 'rainy', 'snowy', 'frosty', 'icy', 'fiery', 'blazing', 'glowing',
  'twinkling', 'dazzling', 'gleaming', 'luminous', 'brilliant', 'vivid', 'bright',
  'pastel', 'neon', 'electric', 'magnetic', 'dynamic', 'energetic', 'playful',
  'quirky', 'whimsical', 'cheerful', 'jolly', 'merry', 'festive', 'cozy', 'snug',
  'tiny', 'mini', 'micro', 'giant', 'mega', 'ultra', 'super', 'hyper',
  'swift', 'speedy', 'rapid', 'quick', 'fast', 'slow', 'lazy', 'chill',
  'zen', 'serene', 'tranquil', 'mystic', 'ancient', 'modern', 'retro', 'vintage',
  'pixel', 'quantum', 'cyber', 'digital', 'analog', 'mechanical', 'organic', 'wild',
  'tame', 'noble', 'royal', 'majestic', 'humble', 'simple', 'complex', 'elegant',
]

const nouns = [
  'worm', 'butterfly', 'dragon', 'phoenix', 'unicorn', 'pegasus', 'griffin', 'kraken',
  'panda', 'koala', 'otter', 'penguin', 'dolphin', 'whale', 'octopus', 'jellyfish',
  'rabbit', 'fox', 'wolf', 'bear', 'tiger', 'lion', 'eagle', 'hawk',
  'owl', 'raven', 'sparrow', 'robin', 'cardinal', 'bluejay', 'hummingbird', 'flamingo',
  'turtle', 'snail', 'hedgehog', 'squirrel', 'chipmunk', 'raccoon', 'badger', 'meerkat',
  'lemur', 'sloth', 'armadillo', 'platypus', 'narwhal', 'axolotl', 'capybara', 'quokka',
  'cloud', 'star', 'moon', 'sun', 'comet', 'meteor', 'galaxy', 'nebula',
  'planet', 'asteroid', 'cosmos', 'void', 'aurora', 'prism', 'crystal', 'gem',
  'diamond', 'ruby', 'emerald', 'sapphire', 'topaz', 'amber', 'jade', 'pearl',
  'wave', 'tide', 'reef', 'shore', 'bay', 'cove', 'island', 'archipelago',
  'mountain', 'valley', 'canyon', 'mesa', 'plateau', 'peak', 'summit', 'ridge',
  'forest', 'grove', 'meadow', 'prairie', 'tundra', 'desert', 'oasis', 'jungle',
  'river', 'stream', 'creek', 'brook', 'waterfall', 'cascade', 'rapids', 'delta',
  'breeze', 'gust', 'zephyr', 'tempest', 'monsoon', 'typhoon', 'cyclone', 'vortex',
]

const connectors = [
  'like', 'with', 'near', 'over', 'under', 'beside', 'beyond', 'through',
  'across', 'around', 'among', 'within', 'without', 'against', 'between', 'beneath',
  'behind', 'before', 'above', 'below', 'inside', 'outside', 'toward', 'past',
]

const contexts = [
  'santa', 'wizard', 'knight', 'ninja', 'pirate', 'robot', 'alien', 'ghost',
  'vampire', 'werewolf', 'mermaid', 'fairy', 'elf', 'dwarf', 'giant', 'goblin',
  'troll', 'ogre', 'demon', 'angel', 'goddess', 'hero', 'villain', 'champion',
  'explorer', 'adventurer', 'traveler', 'wanderer', 'seeker', 'guardian', 'sentinel', 'keeper',
  'sage', 'scholar', 'student', 'teacher', 'master', 'apprentice', 'mentor', 'guide',
  'artist', 'poet', 'musician', 'dancer', 'singer', 'painter', 'sculptor', 'writer',
  'chef', 'baker', 'brewer', 'gardener', 'farmer', 'shepherd', 'hunter', 'fisher',
  'sailor', 'captain', 'admiral', 'pilot', 'astronaut', 'cosmonaut', 'voyager', 'pioneer',
  'scientist', 'inventor', 'engineer', 'architect', 'designer', 'creator', 'maker', 'builder',
  'dreamscape', 'wonderland', 'paradise', 'utopia', 'haven', 'sanctuary', 'refuge', 'retreat',
  'kingdom', 'empire', 'realm', 'domain', 'territory', 'land', 'world', 'dimension',
  'library', 'archive', 'museum', 'gallery', 'studio', 'workshop', 'laboratory', 'observatory',
  'festival', 'carnival', 'celebration', 'ceremony', 'ritual', 'gathering', 'assembly', 'council',
  'market', 'bazaar', 'plaza', 'square', 'forum', 'arena', 'stadium', 'coliseum',
]

// Generate a random alphanumeric code (4 characters)
function generateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// Generate a cute phrase-based URL slug
export function generateShareableSlug(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const connector = connectors[Math.floor(Math.random() * connectors.length)]
  const context = contexts[Math.floor(Math.random() * contexts.length)]
  const code = generateCode()

  return `${adjective}-${noun}-${connector}-${context}-${code}`
}

// Generate multiple unique slugs for user to choose from
export function generateShareableSlugs(count: number = 5): string[] {
  const slugs = new Set<string>()

  while (slugs.size < count) {
    slugs.add(generateShareableSlug())
  }

  return Array.from(slugs)
}

// Validate slug format
export function isValidSlug(slug: string): boolean {
  // Must be: word-word-word-word-4chars
  // Each word part can contain letters and numbers, but no special chars except hyphen
  const pattern = /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]{4}$/
  return pattern.test(slug)
}

// Extract the 4-character code from a slug
export function extractCodeFromSlug(slug: string): string | null {
  if (!isValidSlug(slug)) return null
  const parts = slug.split('-')
  return parts[parts.length - 1]
}

// Calculate total possible combinations
export function getTotalCombinations(): number {
  // adjectives × nouns × connectors × contexts × codes
  // codes: 36^4 = 1,679,616 possible 4-char alphanumeric codes
  const codeVariations = Math.pow(36, 4)
  return adjectives.length * nouns.length * connectors.length * contexts.length * codeVariations
}

// Usage example:
// const slug = generateShareableSlug()
// console.log(slug) // e.g., "glowy-worm-like-santa-9a4b"
//
// const slugs = generateShareableSlugs(5)
// console.log(slugs) // Array of 5 unique slugs for user to choose from
//
// Total combinations: ~2.5 trillion unique URLs
