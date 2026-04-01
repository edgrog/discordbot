// ─────────────────────────────────────────────────────────────────────────────
// GROG PARTNER BOT — Rebuilt with Dynamic Forms + HTTP API
// ─────────────────────────────────────────────────────────────────────────────

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const { loadFormConfig, getPersonalModal, getCategoryModal, getCategoryStepCount, getFieldKeys } = require('./lib/dynamic-forms');
const { startSignalPoller } = require('./lib/signal-poller');
const { createHttpApi } = require('./lib/http-api');

// ─── Constants ────────────────────────────────────────────────────────────────

const REAPPLY_DAYS             = 90;
const SESSION_TTL_MS           = 30 * 60 * 1000;
const SESSION_CLEANUP_INTERVAL = 5  * 60 * 1000;
const EMBED_FIELD_MAX          = 1024;
const HEARTBEAT_INTERVAL       = 60 * 1000;

const CATEGORY_LABELS = {
  bar:     'Bar / Club / Liquor Store',
  club:    'Club / Community Organiser',
  artist:  'Artist / Creative Professional',
  creator: 'Content Creator / Streamer',
};

const CATEGORY_EMOJIS = {
  bar: '🍺', club: '🎉', artist: '🎨', creator: '🎥',
};

// ─── Env Validation ───────────────────────────────────────────────────────────

