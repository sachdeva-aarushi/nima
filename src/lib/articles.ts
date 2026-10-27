export type ArticleCategory =
  // Legacy curated categories (static partner library)
  | "mindfulness"
  | "recovery"
  | "feeding"
  | "sleep"
  | "mood"
  | "wisdom"
  | "support"
  | "nutrition"
  // Web-fetched library categories
  | "mental health"
  | "relationships"
  | "body"
  | "milestones";

export type ArticleAudience = "mother" | "partner" | "both";

export interface Article {
  slug: string;
  title: string;
  summary: string;
  body: string;
  readMinutes: number;
  author: string;
  category: ArticleCategory;
  audience: ArticleAudience;
  featured?: boolean;
  image: string; // unsplash url
  hasVideo?: boolean;
}

/** Article record from the DB (web-sourced, refreshed weekly). */
export interface FetchedArticle {
  slug: string;
  title: string;
  summary: string;
  source_name: string | null;
  source_url: string | null;
  category: string;
  image: string | null;
  is_curated: boolean;
  fetched_at: string;
}

const u = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const CATEGORY_META: Record<ArticleCategory, { label: string; bg: string; fg: string }> = {
  mindfulness: { label: "MINDFULNESS", bg: "#E6F0E7", fg: "#5C8A6A" },
  recovery:    { label: "RECOVERY",    bg: "#FDE7E4", fg: "#D4726D" },
  feeding:     { label: "FEEDING",     bg: "#FFF1D6", fg: "#B07A2C" },
  sleep:       { label: "SLEEP",       bg: "#EAE9F8", fg: "#6E73C2" },
  mood:        { label: "MOOD",        bg: "#FCE3EE", fg: "#C56291" },
  wisdom:      { label: "WISDOM",      bg: "#F1E8DC", fg: "#8A6E3D" },
  support:     { label: "SUPPORTING HER", bg: "#FFE4DA", fg: "#C25A3E" },
  nutrition:   { label: "NUTRITION",   bg: "#E8F2D8", fg: "#5F7A36" },
  "mental health": { label: "MENTAL HEALTH", bg: "#FCE3EE", fg: "#C56291" },
  relationships:   { label: "RELATIONSHIPS", bg: "#FFE4DA", fg: "#C25A3E" },
  body:            { label: "BODY",          bg: "#FDE7E4", fg: "#D4726D" },
  milestones:      { label: "MILESTONES",    bg: "#F1E8DC", fg: "#8A6E3D" },
};

export function categoryMeta(cat: string): { label: string; bg: string; fg: string } {
  return (CATEGORY_META as Record<string, { label: string; bg: string; fg: string }>)[cat] ?? {
    label: cat.toUpperCase(),
    bg: "#F1E8DC",
    fg: "#8A6E3D",
  };
}

