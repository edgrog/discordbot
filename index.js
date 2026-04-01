// ─────────────────────────────────────────────────────────────────────────────
// GROG PARTNER BOT — Production Build
// ─────────────────────────────────────────────────────────────────────────────

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ─── Constants ────────────────────────────────────────────────────────────────

const REAPPLY_DAYS             = 90;
const SESSION_TTL_MS           = 30 * 60 * 1000; // 30 minutes
const SESSION_CLEANUP_INTERVAL = 5  * 60 * 1000; // run cleanup every 5 min
const EMBED_FIELD_MAX          = 1024;            // Discord embed field char limit

const CATEGORY_LABELS = {
  bar:     'Bar / Club / Liquor Store',
  club:    'Club / Community Organiser',
  artist:  'Artist / Creative Professional',
  creator: 'Content Creator / Streamer',
};

const CATEGORY_EMOJIS = {
  bar: '🍺', club: '🎉', artist: '🎨', creator: '🎥',
};

const ROLE_ENV_KEYS = {
  bar: 'ROLE_BAR', club: 'ROLE_CLUB', artist: 'ROLE_ARTIST', creator: 'ROLE_CREATOR',
};

// ─── Env Validation ───────────────────────────────────────────────────────────

(function validateEnv() {
  const required = ['BOT_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ADMIN_CHANNEL_ID'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length) { console.error(`❌ Missing required env vars: ${missing.join(', ')}`); process.exit(1); }

  const optional = ['ROLE_BAR', 'ROLE_CLUB', 'ROLE_ARTIST', 'ROLE_CREATOR'];
  const missingOpt = optional.filter(k => !process.env[k]);
  if (missingOpt.length) console.warn(`⚠️  Role IDs missing for: ${missingOpt.join(', ')} — role assignment will skip for these categories`);

  console.log('✅ Environment validated');
})();

// ─── Clients ──────────────────────────────────────────────────────────────────

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level, msg, meta = {}) {
  const ts      = new Date().toISOString();
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  const fn      = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  console[fn](`[${ts}] [${level.toUpperCase()}] ${msg}${metaStr}`);
}

// ─── Session Store ────────────────────────────────────────────────────────────

const sessions = new Map(); // userId → { data, expiresAt }

function setSession(userId, data) {
  const prev = sessions.get(userId) || { data: {}, expiresAt: 0 };
  sessions.set(userId, { data: { ...prev.data, ...data }, expiresAt: Date.now() + SESSION_TTL_MS });
}

function getSession(userId) {
  const s = sessions.get(userId);
  if (!s) return {};
  if (Date.now() > s.expiresAt) { sessions.delete(userId); return {}; }
  return s.data;
}

function clearSession(userId) { sessions.delete(userId); }

