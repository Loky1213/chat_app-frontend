// ---------------------------------------------------------------------------
// lib/emojis.ts — Scalable, production-ready emoji system
// No external libraries. Frontend-only. SSR-safe.
// ---------------------------------------------------------------------------

// ── Type ──────────────────────────────────────────────────────────────────────

export type Emoji = {
  emoji: string;
  name: string;
  keywords: string[];
  category: string;
  /** Pre-computed for O(n) search without runtime `.toLowerCase()` */
  nameLower: string;
  /** Pre-computed for O(n) search without runtime `.toLowerCase()` */
  keywordsLower: string[];
};

// ── Helper to build an Emoji record with precomputed lowercase ────────────────

const e = (
  emoji: string,
  name: string,
  keywords: string[],
  category: string,
): Emoji => ({
  emoji,
  name,
  keywords,
  category,
  nameLower: name.toLowerCase(),
  keywordsLower: keywords.map(k => k.toLowerCase()),
});

// ── Category ordering for UI tabs ─────────────────────────────────────────────

export const CATEGORY_ORDER: string[] = [
  'Smileys',
  'Gestures',
  'Love',
  'Reactions',
  'Animals',
  'Food',
  'Objects',
];

// ── Full Dataset ──────────────────────────────────────────────────────────────

export const EMOJIS: Emoji[] = [
  // ─── Smileys ────────────────────────────────────────────────────────
  e('😀', 'grinning face', ['smile', 'happy', 'grin', 'joy'], 'Smileys'),
  e('😁', 'beaming face', ['grin', 'happy', 'teeth', 'smile'], 'Smileys'),
  e('😂', 'face with tears of joy', ['laugh', 'lol', 'funny', 'haha', 'crying laughing'], 'Smileys'),
  e('🤣', 'rolling on the floor laughing', ['rofl', 'lmao', 'laugh', 'hilarious'], 'Smileys'),
  e('😄', 'grinning face with smiling eyes', ['smile', 'happy', 'cheerful', 'glad'], 'Smileys'),
  e('😅', 'grinning face with sweat', ['sweat', 'nervous', 'awkward', 'relief'], 'Smileys'),
  e('😆', 'squinting face with open mouth', ['laugh', 'xd', 'happy', 'haha'], 'Smileys'),
  e('😉', 'winking face', ['wink', 'flirt', 'playful'], 'Smileys'),
  e('😊', 'smiling face with smiling eyes', ['blush', 'happy', 'shy', 'pleased'], 'Smileys'),
  e('😇', 'smiling face with halo', ['angel', 'innocent', 'halo', 'saint'], 'Smileys'),
  e('😍', 'smiling face with heart-eyes', ['heart eyes', 'love', 'crush', 'adore'], 'Smileys'),
  e('🤩', 'star-struck', ['star struck', 'wow', 'amazing', 'excited', 'starstruck'], 'Smileys'),
  e('😘', 'face blowing a kiss', ['kiss', 'love', 'muah', 'smooch'], 'Smileys'),
  e('😛', 'face with tongue', ['tongue', 'playful', 'silly', 'tease'], 'Smileys'),
  e('🤔', 'thinking face', ['thinking', 'hmm', 'wonder', 'consider', 'ponder'], 'Smileys'),
  e('🤫', 'shushing face', ['shush', 'quiet', 'secret', 'hush'], 'Smileys'),
  e('🤐', 'zipper-mouth face', ['zipper', 'mute', 'silent', 'secret'], 'Smileys'),
  e('🤨', 'face with raised eyebrow', ['raised eyebrow', 'skeptical', 'suspicious', 'doubt'], 'Smileys'),
  e('😐', 'neutral face', ['neutral', 'blank', 'meh', 'indifferent'], 'Smileys'),
  e('😑', 'expressionless face', ['expressionless', 'blank', 'deadpan', 'unimpressed'], 'Smileys'),
  e('😒', 'unamused face', ['unamused', 'bored', 'meh', 'annoyed'], 'Smileys'),
  e('🙄', 'face with rolling eyes', ['roll eyes', 'annoyed', 'whatever', 'sigh'], 'Smileys'),
  e('😬', 'grimacing face', ['grimace', 'awkward', 'cringe', 'yikes'], 'Smileys'),
  e('😌', 'relieved face', ['relieved', 'calm', 'peaceful', 'content'], 'Smileys'),
  e('😔', 'pensive face', ['pensive', 'sad', 'disappointed', 'down'], 'Smileys'),
  e('😴', 'sleeping face', ['sleep', 'tired', 'zzz', 'nap', 'snore'], 'Smileys'),
  e('🤤', 'drooling face', ['drool', 'yummy', 'hungry', 'delicious'], 'Smileys'),
  e('😋', 'face savoring food', ['yum', 'delicious', 'tasty', 'hungry'], 'Smileys'),
  e('😎', 'smiling face with sunglasses', ['cool', 'sunglasses', 'swag', 'awesome'], 'Smileys'),
  e('🤓', 'nerd face', ['nerd', 'geek', 'smart', 'glasses'], 'Smileys'),
  e('😕', 'confused face', ['confused', 'puzzled', 'unsure'], 'Smileys'),
  e('😟', 'worried face', ['worried', 'concerned', 'anxious', 'nervous'], 'Smileys'),
  e('☹️', 'frowning face', ['frown', 'sad', 'unhappy'], 'Smileys'),
  e('😮', 'face with open mouth', ['open mouth', 'surprised', 'wow', 'gasp'], 'Smileys'),
  e('😯', 'hushed face', ['hushed', 'surprised', 'stunned', 'shocked'], 'Smileys'),
  e('😲', 'astonished face', ['astonished', 'shocked', 'amazed', 'wow'], 'Smileys'),
  e('😳', 'flushed face', ['flushed', 'embarrassed', 'shy', 'blushing'], 'Smileys'),
  e('🥺', 'pleading face', ['pleading', 'puppy eyes', 'please', 'begging'], 'Smileys'),
  e('😢', 'crying face', ['cry', 'sad', 'tear', 'upset'], 'Smileys'),
  e('😭', 'loudly crying face', ['sob', 'cry', 'bawling', 'wailing', 'sad'], 'Smileys'),
  e('😱', 'face screaming in fear', ['scream', 'scared', 'horror', 'terrified'], 'Smileys'),
  e('😰', 'anxious face with sweat', ['sweat', 'anxious', 'nervous', 'worried'], 'Smileys'),
  e('😡', 'pouting face', ['angry', 'mad', 'furious', 'rage'], 'Smileys'),
  e('🤬', 'face with symbols on mouth', ['swearing', 'curse', 'angry', 'rage'], 'Smileys'),
  e('💀', 'skull', ['skull', 'dead', 'death', 'dying laughing'], 'Smileys'),
  e('🤡', 'clown face', ['clown', 'joker', 'fool', 'silly'], 'Smileys'),
  e('😈', 'smiling face with horns', ['devil', 'evil', 'mischief', 'naughty'], 'Smileys'),
  e('👻', 'ghost', ['ghost', 'boo', 'spooky', 'halloween'], 'Smileys'),
  e('👽', 'alien', ['alien', 'ufo', 'extraterrestrial', 'space'], 'Smileys'),
  e('🤖', 'robot', ['robot', 'bot', 'machine', 'ai'], 'Smileys'),
  e('💩', 'pile of poo', ['poop', 'poo', 'crap', 'shit'], 'Smileys'),
  e('🙃', 'upside-down face', ['upside down', 'sarcasm', 'irony', 'silly'], 'Smileys'),
  e('🤑', 'money-mouth face', ['money', 'rich', 'dollar', 'cash'], 'Smileys'),
  e('🤗', 'hugging face', ['hug', 'embrace', 'warm', 'friendly'], 'Smileys'),
  e('🤥', 'lying face', ['liar', 'pinocchio', 'lie', 'dishonest'], 'Smileys'),
  e('🤢', 'nauseated face', ['sick', 'nausea', 'gross', 'green'], 'Smileys'),
  e('🤮', 'face vomiting', ['vomit', 'puke', 'sick', 'disgusting'], 'Smileys'),
  e('🥵', 'hot face', ['hot', 'heat', 'sweating', 'warm'], 'Smileys'),
  e('🥶', 'cold face', ['cold', 'freezing', 'frozen', 'winter'], 'Smileys'),
  e('😵', 'face with crossed-out eyes', ['dizzy', 'knocked out', 'stunned'], 'Smileys'),
  e('🤯', 'exploding head', ['mind blown', 'shocked', 'exploding', 'wow'], 'Smileys'),
  e('🤠', 'cowboy hat face', ['cowboy', 'yeehaw', 'western', 'hat'], 'Smileys'),
  e('🥳', 'partying face', ['party', 'celebrate', 'birthday', 'woohoo'], 'Smileys'),
  e('🥸', 'disguised face', ['disguise', 'incognito', 'hidden', 'spy'], 'Smileys'),
  e('🧐', 'face with monocle', ['monocle', 'inspect', 'detective', 'curious'], 'Smileys'),
  e('😞', 'disappointed face', ['sad', 'disappointed', 'down', 'unhappy'], 'Smileys'),
  e('😧', 'anguished face', ['anguished', 'anxious', 'fearful', 'worried'], 'Smileys'),
  e('😨', 'fearful face', ['fearful', 'scared', 'afraid', 'terrified'], 'Smileys'),

  // ─── People / Gestures ─────────────────────────────────────────────
  e('👍', 'thumbs up', ['thumbs up', 'like', 'approve', 'yes', 'good'], 'Gestures'),
  e('👎', 'thumbs down', ['thumbs down', 'dislike', 'no', 'bad', 'disapprove'], 'Gestures'),
  e('👌', 'OK hand', ['ok', 'perfect', 'fine', 'nice', 'alright'], 'Gestures'),
  e('✌️', 'victory hand', ['peace', 'victory', 'two', 'v sign'], 'Gestures'),
  e('🤞', 'crossed fingers', ['crossed fingers', 'luck', 'hope', 'wish'], 'Gestures'),
  e('🤟', 'love-you gesture', ['love you', 'ily', 'rock', 'sign language'], 'Gestures'),
  e('🤘', 'sign of the horns', ['rock', 'metal', 'horns', 'devil'], 'Gestures'),
  e('🤙', 'call me hand', ['call me', 'hang loose', 'shaka', 'phone'], 'Gestures'),
  e('👆', 'backhand index pointing up', ['point up', 'up', 'above'], 'Gestures'),
  e('👇', 'backhand index pointing down', ['point down', 'down', 'below'], 'Gestures'),
  e('👈', 'backhand index pointing left', ['point left', 'left', 'back'], 'Gestures'),
  e('👉', 'backhand index pointing right', ['point right', 'right', 'forward'], 'Gestures'),
  e('✊', 'raised fist', ['fist', 'punch', 'power', 'strong'], 'Gestures'),
  e('👋', 'waving hand', ['wave', 'hello', 'hi', 'bye', 'goodbye'], 'Gestures'),
  e('👏', 'clapping hands', ['clap', 'applause', 'bravo', 'congrats'], 'Gestures'),
  e('🙌', 'raising hands', ['raised hands', 'hooray', 'celebrate', 'yay'], 'Gestures'),
  e('👐', 'open hands', ['open hands', 'jazz hands', 'hug'], 'Gestures'),
  e('🤲', 'palms up together', ['palms up', 'prayer', 'receive', 'give'], 'Gestures'),
  e('🙏', 'folded hands', ['pray', 'please', 'thank you', 'hope', 'namaste'], 'Gestures'),
  e('🤝', 'handshake', ['handshake', 'deal', 'agreement', 'partnership'], 'Gestures'),
  e('💅', 'nail polish', ['nail polish', 'beauty', 'sassy', 'fabulous'], 'Gestures'),
  e('💪', 'flexed biceps', ['muscle', 'strong', 'flex', 'power', 'gym'], 'Gestures'),

  // ─── Love / Hearts ─────────────────────────────────────────────────
  e('❤️', 'red heart', ['heart', 'love', 'red heart', 'like', 'romance'], 'Love'),
  e('🧡', 'orange heart', ['orange heart', 'love', 'warm'], 'Love'),
  e('💛', 'yellow heart', ['yellow heart', 'love', 'friendship', 'happy'], 'Love'),
  e('💚', 'green heart', ['green heart', 'love', 'nature', 'health'], 'Love'),
  e('💙', 'blue heart', ['blue heart', 'love', 'trust', 'loyalty'], 'Love'),
  e('💜', 'purple heart', ['purple heart', 'love', 'luxury', 'royal'], 'Love'),
  e('🖤', 'black heart', ['black heart', 'dark', 'emo', 'goth'], 'Love'),
  e('🤍', 'white heart', ['white heart', 'pure', 'clean', 'peace'], 'Love'),
  e('💔', 'broken heart', ['broken heart', 'heartbreak', 'sad', 'pain'], 'Love'),
  e('❣️', 'heart exclamation', ['heart exclamation', 'love', 'passion'], 'Love'),
  e('💕', 'two hearts', ['two hearts', 'love', 'couple', 'pair'], 'Love'),
  e('💞', 'revolving hearts', ['revolving hearts', 'love', 'romance', 'spin'], 'Love'),
  e('💓', 'beating heart', ['heartbeat', 'love', 'pulse', 'alive'], 'Love'),
  e('💖', 'sparkling heart', ['sparkling heart', 'love', 'sparkle', 'glitter'], 'Love'),
  e('💗', 'growing heart', ['growing heart', 'love', 'expanding'], 'Love'),
  e('💘', 'heart with arrow', ['heart arrow', 'cupid', 'love', 'valentine'], 'Love'),
  e('💝', 'heart with ribbon', ['heart ribbon', 'gift', 'love', 'present'], 'Love'),
  e('💋', 'kiss mark', ['kiss', 'lips', 'smooch', 'love'], 'Love'),
  e('💌', 'love letter', ['love letter', 'envelope', 'heart', 'mail'], 'Love'),
  e('💯', 'hundred points', ['hundred', '100', 'perfect', 'score'], 'Love'),

  // ─── Reactions ──────────────────────────────────────────────────────
  e('🔥', 'fire', ['fire', 'hot', 'lit', 'flame', 'trending'], 'Reactions'),
  e('⭐', 'star', ['star', 'favorite', 'bookmark', 'gold'], 'Reactions'),
  e('✨', 'sparkles', ['sparkle', 'magic', 'shine', 'glitter', 'stars'], 'Reactions'),
  e('⚡', 'high voltage', ['zap', 'lightning', 'electric', 'fast', 'thunder'], 'Reactions'),
  e('💥', 'collision', ['boom', 'explosion', 'crash', 'bang'], 'Reactions'),
  e('🎉', 'party popper', ['tada', 'party', 'celebrate', 'congrats', 'hooray'], 'Reactions'),
  e('🏆', 'trophy', ['trophy', 'winner', 'champion', 'award', 'first'], 'Reactions'),
  e('🏅', 'sports medal', ['medal', 'award', 'winner', 'achievement'], 'Reactions'),
  e('👑', 'crown', ['crown', 'king', 'queen', 'royal', 'best'], 'Reactions'),
  e('💎', 'gem stone', ['gem', 'diamond', 'jewel', 'precious', 'bling'], 'Reactions'),
  e('💰', 'money bag', ['money', 'dollar', 'rich', 'cash', 'bag'], 'Reactions'),
  e('💡', 'light bulb', ['bulb', 'idea', 'light', 'think', 'bright'], 'Reactions'),
  e('✅', 'check mark button', ['check', 'done', 'complete', 'yes', 'approve'], 'Reactions'),
  e('❌', 'cross mark', ['cross', 'no', 'wrong', 'delete', 'cancel'], 'Reactions'),
  e('⚠️', 'warning', ['warning', 'caution', 'alert', 'danger'], 'Reactions'),
  e('❓', 'question mark', ['question', 'what', 'ask', 'help'], 'Reactions'),
  e('❗', 'exclamation mark', ['exclamation', 'important', 'alert', 'attention'], 'Reactions'),
  e('📌', 'pushpin', ['pin', 'pushpin', 'location', 'mark', 'save'], 'Reactions'),
  e('🔔', 'bell', ['bell', 'notification', 'alert', 'ring', 'alarm'], 'Reactions'),
  e('👀', 'eyes', ['eyes', 'look', 'see', 'watch', 'stare'], 'Reactions'),
  e('🧠', 'brain', ['brain', 'smart', 'think', 'mind', 'intelligence'], 'Reactions'),
  e('🚀', 'rocket', ['rocket', 'launch', 'fast', 'space', 'startup'], 'Reactions'),
  e('🌈', 'rainbow', ['rainbow', 'colorful', 'pride', 'colors'], 'Reactions'),
  e('☀️', 'sun', ['sun', 'sunny', 'bright', 'warm', 'weather'], 'Reactions'),
  e('🌙', 'crescent moon', ['moon', 'night', 'sleep', 'crescent'], 'Reactions'),
  e('☁️', 'cloud', ['cloud', 'weather', 'overcast', 'sky'], 'Reactions'),
  e('☂️', 'umbrella', ['umbrella', 'rain', 'weather', 'protection'], 'Reactions'),
  e('❄️', 'snowflake', ['snowflake', 'cold', 'winter', 'snow', 'frozen'], 'Reactions'),

  // ─── Animals ────────────────────────────────────────────────────────
  e('🐶', 'dog face', ['dog', 'puppy', 'pet', 'woof', 'cute'], 'Animals'),
  e('🐱', 'cat face', ['cat', 'kitten', 'pet', 'meow', 'cute'], 'Animals'),
  e('🐭', 'mouse face', ['mouse', 'rat', 'rodent', 'squeak'], 'Animals'),
  e('🐹', 'hamster', ['hamster', 'pet', 'rodent', 'cute'], 'Animals'),
  e('🐰', 'rabbit face', ['rabbit', 'bunny', 'pet', 'easter'], 'Animals'),
  e('🦊', 'fox', ['fox', 'clever', 'cunning', 'animal'], 'Animals'),
  e('🐻', 'bear', ['bear', 'animal', 'grizzly', 'teddy'], 'Animals'),
  e('🐼', 'panda', ['panda', 'bear', 'cute', 'black white'], 'Animals'),
  e('🐨', 'koala', ['koala', 'australia', 'cute', 'animal'], 'Animals'),
  e('🐯', 'tiger face', ['tiger', 'cat', 'wild', 'fierce'], 'Animals'),
  e('🦁', 'lion', ['lion', 'king', 'mane', 'wild', 'cat'], 'Animals'),
  e('🐮', 'cow face', ['cow', 'moo', 'farm', 'animal'], 'Animals'),
  e('🐷', 'pig face', ['pig', 'oink', 'farm', 'pork'], 'Animals'),
  e('🐸', 'frog', ['frog', 'toad', 'ribbit', 'green', 'pepe'], 'Animals'),
  e('🐵', 'monkey face', ['monkey', 'ape', 'primate', 'banana'], 'Animals'),
  e('🐔', 'chicken', ['chicken', 'hen', 'rooster', 'farm', 'poultry'], 'Animals'),
  e('🐧', 'penguin', ['penguin', 'arctic', 'bird', 'cold', 'cute'], 'Animals'),
  e('🐦', 'bird', ['bird', 'tweet', 'fly', 'chirp'], 'Animals'),
  e('🦅', 'eagle', ['eagle', 'bird', 'freedom', 'america'], 'Animals'),
  e('🦉', 'owl', ['owl', 'wise', 'night', 'hoot', 'bird'], 'Animals'),
  e('🦇', 'bat', ['bat', 'vampire', 'night', 'halloween'], 'Animals'),
  e('🐺', 'wolf', ['wolf', 'howl', 'wild', 'pack'], 'Animals'),
  e('🐴', 'horse face', ['horse', 'pony', 'ride', 'stallion'], 'Animals'),
  e('🦄', 'unicorn', ['unicorn', 'magic', 'fantasy', 'rainbow', 'mythical'], 'Animals'),
  e('🐝', 'honeybee', ['bee', 'honey', 'buzz', 'insect'], 'Animals'),
  e('🐛', 'bug', ['bug', 'insect', 'worm', 'caterpillar'], 'Animals'),
  e('🦋', 'butterfly', ['butterfly', 'insect', 'beauty', 'nature'], 'Animals'),
  e('🐌', 'snail', ['snail', 'slow', 'shell', 'slug'], 'Animals'),
  e('🐙', 'octopus', ['octopus', 'tentacle', 'sea', 'squid'], 'Animals'),
  e('🐟', 'fish', ['fish', 'ocean', 'sea', 'swim'], 'Animals'),
  e('🐬', 'dolphin', ['dolphin', 'ocean', 'sea', 'smart', 'swim'], 'Animals'),
  e('🐳', 'spouting whale', ['whale', 'ocean', 'sea', 'big', 'splash'], 'Animals'),
  e('🐢', 'turtle', ['turtle', 'slow', 'shell', 'tortoise'], 'Animals'),
  e('🐍', 'snake', ['snake', 'reptile', 'hiss', 'slither'], 'Animals'),
  e('🐉', 'dragon', ['dragon', 'fire', 'fantasy', 'mythical'], 'Animals'),

  // ─── Food ───────────────────────────────────────────────────────────
  e('🍕', 'pizza', ['pizza', 'food', 'slice', 'italian', 'cheese'], 'Food'),
  e('🍔', 'hamburger', ['burger', 'hamburger', 'food', 'fast food', 'meat'], 'Food'),
  e('🍟', 'french fries', ['fries', 'chips', 'potato', 'fast food'], 'Food'),
  e('🌭', 'hot dog', ['hotdog', 'sausage', 'food', 'bbq'], 'Food'),
  e('🌮', 'taco', ['taco', 'mexican', 'food', 'shell'], 'Food'),
  e('🌯', 'burrito', ['burrito', 'wrap', 'mexican', 'food'], 'Food'),
  e('🍣', 'sushi', ['sushi', 'japanese', 'fish', 'rice', 'food'], 'Food'),
  e('🍜', 'steaming bowl', ['ramen', 'noodles', 'soup', 'japanese', 'food'], 'Food'),
  e('🍝', 'spaghetti', ['spaghetti', 'pasta', 'noodles', 'italian', 'food'], 'Food'),
  e('🍞', 'bread', ['bread', 'toast', 'loaf', 'bakery'], 'Food'),
  e('🥐', 'croissant', ['croissant', 'french', 'pastry', 'bread'], 'Food'),
  e('🥞', 'pancakes', ['pancakes', 'breakfast', 'syrup', 'stack'], 'Food'),
  e('🧇', 'waffle', ['waffle', 'breakfast', 'food'], 'Food'),
  e('🧀', 'cheese wedge', ['cheese', 'dairy', 'cheddar', 'food'], 'Food'),
  e('🥚', 'egg', ['egg', 'breakfast', 'chicken', 'food'], 'Food'),
  e('🥓', 'bacon', ['bacon', 'meat', 'breakfast', 'pork'], 'Food'),
  e('🥩', 'cut of meat', ['steak', 'meat', 'beef', 'bbq'], 'Food'),
  e('🍗', 'poultry leg', ['chicken leg', 'drumstick', 'meat', 'food'], 'Food'),
  e('🍎', 'red apple', ['apple', 'fruit', 'red', 'healthy'], 'Food'),
  e('🍌', 'banana', ['banana', 'fruit', 'yellow', 'monkey'], 'Food'),
  e('🍇', 'grapes', ['grapes', 'fruit', 'wine', 'purple'], 'Food'),
  e('🍓', 'strawberry', ['strawberry', 'fruit', 'berry', 'red'], 'Food'),
  e('🍉', 'watermelon', ['watermelon', 'fruit', 'summer', 'melon'], 'Food'),
  e('🍑', 'peach', ['peach', 'fruit', 'butt', 'soft'], 'Food'),
  e('🍒', 'cherries', ['cherry', 'cherries', 'fruit', 'red'], 'Food'),
  e('🥭', 'mango', ['mango', 'fruit', 'tropical', 'sweet'], 'Food'),
  e('🥑', 'avocado', ['avocado', 'food', 'green', 'guacamole'], 'Food'),
  e('🌽', 'ear of corn', ['corn', 'vegetable', 'cob', 'maize'], 'Food'),
  e('🥕', 'carrot', ['carrot', 'vegetable', 'orange', 'rabbit'], 'Food'),
  e('🍩', 'doughnut', ['donut', 'doughnut', 'pastry', 'sweet'], 'Food'),
  e('🎂', 'birthday cake', ['cake', 'birthday', 'celebration', 'dessert'], 'Food'),
  e('🍪', 'cookie', ['cookie', 'biscuit', 'sweet', 'snack'], 'Food'),
  e('🍫', 'chocolate bar', ['chocolate', 'candy', 'sweet', 'cocoa'], 'Food'),
  e('🍬', 'candy', ['candy', 'sweet', 'sugar', 'treat'], 'Food'),
  e('🍦', 'soft ice cream', ['ice cream', 'dessert', 'vanilla', 'cold', 'sweet'], 'Food'),
  e('☕', 'hot beverage', ['coffee', 'tea', 'hot', 'drink', 'cafe', 'morning'], 'Food'),
  e('🍵', 'teacup without handle', ['tea', 'green tea', 'drink', 'hot', 'matcha'], 'Food'),
  e('🍺', 'beer mug', ['beer', 'drink', 'alcohol', 'cheers', 'bar'], 'Food'),
  e('🍷', 'wine glass', ['wine', 'drink', 'alcohol', 'red wine', 'classy'], 'Food'),
  e('🍸', 'cocktail glass', ['cocktail', 'drink', 'martini', 'alcohol', 'bar'], 'Food'),
  e('🍾', 'bottle with popping cork', ['champagne', 'celebrate', 'pop', 'drink', 'cheers'], 'Food'),
  e('🍿', 'popcorn', ['popcorn', 'movie', 'snack', 'cinema'], 'Food'),

  // ─── Travel ─────────────────────────────────────────────────────────
  e('✈️', 'airplane', ['airplane', 'flight', 'travel', 'fly', 'trip'], 'Objects'),
  e('🚗', 'automobile', ['car', 'drive', 'vehicle', 'road', 'auto'], 'Objects'),
  e('🚕', 'taxi', ['taxi', 'cab', 'uber', 'ride', 'yellow'], 'Objects'),
  e('🚌', 'bus', ['bus', 'transit', 'public', 'transport'], 'Objects'),
  e('🚀', 'rocket', ['rocket', 'space', 'launch', 'nasa', 'fly'], 'Objects'),
  e('🏠', 'house', ['house', 'home', 'building', 'residence'], 'Objects'),
  e('🏢', 'office building', ['office', 'building', 'work', 'corporate'], 'Objects'),
  e('🏖️', 'beach with umbrella', ['beach', 'vacation', 'summer', 'sand', 'sea'], 'Objects'),
  e('🗺️', 'world map', ['map', 'world', 'travel', 'globe', 'geography'], 'Objects'),
  e('🌍', 'globe showing Europe-Africa', ['globe', 'earth', 'world', 'planet'], 'Objects'),

  // ─── Objects ────────────────────────────────────────────────────────
  e('📱', 'mobile phone', ['phone', 'mobile', 'cell', 'smartphone', 'iphone'], 'Objects'),
  e('💻', 'laptop', ['laptop', 'computer', 'pc', 'mac', 'work'], 'Objects'),
  e('⌨️', 'keyboard', ['keyboard', 'type', 'computer', 'input'], 'Objects'),
  e('📷', 'camera', ['camera', 'photo', 'picture', 'snap', 'photography'], 'Objects'),
  e('📺', 'television', ['tv', 'television', 'screen', 'watch', 'show'], 'Objects'),
  e('📻', 'radio', ['radio', 'music', 'broadcast', 'fm'], 'Objects'),
  e('🕐', 'one oclock', ['clock', 'time', 'hour', 'watch'], 'Objects'),
  e('⏳', 'hourglass not done', ['hourglass', 'time', 'wait', 'sand', 'timer'], 'Objects'),
  e('🔋', 'battery', ['battery', 'power', 'charge', 'energy'], 'Objects'),
  e('🔌', 'electric plug', ['plug', 'electric', 'power', 'charge', 'outlet'], 'Objects'),
  e('🧲', 'magnet', ['magnet', 'attract', 'magnetic', 'pull'], 'Objects'),
  e('✂️', 'scissors', ['scissors', 'cut', 'snip', 'trim'], 'Objects'),
  e('🖊️', 'pen', ['pen', 'write', 'ink', 'sign'], 'Objects'),
  e('✏️', 'pencil', ['pencil', 'write', 'draw', 'edit'], 'Objects'),
  e('📖', 'open book', ['book', 'read', 'study', 'pages', 'literature'], 'Objects'),
  e('📰', 'newspaper', ['newspaper', 'news', 'press', 'media', 'paper'], 'Objects'),
  e('✉️', 'envelope', ['envelope', 'mail', 'email', 'letter', 'message'], 'Objects'),
  e('📦', 'package', ['package', 'box', 'delivery', 'ship', 'parcel'], 'Objects'),
  e('🏷️', 'label', ['label', 'tag', 'price', 'sale'], 'Objects'),
  e('🔒', 'locked', ['lock', 'secure', 'private', 'closed', 'password'], 'Objects'),
  e('🔑', 'key', ['key', 'unlock', 'password', 'access', 'security'], 'Objects'),
  e('🔨', 'hammer', ['hammer', 'tool', 'build', 'construct', 'fix'], 'Objects'),
  e('🔧', 'wrench', ['wrench', 'tool', 'fix', 'repair', 'settings'], 'Objects'),
  e('⚙️', 'gear', ['gear', 'settings', 'config', 'mechanical', 'cog'], 'Objects'),
];