(function validateEnv() {
  const required = ['BOT_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ADMIN_CHANNEL_ID'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length) { console.error(`Missing required env vars: ${missing.join(', ')}`); process.exit(1); }

  if (!process.env.BOT_API_SECRET) console.warn('BOT_API_SECRET not set — HTTP API will reject all requests');
  console.log('Environment validated');
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

const sessions = new Map();

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

const commands = [
  new SlashCommandBuilder().setName('apply').setDescription('Apply to become a Grog Partner 🍋').toJSON(),
  new SlashCommandBuilder()
    .setName('reload-forms')
    .setDescription('Reload form config from database (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .toJSON(),
];

// ─── Bot Ready ────────────────────────────────────────────────────────────────

client.once('ready', async () => {
  log('info', `Bot online as ${client.user.tag}`);

  // Register commands
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    log('info', 'Slash commands registered');
  } catch (err) {
    log('error', 'Command registration failed', { err: err.message });
  }

  // Load dynamic forms
  await loadFormConfig(supabase, log);

  // Start signal poller
  startSignalPoller(supabase, () => loadFormConfig(supabase, log), log);

  // Start heartbeat
  async function heartbeat() {
    await supabase
      .from('settings')
      .upsert({ key: 'bot_heartbeat', value: new Date().toISOString() })
      .then();
  }
  heartbeat();
  setInterval(heartbeat, HEARTBEAT_INTERVAL);

  // Start HTTP API
  const port = process.env.BOT_API_PORT || 3001;
  const httpApp = createHttpApi({
    supabase,
    client,
    log,
    reloadForms: () => loadFormConfig(supabase, log),
  });
  httpApp.listen(port, () => {
    log('info', `HTTP API listening on port ${port}`);
  });
});

// ─── Interaction Handler ──────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
  const userId = interaction.user.id;

  // ── /apply ────────────────────────────────────────────────────────────────

  if (interaction.isChatInputCommand() && interaction.commandName === 'apply') {
    await interaction.deferReply({ ephemeral: true });

    const existingApps = await getExistingApplications(userId);
    setSession(userId, { existingApps });

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

  // ── /reload-forms ─────────────────────────────────────────────────────────

  if (interaction.isChatInputCommand() && interaction.commandName === 'reload-forms') {
    await interaction.deferReply({ ephemeral: true });
    const success = await loadFormConfig(supabase, log);
    await interaction.editReply({
      content: success
        ? '✅ Form config reloaded from database.'
        : '❌ Failed to reload form config. Check bot logs.',
    });
    return;
  }

  // ── Category Select ───────────────────────────────────────────────────────

  if (interaction.isStringSelectMenu() && interaction.customId === 'category_select') {
    const category     = interaction.values[0];
    const session      = getSession(userId);
    const existingApps = session.existingApps !== undefined
      ? session.existingApps
      : await getExistingApplications(userId);

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
    }

    setSession(userId, { category, existingApps });
    const modal = getPersonalModal(1, category);
    if (!modal) {
      await interaction.update({ content: '❌ Form config not loaded. Try again in a moment.', components: [] });
      return;
    }
    await interaction.showModal(modal);
    return;
  }

  // ── Modal Submissions ─────────────────────────────────────────────────────

  if (interaction.isModalSubmit()) {
    const id = interaction.customId;
    const f  = interaction.fields;

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

      // Age validation (hardcoded)
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

      // Email validation (hardcoded)
      const email = f.getTextInputValue('email').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await interaction.reply({ content: '❌ **That doesn\'t look like a valid email address.** Run `/apply` to try again.', ephemeral: true });
        clearSession(userId);
        return;
      }

      // Collect all fields from personal step 1 dynamically
      const fieldKeys = getFieldKeys('personal', 1);
      const stepData = { category };
      for (const key of fieldKeys) {
        try { stepData[key] = f.getTextInputValue(key).trim(); } catch { /* field might not exist */ }
      }

      setSession(userId, stepData);
      const nextModal = getPersonalModal(2, category);
      if (nextModal) {
        await interaction.showModal(nextModal);
      }
      return;
    }

    // ── Personal Step 2 → route to category ────────────────────────────────

    if (id.startsWith('personal_2_')) {
      const category = id.replace('personal_2_', '');
      if (!(await guardSession('full_name'))) return;

      const fieldKeys = getFieldKeys('personal', 2);
      const stepData = {};
      for (const key of fieldKeys) {
        try { stepData[key] = f.getTextInputValue(key).trim(); } catch { /* optional */ }
      }

      setSession(userId, stepData);

      const catModal = getCategoryModal(category, 1);
      if (catModal) {
        await interaction.showModal(catModal);
      } else {
        log('warn', 'No category modal found', { category, step: 1 });
        await interaction.reply({ content: '❌ Form config error. Contact the Grog crew.', ephemeral: true });
        clearSession(userId);
      }
      return;
    }

    // ── Category Steps (dynamic) ───────────────────────────────────────────

    const catMatch = id.match(/^cat_(\w+)_(\d+)$/);
    if (catMatch) {
      const category = catMatch[1];
      const step     = parseInt(catMatch[2]);

      if (!(await guardSession())) return;

      // Collect fields dynamically
      const fieldKeys = getFieldKeys(category, step);
      const stepData = {};
      for (const key of fieldKeys) {
        try { stepData[key] = f.getTextInputValue(key).trim(); } catch { /* optional */ }
      }
      setSession(userId, stepData);

      const totalSteps = getCategoryStepCount(category);

      if (step < totalSteps) {
        // More steps to go
        const nextModal = getCategoryModal(category, step + 1);
        if (nextModal) {
          await interaction.showModal(nextModal);
        } else {
          await finalizeApplication(interaction, userId, getSession(userId));
        }
      } else {
        // Final step — submit
        await finalizeApplication(interaction, userId, getSession(userId));
      }
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

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: '❌ You don\'t have permission to review applications.', ephemeral: true });
      return;
    }

    // Race condition guard
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
      const roleEnvKeys = { bar: 'ROLE_BAR', club: 'ROLE_CLUB', artist: 'ROLE_ARTIST', creator: 'ROLE_CREATOR' };
      const roleId = process.env[roleEnvKeys[currentApp.category]];
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
    let dmSent = true;
    try {
      const targetUser = await client.users.fetch(targetUserId);
      await targetUser.send(
        action === 'approve'
          ? `🍋 **You're in!**\n\nWelcome to the Grog Partner Program! Your private channels are now unlocked.\n\nLet's cook something fun together 🍹`
          : `Hey! Thanks for applying to the Grog Partner Program.\n\nUnfortunately we're not moving forward right now — but keep your eyes open, things change fast. Keep drinking Grog 🍊`
      );
    } catch (err) {
      dmSent = false;
      log('warn', 'Could not DM applicant — DMs likely closed', { targetUserId });
      await alertAdmin(`ℹ️ Couldn't DM <@${targetUserId}> after **${newStatus}** (App \`${appId}\`) — they may have DMs closed. Notify them manually if needed.`);
    }

    // Update dm_sent
    await supabase
      .from('partner_applications')
      .update({ dm_sent: dmSent })
      .eq('id', appId);

    // Update the embed
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
