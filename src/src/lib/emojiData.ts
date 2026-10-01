/**
 * Curated emoji set for the Lists icon/callout picker — no dependency.
 * One emoji per line: `<emoji> <search words>`; a trailing `~` marks emoji
 * that take a skin tone modifier.
 */

export type EmojiEntry = { e: string; n: string; tone: boolean };
export type EmojiCategory = { id: string; label: string; emojis: EmojiEntry[] };

const RAW: { id: string; label: string; data: string }[] = [
    {
        id: 'people',
        label: 'People',
        data: `
😀 grinning face smile happy
😃 grinning big eyes smile happy
😄 grinning smiling eyes happy
😁 beaming grin teeth
😆 laughing squinting happy
😅 sweat smile relief
🤣 rolling floor laughing lol
😂 tears of joy laughing lol
🙂 slightly smiling
🙃 upside down silly
🫠 melting face
😉 wink
😊 smiling blush happy
😇 halo angel innocent
🥰 hearts love adore
😍 heart eyes love
🤩 star struck wow
😘 kiss blowing
😗 kissing
☺️ smiling relaxed
😚 kissing closed eyes
😙 kissing smiling eyes
🥲 smiling tear
😋 yum delicious
😛 tongue
😜 winking tongue silly
🤪 zany crazy
😝 squinting tongue
🤑 money mouth rich
🤗 hug hugging
🤭 hand over mouth oops
🫢 open eyes hand over mouth
🫣 peeking eye
🤫 shushing quiet secret
🤔 thinking hmm
🫡 salute
🤐 zipper mouth
🤨 raised eyebrow skeptical
😐 neutral
😑 expressionless
😶 no mouth
🫥 dotted line face
😏 smirk
😒 unamused
🙄 rolling eyes
😬 grimacing awkward
😮‍💨 exhaling sigh
🤥 lying
😌 relieved
😔 pensive sad
😪 sleepy
🤤 drooling
😴 sleeping zzz tired
😷 mask sick
🤒 thermometer sick fever
🤕 bandage hurt
🤢 nauseated sick
🤮 vomiting
🤧 sneezing
🥵 hot sweating
🥶 cold freezing
🥴 woozy dizzy
😵 dizzy
😵‍💫 spiral eyes dizzy
🤯 exploding head mind blown
🤠 cowboy
🥳 party celebrate
🥸 disguise
😎 sunglasses cool
🤓 nerd glasses
🧐 monocle curious
😕 confused
🫤 diagonal mouth meh
😟 worried
🙁 slightly frowning
😮 open mouth surprised
😯 hushed
😲 astonished shocked
😳 flushed embarrassed
🥺 pleading puppy eyes
🥹 holding back tears
😦 frowning open mouth
😧 anguished
😨 fearful scared
😰 anxious sweat
😥 sad relieved
😢 crying sad tear
😭 sobbing crying
😱 screaming fear
😖 confounded
😣 persevering
😞 disappointed
😓 downcast sweat
😩 weary tired
😫 tired exhausted
🥱 yawning bored
😤 triumph huff
😡 pouting angry mad
😠 angry
🤬 cursing swearing
😈 smiling devil
👿 angry devil imp
💀 skull dead
☠️ skull crossbones danger
💩 poop
🤡 clown
👹 ogre
👺 goblin
👻 ghost boo
👽 alien
👾 space invader game
🤖 robot bot
😺 grinning cat
😸 cat grin
😹 cat joy
😻 cat heart eyes
🙈 see no evil monkey
🙉 hear no evil monkey
🙊 speak no evil monkey
👋 waving hand hello bye ~
🤚 raised back hand ~
🖐️ hand fingers splayed ~
✋ raised hand high five stop ~
🖖 vulcan salute ~
👌 ok hand perfect ~
🤌 pinched fingers ~
🤏 pinching small ~
✌️ victory peace ~
🤞 crossed fingers luck ~
🫰 hand index thumb crossed ~
🤟 love you gesture ~
🤘 rock on horns ~
🤙 call me hand ~
👈 point left ~
👉 point right ~
👆 point up ~
👇 point down ~
☝️ index pointing up ~
🫵 pointing at viewer you ~
👍 thumbs up like yes good ~
👎 thumbs down dislike no ~
✊ raised fist ~
👊 fist bump punch ~
👏 clapping applause ~
🙌 raising hands celebrate ~
🫶 heart hands love ~
👐 open hands ~
🤲 palms up together ~
🤝 handshake deal agreement
🙏 folded hands please thanks pray ~
✍️ writing hand ~
💅 nail polish ~
🤳 selfie ~
💪 flexed biceps strong muscle gym ~
🧠 brain smart think
🫀 anatomical heart
🫁 lungs breathe
👀 eyes look see
👁️ eye
👅 tongue
👄 mouth lips
🫦 biting lip
👶 baby ~
🧒 child kid ~
👦 boy ~
👧 girl ~
🧑 person adult ~
👨 man ~
👩 woman ~
🧓 older person ~
👴 old man ~
👵 old woman ~
🧑‍💻 technologist developer coder laptop
🧑‍🎓 student graduate
🧑‍🏫 teacher
🧑‍🍳 cook chef
🧑‍🎨 artist painter
🧑‍🚀 astronaut space
🧑‍🔬 scientist
🧑‍⚕️ health worker doctor
🥷 ninja
🦸 superhero ~
🧙 mage wizard ~
🧘 person in lotus meditation yoga calm ~
🏃 running runner ~
🚶 walking ~
💃 dancing woman ~
🕺 dancing man ~
🧗 climbing ~
🏋️ weight lifting gym ~
🚴 biking cyclist ~
👥 people silhouettes team
🫂 people hugging
`,
    },
    {
        id: 'nature',
        label: 'Animals & nature',
        data: `
🐶 dog puppy
🐱 cat kitten
🐭 mouse
🐹 hamster
🐰 rabbit bunny
🦊 fox
🐻 bear
🐼 panda
🐻‍❄️ polar bear
🐨 koala
🐯 tiger
🦁 lion
🐮 cow
🐷 pig
🐸 frog
🐵 monkey
🐔 chicken
🐧 penguin
🐦 bird
🐤 baby chick
🦆 duck
🦅 eagle
🦉 owl night
🦇 bat
🐺 wolf
🐗 boar
🐴 horse
🦄 unicorn magic
🐝 bee honey busy
🪱 worm
🐛 bug caterpillar
🦋 butterfly
🐌 snail slow
🐞 lady beetle ladybug
🐜 ant
🪲 beetle
🕷️ spider
🐢 turtle slow
🐍 snake
🦎 lizard
🦖 t-rex dinosaur
🦕 sauropod dinosaur
🐙 octopus
🦑 squid
🦀 crab
🐠 tropical fish
🐟 fish
🐬 dolphin
🐳 whale spouting
🦈 shark
🐊 crocodile
🐅 tiger
🦓 zebra
🦍 gorilla
🐘 elephant
🦒 giraffe
🦘 kangaroo
🐪 camel
🐑 sheep
🦙 llama
🐐 goat
🦌 deer
🐕 dog
🐈 cat
🐓 rooster
🦚 peacock
🦜 parrot
🦢 swan
🦩 flamingo
🕊️ dove peace
🐇 rabbit
🦝 raccoon
🦦 otter
🦥 sloth slow lazy
🐿️ chipmunk squirrel
🦔 hedgehog
🐾 paw prints
🌵 cactus desert
🎄 christmas tree
🌲 evergreen tree
🌳 deciduous tree
🌴 palm tree beach
🪵 wood log
🌱 seedling sprout grow
🌿 herb leaf
☘️ shamrock
🍀 four leaf clover luck
🎍 pine decoration
🪴 potted plant
🎋 tanabata tree
🍃 leaf fluttering wind
🍂 fallen leaf autumn
🍁 maple leaf fall
🍄 mushroom
🐚 shell
🪨 rock stone
🌾 rice sheaf
💐 bouquet flowers
🌷 tulip
🌹 rose
🥀 wilted flower
🌺 hibiscus
🌸 cherry blossom spring
🌼 blossom
🌻 sunflower
🌞 sun face
🌝 full moon face
🌛 first quarter moon face
🌙 crescent moon night
🌎 globe americas earth world
🌍 globe europe africa earth
🌏 globe asia earth
🪐 ringed planet saturn space
💫 dizzy star
⭐ star favorite
🌟 glowing star
✨ sparkles magic shine new
⚡ lightning bolt zap energy fast
☄️ comet
💥 collision boom
🔥 fire hot lit streak
🌪️ tornado
🌈 rainbow
☀️ sun sunny weather
🌤️ sun small cloud
⛅ sun behind cloud
☁️ cloud
🌧️ rain cloud
⛈️ storm thunder
🌩️ lightning cloud
❄️ snowflake cold winter
☃️ snowman
⛄ snowman without snow
🌬️ wind face
💨 dashing away fast
💧 droplet water
💦 sweat droplets
🌊 wave ocean sea
🌫️ fog
`,
    },
    {
        id: 'food',
        label: 'Food & drink',
        data: `
🍏 green apple
🍎 red apple
🍐 pear
🍊 orange tangerine
🍋 lemon
🍌 banana
🍉 watermelon
🍇 grapes
🍓 strawberry
🫐 blueberries
🍈 melon
🍒 cherries
🍑 peach
🥭 mango
🍍 pineapple
🥥 coconut
🥝 kiwi
🍅 tomato
🍆 eggplant
🥑 avocado
🥦 broccoli
🥬 leafy green lettuce
🥒 cucumber
🌶️ hot pepper spicy
🫑 bell pepper
🌽 corn
🥕 carrot
🧄 garlic
🧅 onion
🥔 potato
🍠 sweet potato
🥐 croissant
🥯 bagel
🍞 bread
🥖 baguette
🥨 pretzel
🧀 cheese
🥚 egg
🍳 cooking fried egg breakfast
🧈 butter
🥞 pancakes
🧇 waffle
🥓 bacon
🥩 steak meat
🍗 poultry leg chicken
🍖 meat bone
🌭 hot dog
🍔 hamburger burger
🍟 french fries
🍕 pizza
🥪 sandwich
🌮 taco
🌯 burrito
🥗 salad healthy
🥘 paella pan
🍝 spaghetti pasta
🍜 ramen noodles
🍲 stew pot
🍛 curry rice
🍣 sushi
🍱 bento box
🥟 dumpling
🍤 fried shrimp
🍙 rice ball
🍚 cooked rice
🍘 rice cracker
🍥 fish cake
🥠 fortune cookie
🍢 oden
🍡 dango
🍧 shaved ice
🍨 ice cream
🍦 soft ice cream
🥧 pie
🧁 cupcake
🍰 shortcake cake
🎂 birthday cake
🍮 custard pudding
🍭 lollipop candy
🍬 candy
🍫 chocolate
🍿 popcorn movie
🍩 doughnut donut
🍪 cookie
🌰 chestnut
🥜 peanuts
🍯 honey pot
🥛 milk glass
☕ coffee hot beverage tea
🫖 teapot
🍵 tea cup green
🧃 juice box
🥤 cup straw soda
🧋 bubble tea boba
🍶 sake
🍺 beer
🍻 cheers beers
🥂 clinking glasses toast celebrate
🍷 wine
🥃 tumbler whisky
🍸 cocktail
🍹 tropical drink
🧉 mate
🧊 ice cube
🥄 spoon
🍴 fork knife
🍽️ plate cutlery dinner
🥣 bowl spoon cereal
🥡 takeout box
🥢 chopsticks
🧂 salt
`,
    },
    {
        id: 'activity',
        label: 'Activities',
        data: `
⚽ soccer football
🏀 basketball
🏈 american football
⚾ baseball
🥎 softball
🎾 tennis
🏐 volleyball
🏉 rugby
🥏 frisbee
🎱 pool 8 ball
🪀 yo-yo
🏓 ping pong table tennis
🏸 badminton
🏒 ice hockey
🏑 field hockey
🥍 lacrosse
🏏 cricket
🪃 boomerang
🥅 goal net
⛳ golf flag
🪁 kite
🏹 bow arrow
🎣 fishing
🤿 diving mask
🥊 boxing glove
🥋 martial arts
🎽 running shirt
🛹 skateboard
🛼 roller skate
🛷 sled
⛸️ ice skate
🥌 curling stone
🎿 skis
⛷️ skier
🏂 snowboarder
🏋️‍♀️ woman lifting weights
🤸 cartwheel gymnastics
⛹️ bouncing ball
🤺 fencing
🤾 handball
🏌️ golfing
🏇 horse racing
🧘‍♀️ woman yoga meditation
🏄 surfing
🏊 swimming
🤽 water polo
🚣 rowing boat
🚵 mountain biking
🏆 trophy winner award
🥇 first place gold medal
🥈 second place silver
🥉 third place bronze
🏅 sports medal
🎖️ military medal
🏵️ rosette
🎗️ reminder ribbon
🎫 ticket
🎟️ admission tickets
🎪 circus tent
🎭 performing arts theater
🩰 ballet shoes
🎨 artist palette art paint
🎬 clapper board film movie
🎤 microphone sing karaoke
🎧 headphone music listen
🎼 musical score
🎹 musical keyboard piano
🥁 drum
🪘 long drum
🎷 saxophone
🎺 trumpet
🪗 accordion
🎸 guitar
🪕 banjo
🎻 violin
🎲 game die dice
♟️ chess pawn strategy
🎯 bullseye target goal focus
🎳 bowling
🎮 video game controller
🕹️ joystick
🧩 puzzle piece
🎰 slot machine
🧸 teddy bear
🪅 pinata
🪩 mirror ball disco
🎉 party popper celebrate tada
🎊 confetti ball
🎈 balloon birthday
🎁 wrapped gift present
🎀 ribbon bow
🪄 magic wand
`,
    },
    {
        id: 'travel',
        label: 'Travel & places',
        data: `
🚗 car automobile
🚕 taxi
🚙 suv
🚌 bus
🚎 trolleybus
🏎️ racing car fast
🚓 police car
🚑 ambulance
🚒 fire engine
🚐 minibus van
🛻 pickup truck
🚚 delivery truck
🚛 articulated lorry
🚜 tractor
🛵 scooter motor
🏍️ motorcycle
🚲 bicycle bike
🛴 kick scooter
🚨 police light siren
🚔 oncoming police car
🚍 oncoming bus
🚘 oncoming car
🚖 oncoming taxi
✈️ airplane flight travel
🛫 departure takeoff
🛬 arrival landing
🛩️ small airplane
💺 seat
🚀 rocket launch ship
🛸 flying saucer ufo
🚁 helicopter
🛶 canoe
⛵ sailboat
🚤 speedboat
🛥️ motor boat
🛳️ passenger ship cruise
⛴️ ferry
🚢 ship
⚓ anchor
🚧 construction
⛽ fuel pump gas
🚏 bus stop
🚦 traffic light
🗺️ world map
🗿 moai
🗽 statue of liberty
🗼 tokyo tower
🏰 castle
🏯 japanese castle
🏟️ stadium
🎡 ferris wheel
🎢 roller coaster
🎠 carousel
⛲ fountain
⛱️ umbrella beach
🏖️ beach umbrella vacation
🏝️ desert island
🏜️ desert
🌋 volcano
⛰️ mountain
🏔️ snow capped mountain
🗻 mount fuji
🏕️ camping tent
⛺ tent
🛖 hut
🏠 house home
🏡 house garden home
🏘️ houses
🏗️ building construction
🏭 factory
🏢 office building work
🏬 department store
🏣 post office
🏥 hospital
🏦 bank
🏨 hotel
🏪 convenience store
🏫 school
🏛️ classical building
⛪ church
🕌 mosque
🕍 synagogue
🛕 hindu temple
🌁 foggy bridge
🌃 night stars city
🏙️ cityscape
🌄 sunrise mountains
🌅 sunrise
🌆 city dusk
🌇 sunset
🌉 bridge night
🎑 moon viewing
🌠 shooting star
🎆 fireworks
🎇 sparkler
🧭 compass direction
`,
    },
    {
        id: 'objects',
        label: 'Objects',
        data: `
⌚ watch time
📱 mobile phone
📲 phone arrow
💻 laptop computer work
⌨️ keyboard typing
🖥️ desktop computer
🖨️ printer
🖱️ computer mouse
💽 computer disk
💾 floppy disk save
💿 optical disk cd
📀 dvd
🎥 movie camera
📷 camera photo
📸 camera flash
📹 video camera
📼 videocassette
🔍 magnifying glass search
🔎 magnifying glass right
🕯️ candle
💡 light bulb idea tip
🔦 flashlight
🏮 red paper lantern
📔 notebook decorative
📕 closed book red
📖 open book read
📗 green book
📘 blue book
📙 orange book
📚 books library study
📓 notebook
📒 ledger
📃 page curl
📜 scroll
📄 page document
📰 newspaper news
🗞️ rolled newspaper
📑 bookmark tabs
🔖 bookmark
🏷️ label tag
💰 money bag
🪙 coin
💴 yen
💵 dollar money
💶 euro
💷 pound
💸 money wings spend
💳 credit card
🧾 receipt
💹 chart yen
✉️ envelope email letter
📧 e-mail
📨 incoming envelope
📩 envelope arrow
📤 outbox tray
📥 inbox tray
📦 package box shipping
📫 mailbox
🗳️ ballot box
✏️ pencil write edit
✒️ black nib pen
🖋️ fountain pen
🖊️ pen
🖌️ paintbrush
🖍️ crayon
📝 memo note write
💼 briefcase work job
📁 file folder
📂 open file folder
🗂️ card index dividers
📅 calendar date
📆 tear-off calendar
🗒️ spiral notepad
🗓️ spiral calendar
📇 card index
📈 chart increasing growth up
📉 chart decreasing down
📊 bar chart stats
📋 clipboard
📌 pushpin pin
📍 round pushpin location
📎 paperclip attach
🖇️ linked paperclips
📏 straight ruler
📐 triangular ruler
✂️ scissors cut
🗃️ card file box
🗄️ file cabinet
🗑️ wastebasket trash delete
🔒 locked lock secure
🔓 unlocked
🔏 locked pen
🔐 locked key
🔑 key password
🗝️ old key
🔨 hammer build
🪓 axe
⛏️ pick
⚒️ hammer pick
🛠️ hammer wrench tools
🗡️ dagger
⚔️ crossed swords
🛡️ shield protect
🔧 wrench fix
🪛 screwdriver
🔩 nut bolt
⚙️ gear settings
🗜️ clamp
⚖️ balance scale justice
🔗 link chain
⛓️ chains
🧰 toolbox
🧲 magnet
🪜 ladder
⚗️ alembic
🧪 test tube science
🧫 petri dish
🧬 dna
🔬 microscope
🔭 telescope
📡 satellite antenna
💉 syringe
🩸 drop of blood
💊 pill medicine
🩹 adhesive bandage
🩺 stethoscope
🚪 door
🛏️ bed sleep
🛋️ couch lamp
🪑 chair
🚽 toilet
🚿 shower
🛁 bathtub
🧴 lotion bottle
🧷 safety pin
🧹 broom clean
🧺 basket
🧻 roll paper
🧼 soap
🪥 toothbrush
🧽 sponge
🛒 shopping cart
🎒 backpack school
👓 glasses
🕶️ sunglasses
👔 necktie
👕 t-shirt
👖 jeans
🧣 scarf
🧤 gloves
🧥 coat
🧦 socks
👗 dress
👟 running shoe sneaker
👠 high heel
👑 crown king queen
🎩 top hat
🧢 billed cap
⏰ alarm clock wake
⏱️ stopwatch timer
⏲️ timer clock
⏳ hourglass time waiting
⌛ hourglass done
🕰️ mantelpiece clock
🔋 battery
🪫 low battery
🔌 electric plug
🧯 fire extinguisher
🛎️ bellhop bell
🔔 bell notification
🔕 bell slash mute
📣 megaphone announce
📢 loudspeaker
💬 speech balloon chat comment
💭 thought balloon
🗯️ anger bubble
`,
    },
    {
        id: 'symbols',
        label: 'Symbols',
        data: `
❤️ red heart love
🧡 orange heart
💛 yellow heart
💚 green heart
💙 blue heart
💜 purple heart
🖤 black heart
🤍 white heart
🤎 brown heart
💔 broken heart
❣️ heart exclamation
💕 two hearts
💞 revolving hearts
💓 beating heart
💗 growing heart
💖 sparkling heart
💘 heart arrow
💝 heart ribbon gift
💟 heart decoration
☮️ peace
✝️ cross
☯️ yin yang balance
🕉️ om
♈ aries
♉ taurus
♊ gemini
♋ cancer
♌ leo
♍ virgo
♎ libra
♏ scorpio
♐ sagittarius
♑ capricorn
♒ aquarius
♓ pisces
🆔 id
⚛️ atom
✅ check mark button done yes complete
☑️ check box
✔️ check mark
❌ cross mark no wrong
❎ cross mark button
➕ plus add
➖ minus
➗ divide
✖️ multiply
♾️ infinity forever
❓ question mark
❔ white question
❕ white exclamation
❗ exclamation important
‼️ double exclamation
⁉️ exclamation question
💯 hundred points perfect
🔅 dim
🔆 bright
⚠️ warning caution
🚸 children crossing
🔱 trident
⚜️ fleur de lis
🔰 beginner
♻️ recycling
✳️ eight spoked asterisk
❇️ sparkle
✴️ eight pointed star
🌀 cyclone
💤 zzz sleep
🔃 clockwise arrows refresh
🔄 counterclockwise arrows repeat sync
🔙 back arrow
🔚 end arrow
🔛 on arrow
🔜 soon arrow
🔝 top arrow
⬆️ up arrow
↗️ up right arrow
➡️ right arrow next
↘️ down right arrow
⬇️ down arrow
↙️ down left arrow
⬅️ left arrow back
↖️ up left arrow
↕️ up down arrow
↔️ left right arrow
↩️ return arrow
↪️ right curve arrow
🔀 shuffle
🔁 repeat
🔂 repeat once
▶️ play
⏸️ pause
⏯️ play pause
⏹️ stop
⏺️ record
⏭️ next track
⏮️ previous track
⏩ fast forward
⏪ rewind
🔼 upwards button
🔽 downwards button
🎦 cinema
📶 antenna bars signal
📳 vibration mode
📴 phone off
🔇 muted speaker
🔈 speaker low
🔉 speaker medium
🔊 speaker loud volume
#️⃣ hash number
*️⃣ asterisk
0️⃣ zero
1️⃣ one
2️⃣ two
3️⃣ three
4️⃣ four
5️⃣ five
6️⃣ six
7️⃣ seven
8️⃣ eight
9️⃣ nine
🔟 ten
🔠 uppercase letters
🔡 lowercase letters
🔢 numbers
🔣 symbols
🔤 abc letters
🅰️ a button
🆎 ab button
🅱️ b button
🆑 cl button
🆒 cool button
🆓 free button
ℹ️ information info
🆕 new button
🆖 ng button
🅾️ o button
🆗 ok button
🅿️ p button parking
🆘 sos help
🆙 up button
🆚 vs versus
🔴 red circle
🟠 orange circle
🟡 yellow circle
🟢 green circle
🔵 blue circle
🟣 purple circle
🟤 brown circle
⚫ black circle
⚪ white circle
🟥 red square
🟧 orange square
🟨 yellow square
🟩 green square
🟦 blue square
🟪 purple square
🟫 brown square
⬛ black large square
⬜ white large square
🔶 large orange diamond
🔷 large blue diamond
🔸 small orange diamond
🔹 small blue diamond
🔺 red triangle up
🔻 red triangle down
💠 diamond dot
🔘 radio button
🔳 white square button
🔲 black square button
🏁 chequered flag finish race
🚩 triangular flag
🎌 crossed flags
🏴 black flag
🏳️ white flag
🏳️‍🌈 rainbow flag pride
`,
    },
];

function parse(data: string): EmojiEntry[] {
    return data
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const space = line.indexOf(' ');
            let rest = line.slice(space + 1).trim();
            const tone = rest.endsWith('~');
            if (tone) rest = rest.slice(0, -1).trim();
            return { e: line.slice(0, space), n: rest, tone };
        });
}

export const EMOJI_CATEGORIES: EmojiCategory[] = RAW.map(({ id, label, data }) => ({ id, label, emojis: parse(data) }));

export const ALL_EMOJI: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

export const SKIN_TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'] as const;

/** Applies a Fitzpatrick modifier to an emoji that supports one. */
export function withSkinTone(entry: EmojiEntry, toneIndex: number): string {
    if (!entry.tone || toneIndex <= 0) return entry.e;
    const base = entry.e.replace(/️/g, '');
    return base + SKIN_TONES[toneIndex];
}

export function searchEmoji(query: string): EmojiEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    return ALL_EMOJI.filter((entry) => words.every((w) => entry.n.includes(w)));
}