// ── O(1) Lookup by emoji character ────────────────────────────────────────────

export const EMOJI_LOOKUP: Map<string, Emoji> = new Map(
  EMOJIS.map(em => [em.emoji, em]),
);

// ── Backward-compatibility map: shortcode → emoji character ───────────────────
// Allows colon-search UIs to show `:name:` labels

const _shortcodeMap: Map<string, string> | null = null;

/** Get a map of all shortcode names → emoji characters (lazy, built once). */
export function getShortcodeMap(): Map<string, string> {
  if (_shortcodeMap) return _shortcodeMap;
  const map = new Map<string, string>();
  for (const em of EMOJIS) {
    // Use a URL-safe shortcode derived from the name
    const shortcode = em.name.replace(/\s+/g, '_').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
    map.set(shortcode, em.emoji);
    // Also index the first keyword for quick `:keyword` matching
    for (const kw of em.keywordsLower) {
      if (!map.has(kw)) map.set(kw, em.emoji);
    }
  }
  return map;
}

// ── Search Engine ─────────────────────────────────────────────────────────────

/**
 * Search emojis by query. Case-insensitive, ranked:
 *   name startsWith → score 3
 *   name includes   → score 2
 *   keyword match   → score 1
 * Returns top 20 results. O(n) scan, no object copies.
 */