export const ARTICLES: Article[] = [
  {
    slug: "radical-self-compassion",
    title: "The art of radical self-compassion",
    summary: "A gentle practice for the hardest mothering days.",
    body: "Self-compassion is not a luxury during postpartum — it is the medicine. When the inner critic gets loud, pause, place a hand on your heart, and offer yourself the words you would offer a dear friend.",
    readMinutes: 12,
    author: "Dr. Selena Voss",
    category: "mindfulness",
    audience: "mother",
    featured: true,
    image: u("photo-1519710164239-da123dc03ef4"),
  },
  {
    slug: "rest-in-small-moments",
    title: "Finding rest in the small moments",
    summary: "Micro-rests that restore when full sleep is impossible.",
    body: "True rest can live in a single mindful breath. This is a practice of weaving recovery into the cracks of your day, not waiting for a perfect window that may not come for months.",
    readMinutes: 5,
    author: "Maya Chen, IBCLC",
    category: "mindfulness",
    audience: "mother",
    image: u("photo-1495197359483-d092478c170a"),
  },
  {
    slug: "gentle-pelvic-floor",
    title: "Gentle pelvic floor movement",
    summary: "Safe, slow rebuilding for your core in the early weeks.",
    body: "The pelvic floor heals best with breath, not force. This series of gentle exhalation-led movements can be done lying down.",
    readMinutes: 8,
    author: "Dr. Imani Roy, DPT",
    category: "recovery",
    audience: "mother",
    image: u("photo-1518611012118-696072aa579a"),
    hasVideo: true,
  },
  {
    slug: "nourish-iron",
    title: "Nourishing foods for postpartum iron",
    summary: "Warm, easy meals that gently rebuild her blood.",
    body: "After birth, iron stores are often depleted. Slow-cooked lentils, dark leafy greens with lemon, and warm beet soups are kind to a tender digestive system.",
    readMinutes: 6,
    author: "Naomi Park, RD",
    category: "nutrition",
    audience: "both",
    image: u("photo-1490645935967-10de6ba17061"),
  },
  {
    slug: "night-feed-survival",
    title: "Surviving the 3 a.m. feed",
    summary: "Tiny rituals that make the loneliest hour bearable.",
    body: "A warm lamp, a saved playlist, a glass of water already by the chair. Pre-arranged kindness from your daytime self.",
    readMinutes: 4,
    author: "Maya Chen, IBCLC",
    category: "sleep",
    audience: "mother",
    image: u("photo-1455642305367-68834a1da7ab"),
  },
  {
    slug: "mood-weather",
    title: "When sadness feels like weather",
    summary: "Tracking emotional patterns without judging them.",
    body: "Some days mood arrives like a passing storm. Naming it as weather — not identity — can soften its edges.",
    readMinutes: 7,
    author: "Dr. Selena Voss",
    category: "mood",
    audience: "mother",
    image: u("photo-1499346030926-9a72daac6c63"),
  },
  {
    slug: "latch-without-pain",
    title: "Latching without pain",
    summary: "Three adjustments most parents are never taught.",
    body: "Pain is information, not destiny. Asymmetric latch, nose-to-nipple alignment, and a relaxed jaw can change everything.",
    readMinutes: 9,
    author: "Maya Chen, IBCLC",
    category: "feeding",
    audience: "mother",
    image: u("photo-1559757175-7cb056fba93d"),
  },
  {
    slug: "partner-script",
    title: "A script for asking your partner for more",
    summary: "Concrete language when 'I need help' feels too big.",
    body: "Try: 'Tonight I need you to take the 11 p.m. feed so I can sleep four hours in a row.' Specific asks land better than general ones.",
    readMinutes: 5,
    author: "Dr. Selena Voss",
    category: "mood",
    audience: "mother",
    image: u("photo-1529626455594-4ff0802cfb7e"),
  },
  {
    slug: "scar-massage",
    title: "Gentle scar massage after a c-section",
    summary: "When and how to begin, with your provider's blessing.",
    body: "Around 6–8 weeks, once cleared, slow circular touch can reduce adhesions and reconnect you to a tender part of your story.",
    readMinutes: 6,
    author: "Dr. Imani Roy, DPT",
    category: "recovery",
    audience: "mother",
    image: u("photo-1544027993-37dbfe43562a"),
    hasVideo: true,
  },
  {
    slug: "breath-anchor",
    title: "The four-count breath anchor",
    summary: "A 60-second nervous-system reset for hard moments.",
    body: "Inhale four, hold four, exhale six, rest two. Three rounds. That's it.",
    readMinutes: 3,
    author: "Maya Chen, IBCLC",
    category: "mindfulness",
    audience: "both",
    image: u("photo-1506126613408-eca07ce68773"),
  },
  {
    slug: "warm-belly-oil",
    title: "Warm oil belly massage tradition",
    summary: "An ancient practice for nervous-system soothing.",
    body: "Across many cultures, warm sesame or castor oil applied to the belly in slow clockwise circles supports digestion and a sense of being held.",
    readMinutes: 5,
    author: "Naomi Park, RD",
    category: "recovery",
    audience: "mother",
    image: u("photo-1556228720-195a672e8a03"),
  },
  {
    slug: "intrusive-thoughts",
    title: "When scary thoughts arrive uninvited",
    summary: "Intrusive thoughts are common — and rarely dangerous.",
    body: "Up to 90% of new parents experience intrusive thoughts. Naming them out loud to a trusted person almost always shrinks them.",
    readMinutes: 8,
    author: "Dr. Selena Voss",
    category: "mood",
    audience: "both",
    image: u("photo-1499209974431-9dddcece7f88"),
  },
  {
    slug: "village-of-one",
    title: "Building a village when you feel alone",
    summary: "Modern strategies for ancient support needs.",
    body: "The village is not gone — it is just scattered. Text threads, postpartum doulas, online circles, one weekly walk with one neighbor.",
    readMinutes: 7,
    author: "Dr. Selena Voss",
    category: "wisdom",
    audience: "both",
    image: u("photo-1543269664-7eef42226a21"),
  },
  {
    slug: "hydration-truth",
    title: "Hydration: more than just water",
    summary: "Why broths and warm drinks restore differently.",
    body: "Postpartum tissues crave warm, mineral-rich liquids. Bone broth, coconut water, and warm herbal infusions hydrate at a cellular level water alone cannot reach.",
    readMinutes: 5,
    author: "Naomi Park, RD",
    category: "nutrition",
    audience: "both",
    image: u("photo-1547592180-85f173990554"),
  },
  {
    slug: "first-walk",
    title: "Your first walk outside",
    summary: "Why ten minutes of daylight matters so much.",
    body: "Morning light within the first hour of waking sets your circadian rhythm, lifts mood, and helps the baby's sleep too.",
    readMinutes: 4,
    author: "Dr. Imani Roy, DPT",
    category: "mindfulness",
    audience: "both",
    image: u("photo-1551632811-561732d1e306"),
  },
  {
    slug: "postpartum-anxiety",
    title: "Understanding postpartum anxiety",
    summary: "When worry becomes something more.",
    body: "Persistent racing thoughts, inability to sleep when the baby sleeps, or constant checking can be signs of postpartum anxiety — a real and treatable condition.",
    readMinutes: 10,
    author: "Dr. Selena Voss",
    category: "mood",
    audience: "both",
    image: u("photo-1517245386807-bb43f82c33c4"),
  },
  {
    slug: "milk-supply-myths",
    title: "Five myths about milk supply",
    summary: "What the research actually says.",
    body: "Most parents make enough milk. Cluster feeding is not a supply problem. Pump output is not supply. Your baby's behavior is rarely about hunger alone.",
    readMinutes: 8,
    author: "Maya Chen, IBCLC",
    category: "feeding",
    audience: "mother",
    image: u("photo-1444212477490-ca407925329e"),
  },
  {
    slug: "sleep-when-baby-sleeps",
    title: "Why 'sleep when the baby sleeps' fails",
    summary: "And what to do instead.",
    body: "Hormonal shifts mean your body may not drop into sleep on demand. Building a wind-down ritual — even five minutes — helps more than trying harder.",
    readMinutes: 6,
    author: "Dr. Selena Voss",
    category: "sleep",
    audience: "mother",
    image: u("photo-1520206183501-b80df61043c2"),
  },
  {
    slug: "honoring-the-fourth-trimester",
    title: "Honoring the fourth trimester",
    summary: "The first twelve weeks belong to healing.",
    body: "For the first twelve weeks, her body is doing the quiet work of returning. Slow is not lazy. Soft is not weak.",
    readMinutes: 5,
    author: "Dr. Selena Voss",
    category: "wisdom",
    audience: "both",
    image: u("photo-1517677208171-0bc6725a3e60"),
  },

  // ─── Partner-focused articles ──────────────────────────────────────────
  {
    slug: "how-to-support-pp-depression",
    title: "How to support your partner through postpartum depression",
    summary: "Knowing the signs, when to step in, and how to bring it up gently.",
    body: "Postpartum depression isn't a phase to wait out. Watch for two-week-long shifts in sleep, appetite, or withdrawal. Bring it up softly: 'I've noticed you haven't been yourself — I'm here, and we can call someone together if you want.' Offer to make the appointment, drive her there, and sit in the waiting room. Don't disappear; don't fix. Just stay close.",
    readMinutes: 9,
    author: "Dr. Selena Voss",
    category: "support",
    audience: "partner",
    featured: true,
    image: u("photo-1518621736915-f3b1c41bfd00"),
  },
  {
    slug: "practical-task-sharing",
    title: "A practical guide to sharing the load",
    summary: "Concrete tasks that take the most pressure off in week 1-12.",
    body: "Take ownership, not assistance. Own the dishes, the laundry pile, the trash, the grocery list, the night diaper changes between feeds. Don't ask 'what can I do' — pick a domain and run it without check-ins. The mental load is invisible but exhausting; lifting it matters as much as lifting the baby.",
    readMinutes: 7,
    author: "Dr. Selena Voss",
    category: "support",
    audience: "partner",
    image: u("photo-1556909114-f6e7ad7d3136"),
  },
  {
    slug: "language-that-helps",
    title: "Things to say (and not say) in the first weeks",
    summary: "Small phrasing shifts that change how supported she feels.",
    body: "Avoid 'at least the baby is healthy' or 'you should sleep when the baby sleeps.' Try instead: 'You're doing the hardest job in the world,' or 'I see how much you're carrying.' Validation lands harder than advice. Ask 'how are you, really?' and then be quiet long enough to hear the answer.",
    readMinutes: 5,
    author: "Dr. Selena Voss",
    category: "support",
    audience: "partner",
    image: u("photo-1529626455594-4ff0802cfb7e"),
  },
  {
    slug: "partner-night-shifts",
    title: "How to take a real night shift",
    summary: "Letting her get one solid block of sleep changes everything.",
    body: "Even if she's nursing, you can take the 8pm-1am block: pumped bottle, diapers, soothing. Five hours of unbroken sleep restores her more than ten hours of fragmented rest. Use earplugs for her side of the bed and bring the baby to her only if absolutely needed.",
    readMinutes: 6,
    author: "Maya Chen, IBCLC",
    category: "support",
    audience: "partner",
    image: u("photo-1455642305367-68834a1da7ab"),
  },
  {
    slug: "cooking-for-postpartum",
    title: "Cooking for postpartum recovery",
    summary: "Warm, iron-rich meals you can prep in 20 minutes.",
    body: "Her body needs warm, mineral-rich, easy-to-digest food. Slow-cooked lentil dal, chicken bone broth, oatmeal with dates and ghee, and roasted root vegetables. Avoid cold smoothies and raw salads in the early weeks — many cultures consider them too 'cooling' for a healing body.",
    readMinutes: 8,
    author: "Naomi Park, RD",
    category: "nutrition",
    audience: "partner",
    image: u("photo-1547592180-85f173990554"),
  },
  {
    slug: "understanding-fourth-trimester-partner",
    title: "What's happening in her body right now",
    summary: "A partner's primer on the first 12 weeks postpartum.",
    body: "Her uterus is shrinking, her hormones are crashing, her pelvic floor is rebuilding, and she may be bleeding for up to six weeks. Night sweats, hair loss around month four, and tearfulness are all normal. Knowing this isn't pity — it's respect for what she's done.",
    readMinutes: 7,
    author: "Dr. Imani Roy, DPT",
    category: "wisdom",
    audience: "partner",
    image: u("photo-1517677208171-0bc6725a3e60"),
  },
  {
    slug: "intimacy-after-birth",
    title: "Intimacy and connection after birth",
    summary: "Closeness without pressure in the first months.",
    body: "Sex usually waits 6+ weeks at minimum, and often longer — that's biology, not rejection. Real intimacy now looks like a foot rub, a long hug, bringing her coffee, holding the baby so she can shower alone. Connection rebuilds slowly.",
    readMinutes: 6,
    author: "Dr. Selena Voss",
    category: "support",
    audience: "partner",
    image: u("photo-1518621736915-f3b1c41bfd00"),
  },
  {
    slug: "partner-own-mental-health",
    title: "Your mental health matters too",
    summary: "Up to 1 in 10 partners experience postpartum depression.",
    body: "You can be exhausted, anxious, or low and still be a great partner. Talk to your own doctor, a friend, or a therapist. Protecting your mental health isn't selfish — it's how you stay present for her and the baby.",
    readMinutes: 5,
    author: "Dr. Selena Voss",
    category: "wisdom",
    audience: "partner",
    image: u("photo-1499209974431-9dddcece7f88"),
  },
];

export const QUICK_WISDOM = "Your capacity to mother is born from your capacity to nurture yourself first.";
export const QUICK_WISDOM_PARTNER = "Showing up — quietly, daily, without being asked — is the gift she will remember.";

export function getArticle(slug: string) {
  return ARTICLES.find((a) => a.slug === slug);
}

export function relatedArticles(slug: string, n = 2) {
  const a = getArticle(slug);
  if (!a) return [];
  return ARTICLES.filter((x) => x.slug !== slug && x.category === a.category).slice(0, n);
}

export function articlesForAudience(audience: "mother" | "partner"): Article[] {
  return ARTICLES.filter((a) => a.audience === audience || a.audience === "both");
}