setInterval(() => {
  const now = Date.now();
  let n = 0;
  for (const [id, s] of sessions.entries()) { if (now > s.expiresAt) { sessions.delete(id); n++; } }
  if (n > 0) log('info', `Session cleanup: removed ${n} expired sessions`);
}, SESSION_CLEANUP_INTERVAL);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(str, max = EMBED_FIELD_MAX) {
  if (!str) return '—';
  const s = String(str).trim();
  if (!s) return '—';
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

function parseAge(dobStr) {
  if (!dobStr) return null;
  const m = dobStr.trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const dob = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
  if (dob.getFullYear() !== parseInt(yyyy) || dob.getMonth() !== parseInt(mm) - 1 || dob.getDate() !== parseInt(dd)) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--;
  return age;
}

function reapplyDateStr(createdAt) {
  const d = new Date(new Date(createdAt).getTime() + REAPPLY_DAYS * 86400000);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntilReapply(createdAt) {
  const elapsed = Date.now() - new Date(createdAt).getTime();
  return Math.ceil(REAPPLY_DAYS - elapsed / 86400000);
}

async function alertAdmin(message) {
  try {
    const ch = client.channels.cache.get(process.env.ADMIN_CHANNEL_ID);
    if (ch) await ch.send(message);
  } catch (err) { log('error', 'Failed to send admin alert', { err: err.message }); }
}

// ─── Application Status Lookup ────────────────────────────────────────────────

async function getExistingApplications(discordId) {
  const { data, error } = await supabase
    .from('partner_applications')
    .select('category, status, created_at')
    .eq('discord_id', discordId)
    .order('created_at', { ascending: false });

  if (error) { log('error', 'Failed to fetch existing applications', { discordId, error: error.message }); return null; }

  const map = {};
  for (const row of data) { if (!map[row.category]) map[row.category] = row; }
  return map;
}

function buildOptionDescription(category, existingApps) {
  if (!existingApps) return undefined;
  const ex = existingApps[category];
  if (!ex) return undefined;
  if (ex.status === 'pending')  return '⏳ Application pending review';
  if (ex.status === 'approved') return '✅ Already a partner';
  if (ex.status === 'rejected') {
    const days = daysUntilReapply(ex.created_at);
    return days > 0
      ? `🔒 Reapply available ${reapplyDateStr(ex.created_at)}`
      : '🔄 Eligible to reapply';
  }
  return undefined;
}

// ─── Slash Commands ───────────────────────────────────────────────────────────

const commands = [
  new SlashCommandBuilder().setName('apply').setDescription('Apply to become a Grog Partner 🍋').toJSON(),
];

// ─── Modal Builders ───────────────────────────────────────────────────────────

function buildPersonalModal1(category) {
  return new ModalBuilder().setCustomId(`personal_1_${category}`).setTitle('🍋 Grog Partner — Your Details').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('full_name').setLabel('Full Name').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('email').setLabel('Email Address').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('phone').setLabel('Phone Number').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dob').setLabel('Date of Birth (DD/MM/YYYY — Must be 21+)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. 15/03/1995')),
  );
}

function buildPersonalModal2(category) {
  return new ModalBuilder().setCustomId(`personal_2_${category}`).setTitle('🍋 Grog Partner — Your Address').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('address').setLabel('Address Line 1').setStyle(TextInputStyle.Short).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('city').setLabel('City').setStyle(TextInputStyle.Short).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('state').setLabel('State / Province / Region').setStyle(TextInputStyle.Short).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('zip').setLabel('ZIP / Postal Code').setStyle(TextInputStyle.Short).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('country').setLabel('Country').setStyle(TextInputStyle.Short).setRequired(false)),
  );
}

function buildBarModal1() {
  return new ModalBuilder().setCustomId('cat_bar_1').setTitle('🍺 Your Venue — Location').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('estab_name').setLabel('Name of Establishment').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('estab_address').setLabel('Establishment Address').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('estab_city').setLabel('City').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('estab_state').setLabel('State / Region').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('estab_zip_country').setLabel('ZIP / Postal Code & Country').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. 90210, USA')),
  );
}

function buildBarModal2() {
  return new ModalBuilder().setCustomId('cat_bar_2').setTitle('🍺 Your Venue — Details').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('estab_type').setLabel('Type of Establishment').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Cocktail Bar / Dive Bar / Nightclub / Restaurant / Liquor Store')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('stocks_grog').setLabel('Do you currently stock Grog?').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Yes consistently / Occasionally / No but interested')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('promo_activities').setLabel("Promotional activities you're interested in?").setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('e.g. Grog cocktail menu, dedicated events, tastings...')),
  );
}

function buildClubModal1() {
  return new ModalBuilder().setCustomId('cat_club_1').setTitle('🎉 Your Club — Details').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('club_name').setLabel('Name of Club / Society / Organisation').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('club_type').setLabel('Type of Club').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. Social Club, Hobby Group, Professional Network')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('club_activities').setLabel('Primary Activities of Your Group').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('member_count').setLabel('Approximate Number of Members').setStyle(TextInputStyle.Short).setRequired(true)),
  );
}