export function searchEmojis(query: string): Emoji[] {
  if (!query) return [];
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const scored: { emoji: Emoji; score: number }[] = [];

  for (let i = 0; i < EMOJIS.length; i++) {
    const em = EMOJIS[i];
    let score = 0;

    if (em.nameLower.startsWith(q)) {
      score = 3;
    } else if (em.nameLower.includes(q)) {
      score = 2;
    } else {
      for (let k = 0; k < em.keywordsLower.length; k++) {
        if (em.keywordsLower[k].startsWith(q)) {
          score = 1;
          break;
        }
      }
      // Also check keyword includes if no startsWith match
      if (score === 0) {
        for (let k = 0; k < em.keywordsLower.length; k++) {
          if (em.keywordsLower[k].includes(q)) {
            score = 0.5;
            break;
          }
        }
      }
    }

    if (score > 0) {
      scored.push({ emoji: em, score });
    }
  }

  // Sort descending by score; preserve dataset order for equal scores
  scored.sort((a, b) => b.score - a.score);

  // Return top 20, reference original Emoji objects (no copies)
  const result: Emoji[] = [];
  const limit = Math.min(scored.length, 20);
  for (let i = 0; i < limit; i++) {
    result.push(scored[i].emoji);
  }
  return result;
}

// ── Category Grouping (memoized) ──────────────────────────────────────────────