function buildClubModal2() {
  return new ModalBuilder().setCustomId('cat_club_2').setTitle('🎉 Your Club — Events & Grog').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('event_frequency').setLabel('How often does your club host events?').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Weekly / Bi-Weekly / Monthly / Quarterly / Less frequently')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('grog_help').setLabel('How can Grog help your club?').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Giveaways, event sponsorship, product supply...')),
  );
}

function buildArtistModal() {
  return new ModalBuilder().setCustomId('cat_artist_1').setTitle('🎨 Your Creative Profile').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('artist_name').setLabel('Artist Name').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mediums').setLabel('Primary Artistic Mediums').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. Digital Art, Photography, Videography, Music')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('portfolio_link').setLabel('Portfolio or Primary Creative Profile Link').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('social_link').setLabel('Primary Social Media Link').setStyle(TextInputStyle.Short).setRequired(false)),
  );
}

function buildCreatorModal1() {
  return new ModalBuilder().setCustomId('cat_creator_1').setTitle('🎥 Your Creator Profile').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('creator_name').setLabel('Creator Name / Handle').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('platforms').setLabel('Primary Platforms').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. TikTok, Instagram, YouTube, Twitch')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_links').setLabel('Links to Your Channels').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('One link per line')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('follower_count').setLabel('Approx. Total Followers Across All Platforms').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. 84,000')),
  );
}

function buildCreatorModal2() {
  return new ModalBuilder().setCustomId('cat_creator_2').setTitle('🎥 Your Content').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('niche').setLabel('Main Creator Niche / Genre').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. Gaming, Lifestyle, Food/Cooking, Travel')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('audience_description').setLabel('Describe your content & audience demographics').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Age range, gender split, location, what you make...')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('content_types').setLabel('Content types you can create for Grog').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. Product Reviews, Reels, UGC, Giveaways, Live Streams')),
  );
}

// ─── Embed Field Builder ──────────────────────────────────────────────────────

function getCategoryFields(data) {
  switch (data.category) {
    case 'bar': return [
      { name: '🏠 Establishment', value: truncate(data.estab_name),      inline: true },
      { name: '📍 Venue City',    value: truncate(data.estab_city),      inline: true },
      { name: '🏷️ Type',         value: truncate(data.estab_type),      inline: true },
      { name: '📦 Stocks Grog?', value: truncate(data.stocks_grog),     inline: true },
      { name: '📣 Promo Ideas',  value: truncate(data.promo_activities) },
    ];
    case 'club': return [
      { name: '🎉 Club Name',      value: truncate(data.club_name),       inline: true },
      { name: '🏷️ Type',          value: truncate(data.club_type),       inline: true },
      { name: '👥 Members',        value: truncate(data.member_count),    inline: true },
      { name: '📅 Freq',           value: truncate(data.event_frequency), inline: true },
      { name: '📋 Activities',     value: truncate(data.club_activities) },
      { name: '🤝 How Grog Helps', value: truncate(data.grog_help) },
    ];
    case 'artist': return [
      { name: '🎨 Artist Name', value: truncate(data.artist_name),    inline: true },
      { name: '🖌️ Mediums',    value: truncate(data.mediums),        inline: true },
      { name: '🔗 Portfolio',   value: truncate(data.portfolio_link) },
      { name: '📱 Social',      value: truncate(data.social_link) },
    ];
    case 'creator': return [
      { name: '🎥 Creator',   value: truncate(data.creator_name),         inline: true },
      { name: '📱 Platforms', value: truncate(data.platforms),            inline: true },
      { name: '👥 Followers', value: truncate(data.follower_count),       inline: true },
      { name: '🎯 Niche',     value: truncate(data.niche),               inline: true },
      { name: '🔗 Channels',  value: truncate(data.channel_links) },
      { name: '👤 Audience',  value: truncate(data.audience_description) },
      { name: '📹 Content Types', value: truncate(data.content_types) },
    ];
    default: return [];
  }
}

// ─── Finalize Application ─────────────────────────────────────────────────────