let _categoryCache: Record<string, Emoji[]> | null = null;

/**
 * Group all emojis by category. Computed once, cached at module level.
 * Keys are ordered per CATEGORY_ORDER.
 */
export function getEmojisByCategory(): Record<string, Emoji[]> {
  if (_categoryCache) return _categoryCache;

  const groups: Record<string, Emoji[]> = {};
  for (const cat of CATEGORY_ORDER) {
    groups[cat] = [];
  }
  for (const em of EMOJIS) {
    if (!groups[em.category]) {
      groups[em.category] = [];
    }
    groups[em.category].push(em);
  }
  _categoryCache = groups;
  return _categoryCache;
}

// ── Recent Emojis (localStorage-backed MRU) ───────────────────────────────────

const RECENT_KEY = 'recent_emojis';
const MAX_RECENT = 16;

/** Retrieve recently used emoji characters. SSR-safe. */
export function getRecentEmojis(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/** Save an emoji to the MRU list. Returns the updated list. SSR-safe. */
export function saveRecentEmoji(emoji: string): string[] {
  if (typeof window === 'undefined') return [];
  const recent = getRecentEmojis().filter(e => e !== emoji);
  recent.unshift(emoji);
  const trimmed = recent.slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore quota errors */
  }
  return trimmed;
}