async function finalizeApplication(interaction, userId, sessionData) {
  const { data: app, error } = await supabase
    .from('partner_applications')
    .insert([{
      discord_id:       userId,
      discord_username: interaction.user.tag,
      full_name:        sessionData.full_name,
      email:            sessionData.email,
      phone:            sessionData.phone,
      dob:              sessionData.dob,
      address:          sessionData.address,
      city:             sessionData.city,
      state:            sessionData.state,
      zip:              sessionData.zip,
      country:          sessionData.country,
      category:         sessionData.category,
      answers:          sessionData,
      status:           'pending',
      created_at:       new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) {
    log('error', 'Supabase insert failed', { userId, error: error.message });
    await interaction.reply({ content: '❌ Something went wrong saving your application. Please try again or ping the Grog crew.', ephemeral: true });
    return;
  }

  log('info', 'Application submitted', { appId: app.id, userId, category: sessionData.category });

  const location = [sessionData.city, sessionData.state, sessionData.country].filter(Boolean).join(', ') || '—';

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(`${CATEGORY_EMOJIS[sessionData.category]} New Partner Application`)
    .setDescription(`**${CATEGORY_LABELS[sessionData.category]}**`)
    .addFields(
      { name: '👤 Name',      value: truncate(sessionData.full_name), inline: true },
      { name: '🏷️ Discord',  value: `<@${userId}>`,                  inline: true },
      { name: '📧 Email',    value: truncate(sessionData.email),      inline: true },
      { name: '📞 Phone',    value: truncate(sessionData.phone),      inline: true },
      { name: '🎂 DOB',      value: truncate(sessionData.dob),        inline: true },
      { name: '📍 Location', value: truncate(location),              inline: true },
      ...getCategoryFields(sessionData),
    )
    .setFooter({ text: `Application ID: ${app.id}` })
    .setTimestamp();

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`approve_${app.id}_${userId}`).setLabel('✅ Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject_${app.id}_${userId}`).setLabel('❌ Reject').setStyle(ButtonStyle.Danger),
  );

  const adminChannel = client.channels.cache.get(process.env.ADMIN_CHANNEL_ID);
  if (adminChannel) {
    await adminChannel.send({ embeds: [embed], components: [buttons] });
  } else {
    log('error', 'Admin channel not found — app saved to DB but no card posted', { appId: app.id });
  }

  clearSession(userId);

  await interaction.reply({
    content: '🍋 **Application submitted!**\nThe Grog crew will review it and get back to you soon. Stay tuned 👀',
    ephemeral: true,
  });
}

// ─── Slash Commands ───────────────────────────────────────────────────────────

client.once('ready', async () => {
  log('info', `Bot online as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    log('info', 'Slash commands registered');
  } catch (err) {
    log('error', 'Command registration failed', { err: err.message });
  }
});

// ─── Interaction Handler ──────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
  const userId = interaction.user.id;

  // ── /apply ────────────────────────────────────────────────────────────────

  if (interaction.isChatInputCommand() && interaction.commandName === 'apply') {
    await interaction.deferReply({ ephemeral: true });

    const existingApps = await getExistingApplications(userId);
    setSession(userId, { existingApps }); // cache for category_select

    const options = [
      { label: '🎥 Content Creator / Streamer',          value: 'creator' },
      { label: '🎨 Artist / Creative Professional',      value: 'artist'  },
      { label: '🎉 Club President / Community Organiser', value: 'club'    },
      { label: '🍺 Bar / Club / Liquor Store Manager',   value: 'bar'     },
    ].map(opt => {
      const desc = buildOptionDescription(opt.value, existingApps);
      return desc ? { ...opt, description: desc } : opt;
    });

    await interaction.editReply({
      content: '## 🍋 Grog Partner Program\nPick your category below to get started.\n\n> 📌 Make sure you\'ve joined our Discord before applying.',
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('category_select').setPlaceholder('What best describes you?').addOptions(options)
      )],
    });
    return;
  }

  // ── Category Select ───────────────────────────────────────────────────────

  if (interaction.isStringSelectMenu() && interaction.customId === 'category_select') {
    const category     = interaction.values[0];
    const session      = getSession(userId);
    const existingApps = session.existingApps !== undefined
      ? session.existingApps
      : await getExistingApplications(userId); // re-fetch if session expired

    const existing = existingApps?.[category];

    if (existing?.status === 'pending') {
      await interaction.update({
        content: `⏳ **You already have a pending application as a ${CATEGORY_LABELS[category]}.**\nWe're reviewing it — sit tight 🍋\n\nIf it's been more than a week, ping us in this server.`,
        components: [],
      });
      return;
    }

    if (existing?.status === 'approved') {
      await interaction.update({
        content: `✅ **You're already a Grog ${CATEGORY_LABELS[category]} Partner!**\nCheck your private partner channels 🍹`,
        components: [],
      });
      return;
    }

    if (existing?.status === 'rejected') {
      const days = daysUntilReapply(existing.created_at);
      if (days > 0) {
        await interaction.update({
          content: `🔒 **You're not eligible to reapply as a ${CATEGORY_LABELS[category]} yet.**\nYou can reapply after **${reapplyDateStr(existing.created_at)}** (${days} days away).\n\nIn the meantime, keep spreading the Grog love 🍊`,
          components: [],
        });
        return;
      }
      // Cooldown passed — fall through and allow reapply
    }

    setSession(userId, { category, existingApps });
    await interaction.showModal(buildPersonalModal1(category));
    return;
  }

  // ── Modal Submissions ─────────────────────────────────────────────────────

  if (interaction.isModalSubmit()) {
    const id = interaction.customId;
    const f  = interaction.fields;

    // Helper: session expiry guard for mid-flow steps
    const guardSession = async (requiredKey = 'category') => {
      const s = getSession(userId);
      if (!s[requiredKey]) {
        await interaction.reply({ content: '❌ **Your session expired.** Run `/apply` to start again — sorry about that!', ephemeral: true });
        return null;
      }
      return s;
    };

    // ── Personal Step 1 ────────────────────────────────────────────────────

    if (id.startsWith('personal_1_')) {
      const category = id.replace('personal_1_', '');

      // Age validation
      const dobRaw = f.getTextInputValue('dob').trim();
      const age    = parseAge(dobRaw);
      if (age === null) {
        await interaction.reply({ content: '❌ **Invalid date format.** Please use DD/MM/YYYY (e.g. `15/03/1995`).\nRun `/apply` to start again.', ephemeral: true });
        clearSession(userId);
        return;
      }
      if (age < 21) {
        await interaction.reply({ content: '❌ **You must be 21 or older to apply for the Grog Partner Program.** Come back when you\'re of age 🍋', ephemeral: true });
        clearSession(userId);
        return;
      }

      // Email validation
      const email = f.getTextInputValue('email').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await interaction.reply({ content: '❌ **That doesn\'t look like a valid email address.** Run `/apply` to try again.', ephemeral: true });
        clearSession(userId);
        return;
      }

      setSession(userId, { category, full_name: f.getTextInputValue('full_name').trim(), email, phone: f.getTextInputValue('phone').trim(), dob: dobRaw });
      await interaction.showModal(buildPersonalModal2(category));
      return;
    }

    // ── Personal Step 2 → route to category ────────────────────────────────

    if (id.startsWith('personal_2_')) {
      const category = id.replace('personal_2_', '');
      if (!(await guardSession('full_name'))) return;

      setSession(userId, {
        address: f.getTextInputValue('address').trim(),
        city:    f.getTextInputValue('city').trim(),
        state:   f.getTextInputValue('state').trim(),
        zip:     f.getTextInputValue('zip').trim(),
        country: f.getTextInputValue('country').trim(),
      });

      switch (category) {
        case 'bar':     await interaction.showModal(buildBarModal1());     break;
        case 'club':    await interaction.showModal(buildClubModal1());    break;
        case 'artist':  await interaction.showModal(buildArtistModal());   break;
        case 'creator': await interaction.showModal(buildCreatorModal1()); break;
        default:
          log('warn', 'Unknown category in personal_2', { category, userId });
          await interaction.reply({ content: '❌ Unknown category. Run `/apply` to start again.', ephemeral: true });
          clearSession(userId);
      }
      return;
    }

    // ── Bar Step 1 ─────────────────────────────────────────────────────────

    if (id === 'cat_bar_1') {
      if (!(await guardSession())) return;
      setSession(userId, {
        estab_name:        f.getTextInputValue('estab_name').trim(),
        estab_address:     f.getTextInputValue('estab_address').trim(),
        estab_city:        f.getTextInputValue('estab_city').trim(),
        estab_state:       f.getTextInputValue('estab_state').trim(),
        estab_zip_country: f.getTextInputValue('estab_zip_country').trim(),
      });
      await interaction.showModal(buildBarModal2());
      return;
    }

    // ── Bar Step 2 → finalize ──────────────────────────────────────────────

    if (id === 'cat_bar_2') {
      if (!(await guardSession())) return;
      setSession(userId, {
        estab_type:       f.getTextInputValue('estab_type').trim(),
        stocks_grog:      f.getTextInputValue('stocks_grog').trim(),
        promo_activities: f.getTextInputValue('promo_activities').trim(),
      });
      await finalizeApplication(interaction, userId, getSession(userId));
      return;
    }

    // ── Club Step 1 ────────────────────────────────────────────────────────

    if (id === 'cat_club_1') {
      if (!(await guardSession())) return;
      setSession(userId, {
        club_name:       f.getTextInputValue('club_name').trim(),
        club_type:       f.getTextInputValue('club_type').trim(),
        club_activities: f.getTextInputValue('club_activities').trim(),
        member_count:    f.getTextInputValue('member_count').trim(),
      });
      await interaction.showModal(buildClubModal2());
      return;
    }

    // ── Club Step 2 → finalize ─────────────────────────────────────────────

    if (id === 'cat_club_2') {
      if (!(await guardSession())) return;
      setSession(userId, {
        event_frequency: f.getTextInputValue('event_frequency').trim(),
        grog_help:       f.getTextInputValue('grog_help').trim(),
      });
      await finalizeApplication(interaction, userId, getSession(userId));
      return;
    }

    // ── Artist → finalize ──────────────────────────────────────────────────

    if (id === 'cat_artist_1') {
      if (!(await guardSession())) return;
      setSession(userId, {
        artist_name:    f.getTextInputValue('artist_name').trim(),
        mediums:        f.getTextInputValue('mediums').trim(),
        portfolio_link: f.getTextInputValue('portfolio_link').trim(),
        social_link:    f.getTextInputValue('social_link').trim(),
      });
      await finalizeApplication(interaction, userId, getSession(userId));
      return;
    }

    // ── Creator Step 1 ─────────────────────────────────────────────────────

    if (id === 'cat_creator_1') {
      if (!(await guardSession())) return;
      setSession(userId, {
        creator_name:  f.getTextInputValue('creator_name').trim(),
        platforms:     f.getTextInputValue('platforms').trim(),
        channel_links: f.getTextInputValue('channel_links').trim(),
        follower_count: f.getTextInputValue('follower_count').trim(),
      });
      await interaction.showModal(buildCreatorModal2());
      return;
    }

    // ── Creator Step 2 → finalize ──────────────────────────────────────────

    if (id === 'cat_creator_2') {
      if (!(await guardSession())) return;
      setSession(userId, {
        niche:                f.getTextInputValue('niche').trim(),
        audience_description: f.getTextInputValue('audience_description').trim(),
        content_types:        f.getTextInputValue('content_types').trim(),
      });
      await finalizeApplication(interaction, userId, getSession(userId));
      return;
    }
  }

  // ── Approve / Reject Buttons ──────────────────────────────────────────────

  if (interaction.isButton()) {
    const parts        = interaction.customId.split('_');
    const action       = parts[0];
    const appId        = parts[1];
    const targetUserId = parts[2];

    if (action !== 'approve' && action !== 'reject') return;

    // Permission check
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: '❌ You don\'t have permission to review applications.', ephemeral: true });
      return;
    }

    // Race condition guard — check current status before acting
    const { data: currentApp, error: fetchErr } = await supabase
      .from('partner_applications')
      .select('id, status, category, discord_id')
      .eq('id', appId)
      .single();

    if (fetchErr || !currentApp) {
      log('error', 'Could not fetch app for review', { appId, err: fetchErr?.message });
      await interaction.reply({ content: '❌ Could not find that application in the database.', ephemeral: true });
      return;
    }

    if (currentApp.status !== 'pending') {
      await interaction.reply({
        content: `⚠️ This application was already **${currentApp.status}**. No changes made.`,
        ephemeral: true,
      });
      return;
    }

    // Update Supabase
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { error: updateErr } = await supabase
      .from('partner_applications')
      .update({ status: newStatus, reviewed_by: interaction.user.tag })
      .eq('id', appId);

    if (updateErr) {
      log('error', 'Supabase update failed on review', { appId, err: updateErr.message });
      await interaction.reply({ content: '❌ Database update failed. Try again.', ephemeral: true });
      return;
    }

    log('info', `Application ${newStatus}`, { appId, reviewer: interaction.user.tag, targetUserId });

    // Role assignment (approve only)
    if (action === 'approve') {
      const roleId = process.env[ROLE_ENV_KEYS[currentApp.category]];
      if (!roleId) {
        log('warn', 'No role ID for category', { category: currentApp.category });
        await alertAdmin(`⚠️ **Role not assigned** for <@${targetUserId}> (App \`${appId}\`) — no role ID configured for \`${currentApp.category}\`. Please assign manually.`);
      } else {
        try {
          const member = await interaction.guild.members.fetch(targetUserId);
          await member.roles.add(roleId);
          log('info', 'Role assigned', { userId: targetUserId, roleId });
        } catch (err) {
          const hint = err.code === 50013
            ? 'Bot role must be **above** partner roles in Server Settings → Roles.'
            : err.message;
          log('error', 'Role assignment failed', { err: err.message, code: err.code });
          await alertAdmin(`⚠️ **Role assignment failed** for <@${targetUserId}> (App \`${appId}\`) — ${hint} Please assign manually.`);
        }
      }
    }

    // DM the applicant
    try {
      const targetUser = await client.users.fetch(targetUserId);
      await targetUser.send(
        action === 'approve'
          ? `🍋 **You're in!**\n\nWelcome to the Grog Partner Program! Your private channels are now unlocked.\n\nLet's cook something fun together 🍹`
          : `Hey! Thanks for applying to the Grog Partner Program.\n\nUnfortunately we're not moving forward right now — but keep your eyes open, things change fast. Keep drinking Grog 🍊`
      );
    } catch (err) {
      log('warn', 'Could not DM applicant — DMs likely closed', { targetUserId });
      await alertAdmin(`ℹ️ Couldn't DM <@${targetUserId}> after **${newStatus}** (App \`${appId}\`) — they may have DMs closed. Notify them manually if needed.`);
    }

    // Update the embed to show outcome
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(action === 'approve' ? 0x00C853 : 0xD50000)
      .setFooter({ text: `${action === 'approve' ? '✅ APPROVED' : '❌ REJECTED'} by ${interaction.user.tag} • App ID: ${appId}` });

    await interaction.update({ embeds: [updatedEmbed], components: [] });
  }
});

// ─── Global Error Handlers ────────────────────────────────────────────────────

process.on('unhandledRejection', (err) => log('error', 'Unhandled rejection', { err: err?.message || String(err) }));
client.on('error', (err) => log('error', 'Discord client error', { err: err.message }));

// ─── Start ────────────────────────────────────────────────────────────────────

client.login(process.env.BOT_TOKEN);
