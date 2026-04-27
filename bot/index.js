// ─────────────────────────────────────────────────────────────────────────────
// FORMIE BOT — Thread-Based Application Flow
// ─────────────────────────────────────────────────────────────────────────────

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');
require('dotenv').config();

const BOT_STATE_FILE = path.join(__dirname, 'bot_state.json');

function readBotState() {
  try {
    if (!fs.existsSync(BOT_STATE_FILE)) return {};
    return JSON.parse(fs.readFileSync(BOT_STATE_FILE, 'utf8'));
  } catch { return {}; }
}

function writeBotState(state) {
  try { fs.writeFileSync(BOT_STATE_FILE, JSON.stringify(state, null, 2)); }
  catch (err) { console.error('bot_state write failed', err.message); }
}

function truncateField(str, max = 1024) {
  if (!str) return '—';
  const s = String(str).trim();
  if (!s) return '—';
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

const {
  loadFormConfig,
  getFormById,
  getFormByCommand,
  getStepCount,
  getActiveCommands,
  getAllActiveForms,
} = require('./lib/dynamic-forms');
const { startSignalPoller } = require('./lib/signal-poller');
const { createHttpApi } = require('./lib/http-api');
const {
  postApplyEmbed,
  startThreadSession,
  handleThreadMessage,
  handleThreadButton,
  runSessionCleanup,
} = require('./lib/thread-handler');

// ─── Constants ────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL       = 60 * 1000;
const SESSION_CLEANUP_INTERVAL = 15 * 60 * 1000;

// ─── Env Validation ───────────────────────────────────────────────────────────

(function validateEnv() {
  const required = ['BOT_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ADMIN_CHANNEL_ID'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length) { console.error(`Missing required env vars: ${missing.join(', ')}`); process.exit(1); }

  if (!process.env.BOT_API_SECRET) console.warn('BOT_API_SECRET not set — HTTP API will reject all requests');
  console.log('Environment validated');
})();

// ─── Clients ──────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level, msg, meta = {}) {
  const ts      = new Date().toISOString();
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  const fn      = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  console[fn](`[${ts}] [${level.toUpperCase()}] ${msg}${metaStr}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function alertAdmin(message) {
  try {
    const ch = client.channels.cache.get(process.env.ADMIN_CHANNEL_ID);
    if (ch) await ch.send(message);
  } catch (err) { log('error', 'Failed to send admin alert', { err: err.message }); }
}

// ─── Command Registration ─────────────────────────────────────────────────────

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

  const commands = [];

  // One command per active form (alias entry point — also creates thread)
  for (const [cmdName, formId] of getActiveCommands()) {
    const { form } = getFormById(formId);
    commands.push(
      new SlashCommandBuilder()
        .setName(cmdName)
        .setDescription((form.description || `Apply for ${form.name}`).slice(0, 100))
        .toJSON()
    );
  }

  // Admin reload command
  commands.push(
    new SlashCommandBuilder()
      .setName('reload-forms')
      .setDescription('Reload form config from database (admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .toJSON()
  );

  // /legend — manual Grog Legend assignment (admins only)
  commands.push(
    new SlashCommandBuilder()
      .setName('legend')
      .setDescription('Crown a member as a Grog Legend 👑')
      .addUserOption(opt => opt.setName('user').setDescription('Member to crown').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .toJSON()
  );

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  log('info', 'Slash commands registered', { count: commands.length, names: commands.map(c => c.name) });
}

// ─── Store Request Embed (persistent) ────────────────────────────────────────

function buildStoreRequestPayload() {
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('📍 Get Grog In Your Area')
    .setDescription("Don't see Grog at your local? Tell us where to go next.\nClick below to submit a store request.");
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('store_request_open').setLabel('📍 Request a Store').setStyle(ButtonStyle.Primary),
  );
  return { embeds: [embed], components: [row] };
}

function buildStoreRequestModal() {
  return new ModalBuilder().setCustomId('store_request_modal').setTitle('📍 Request a Grog Store').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('store_name').setLabel('Store name').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('store_address').setLabel('Store address / suburb').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('visit_frequency').setLabel('How often do you shop there?').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Weekly / Monthly / Occasionally')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('notes').setLabel('Any extra info? (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false)),
  );
}

async function ensureStoreRequestEmbed() {
  const channelId = process.env.STORE_REQUEST_CHANNEL_ID;
  if (!channelId) { log('warn', 'STORE_REQUEST_CHANNEL_ID not set — skipping store request embed'); return; }

  let channel;
  try { channel = await client.channels.fetch(channelId); }
  catch (err) { log('error', 'Store request channel fetch failed', { channelId, err: err.message }); return; }
  if (!channel) return;

  const state = readBotState();
  if (state.storeRequestMessageId) {
    try {
      await channel.messages.fetch(state.storeRequestMessageId);
      log('info', 'Store request embed already posted', { messageId: state.storeRequestMessageId });
      return;
    } catch {
      log('warn', 'Stored store-request message not found, reposting');
    }
  }

  try {
    const msg = await channel.send(buildStoreRequestPayload());
    writeBotState({ ...state, storeRequestMessageId: msg.id });
    log('info', 'Store request embed posted', { messageId: msg.id });
  } catch (err) {
    log('error', 'Failed to post store request embed', { err: err.message });
  }
}

// ─── New Member: auto-role + welcome DM ──────────────────────────────────────

async function handleGuildMemberAdd(member) {
  const fanRoleId = process.env.ROLE_FAN;
  if (fanRoleId) {
    try {
      await member.roles.add(fanRoleId);
      log('info', 'Grog Fan role assigned', { userId: member.id });
    } catch (err) {
      log('error', 'Failed to assign Grog Fan role', { userId: member.id, err: err.message, code: err.code });
    }
  } else {
    log('warn', 'ROLE_FAN not set — skipping auto-role on join');
  }

  const username = member.user.username;
  const dm = `Hey ${username} 👋\n\nWelcome to the Grog Discord — the official home of the hardest Japanese soda 🍋\n\nHere's how it works:\n\n🎥 Creator, artist, bar, or club? Hit #get-partner and apply for a partner role.\n📍 Don't see Grog near you? Drop a store request in #get-grog-local.\n📸 Post your Grog pics and vids in #grog-spotted — best ones get featured.\n\nGlad you're here.\n— The Grog Crew`;
  try { await member.send(dm); }
  catch { log('info', 'Welcome DM not delivered (DMs likely closed)', { userId: member.id }); }
}

// ─── Post Apply Embeds for All Active Forms ──────────────────────────────────

async function postAllApplyEmbeds() {
  const activeForms = getAllActiveForms();
  for (const { form } of activeForms) {
    if (form.settings?.apply_channel_id) {
      try {
        await postApplyEmbed(client, supabase, form, log);
      } catch (err) {
        log('error', 'Failed to post apply embed', { formId: form.id, err: err.message });
      }
    }
  }
}

// ─── Bot Ready ────────────────────────────────────────────────────────────────

client.once('ready', async () => {
  log('info', `Bot online as ${client.user.tag}`);

  // Load dynamic forms
  await loadFormConfig(supabase, log);

  // Register commands dynamically
  try {
    await registerCommands();
  } catch (err) {
    log('error', 'Command registration failed', { err: err.message });
  }

  // Post apply embeds for forms with configured channels
  await postAllApplyEmbeds();

  // Post the persistent Store Request embed
  await ensureStoreRequestEmbed();

  // Start signal poller (reload forms + re-register commands on signal)
  startSignalPoller(supabase, async () => {
    await loadFormConfig(supabase, log);
    await registerCommands();
    await postAllApplyEmbeds();
  }, log);

  // Start heartbeat
  async function heartbeat() {
    await supabase
      .from('settings')
      .upsert({ key: 'bot_heartbeat', value: new Date().toISOString() })
      .then();
  }
  heartbeat();
  setInterval(heartbeat, HEARTBEAT_INTERVAL);

  // Session cleanup (expired threads)
  setInterval(() => runSessionCleanup(supabase, client, log), SESSION_CLEANUP_INTERVAL);

  // Start HTTP API
  const port = process.env.BOT_API_PORT || 3001;
  const httpApp = createHttpApi({
    supabase,
    client,
    log,
    reloadForms: async () => {
      await loadFormConfig(supabase, log);
      await registerCommands();
      await postAllApplyEmbeds();
    },
  });
  httpApp.listen(port, () => {
    log('info', `HTTP API listening on port ${port}`);
  });
});

// ─── New Members ─────────────────────────────────────────────────────────────

client.on('guildMemberAdd', async (member) => {
  try { await handleGuildMemberAdd(member); }
  catch (err) { log('error', 'guildMemberAdd handler error', { err: err.message, userId: member.id }); }
});

// ─── Message Handler (text answers in threads) ───────────────────────────────

client.on('messageCreate', async (message) => {
  try {
    await handleThreadMessage(message, supabase, log);
  } catch (err) {
    log('error', 'Thread message handler error', { err: err.message, threadId: message.channel?.id });
  }
});

// ─── Interaction Handler ──────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {

  // ── Slash Commands ────────────────────────────────────────────────────────

  if (interaction.isChatInputCommand()) {
    // /legend — manual Grog Legend assignment
    if (interaction.commandName === 'legend') {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command must be used in the server.', ephemeral: true });
        return;
      }
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
        return;
      }

      const legendRoleId = process.env.ROLE_LEGEND;
      if (!legendRoleId) {
        await interaction.reply({ content: '`ROLE_LEGEND` is not configured. Set it in env and restart the bot.', ephemeral: true });
        return;
      }

      const target = interaction.options.getUser('user', true);
      try {
        const member = await interaction.guild.members.fetch(target.id);
        await member.roles.add(legendRoleId);
        log('info', 'Grog Legend role assigned', { targetUserId: target.id, by: interaction.user.tag });
      } catch (err) {
        const hint = err.code === 50013
          ? 'Bot role must be **above** the Grog Legend role in Server Settings → Roles.'
          : err.message;
        log('error', 'Legend role assignment failed', { err: err.message, code: err.code });
        await interaction.reply({ content: `Couldn't assign the role — ${hint}`, ephemeral: true });
        return;
      }

      try { await target.send("You've been crowned a Grog Legend 👑 Welcome to #legends-lounge."); }
      catch { log('info', 'Legend DM not delivered (DMs likely closed)', { targetUserId: target.id }); }

      await interaction.reply({ content: `Done — <@${target.id}> is now a Grog Legend.`, ephemeral: true });
      return;
    }

    // Admin reload
    if (interaction.commandName === 'reload-forms') {
      await interaction.deferReply({ ephemeral: true });
      try {
        await loadFormConfig(supabase, log);
        await registerCommands();
        await postAllApplyEmbeds();
        await interaction.editReply({ content: 'Form config reloaded and commands re-registered.' });
      } catch (err) {
        log('error', 'Reload failed', { err: err.message });
        await interaction.editReply({ content: 'Failed to reload form config. Check bot logs.' });
      }
      return;
    }

    // Dynamic form commands → create thread
    const formId = getFormByCommand(interaction.commandName);
    if (formId) {
      const totalSteps = getStepCount(formId);
      if (totalSteps === 0) {
        await interaction.reply({ content: 'This form has no steps configured yet.', ephemeral: true });
        return;
      }

      await startThreadSession(interaction, formId, supabase, client, log);
      return;
    }

    return;
  }

  // ── Buttons ───────────────────────────────────────────────────────────────

  if (interaction.isButton()) {
    // Store-request entry button
    if (interaction.customId === 'store_request_open') {
      try { await interaction.showModal(buildStoreRequestModal()); }
      catch (err) { log('error', 'Failed to show store request modal', { err: err.message }); }
      return;
    }

    const prefix = interaction.customId.split('_')[0];

    // Thread-related buttons
    if (['applystart', 'tsel', 'tmsel', 'tmseldone', 'tedit', 'tconfirm'].includes(prefix)) {
      try {
        await handleThreadButton(interaction, supabase, log);
      } catch (err) {
        log('error', 'Thread button handler error', { err: err.message, customId: interaction.customId });
      }
      return;
    }

    // ── Approve / Reject Buttons (admin review) ─────────────────────────────

    const parts = interaction.customId.split('_');
    const action       = parts[0];
    const submissionId = parts[1];
    const targetUserId = parts[2];
    const formId       = parts[3];

    if (action !== 'approve' && action !== 'reject') return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: 'You do not have permission to review submissions.', ephemeral: true });
      return;
    }

    // Race condition guard
    const { data: currentSub, error: fetchErr } = await supabase
      .from('submissions')
      .select('id, status, form_id, discord_id')
      .eq('id', submissionId)
      .single();

    if (fetchErr || !currentSub) {
      log('error', 'Could not fetch submission for review', { submissionId, err: fetchErr?.message });
      await interaction.reply({ content: 'Could not find that submission in the database.', ephemeral: true });
      return;
    }

    if (currentSub.status !== 'pending') {
      await interaction.reply({
        content: `This submission was already **${currentSub.status}**. No changes made.`,
        ephemeral: true,
      });
      return;
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { error: updateErr } = await supabase
      .from('submissions')
      .update({ status: newStatus, reviewed_by: interaction.user.tag })
      .eq('id', submissionId);

    if (updateErr) {
      log('error', 'Supabase update failed on review', { submissionId, err: updateErr.message });
      await interaction.reply({ content: 'Database update failed. Try again.', ephemeral: true });
      return;
    }

    log('info', `Submission ${newStatus}`, { submissionId, reviewer: interaction.user.tag, targetUserId });

    // Load form settings for role and DM templates
    const entry = getFormById(formId || currentSub.form_id);
    const formSettings = entry?.form?.settings || {};

    // Role assignment (approve only)
    if (action === 'approve') {
      const roleId = formSettings.role_id || process.env.PARTNER_ROLE_ID;
      if (!roleId) {
        log('warn', 'No role ID configured for form', { formId: formId || currentSub.form_id });
        await alertAdmin(`Warning: Role not assigned for <@${targetUserId}> (Submission \`${submissionId}\`) — no role_id configured. Please assign manually.`);
      } else {
        try {
          const member = await interaction.guild.members.fetch(targetUserId);
          await member.roles.add(roleId);
          log('info', 'Role assigned', { userId: targetUserId, roleId });
        } catch (err) {
          const hint = err.code === 50013
            ? 'Bot role must be above the target role in Server Settings > Roles.'
            : err.message;
          log('error', 'Role assignment failed', { err: err.message, code: err.code });
          await alertAdmin(`Warning: Role assignment failed for <@${targetUserId}> (Submission \`${submissionId}\`) — ${hint}. Please assign manually.`);
        }
      }
    }

    // DM the applicant
    let dmSent = true;
    try {
      const targetUser = await client.users.fetch(targetUserId);
      const dmMessage = action === 'approve'
        ? (formSettings.dm_approve_message || 'Your submission has been approved! Welcome aboard.')
        : (formSettings.dm_reject_message || 'Thank you for your submission. Unfortunately, we are not moving forward at this time.');
      await targetUser.send(dmMessage);
    } catch {
      dmSent = false;
      log('warn', 'Could not DM applicant — DMs likely closed', { targetUserId });
      await alertAdmin(`Could not DM <@${targetUserId}> after **${newStatus}** (Submission \`${submissionId}\`) — they may have DMs closed.`);
    }

    // Update dm_sent
    await supabase
      .from('submissions')
      .update({ dm_sent: dmSent })
      .eq('id', submissionId);

    // Update the embed
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(action === 'approve' ? 0x00C853 : 0xD50000)
      .setFooter({ text: `${action === 'approve' ? 'APPROVED' : 'REJECTED'} by ${interaction.user.tag} | Submission ID: ${submissionId}` });

    await interaction.update({ embeds: [updatedEmbed], components: [] });
    return;
  }

  // ── Modal Submissions ─────────────────────────────────────────────────────

  if (interaction.isModalSubmit() && interaction.customId === 'store_request_modal') {
    const userId         = interaction.user.id;
    const storeName      = interaction.fields.getTextInputValue('store_name').trim();
    const storeAddress   = interaction.fields.getTextInputValue('store_address').trim();
    const visitFrequency = interaction.fields.getTextInputValue('visit_frequency').trim();
    const notes          = (interaction.fields.getTextInputValue('notes') || '').trim();

    const { data: row, error } = await supabase
      .from('store_requests')
      .insert([{
        discord_id:       userId,
        discord_username: interaction.user.tag,
        store_name:       storeName,
        store_address:    storeAddress,
        visit_frequency:  visitFrequency,
        notes:            notes || null,
      }])
      .select()
      .single();

    if (error) {
      log('error', 'store_requests insert failed', { userId, err: error.message });
      await interaction.reply({ content: "Couldn't save your store request. Try again in a sec.", ephemeral: true });
      return;
    }

    const scoutRoleId = process.env.ROLE_SCOUT;
    if (scoutRoleId && interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(userId);
        await member.roles.add(scoutRoleId);
        log('info', 'Grog Scout role assigned', { userId });
      } catch (err) {
        log('error', 'Scout role assignment failed', { userId, err: err.message, code: err.code });
        await alertAdmin(`Warning: Scout role not assigned for <@${userId}> (Store request \`${row.id}\`) — ${err.message}`);
      }
    } else if (!scoutRoleId) {
      log('warn', 'ROLE_SCOUT not set — skipping role assignment');
    }

    const adminChannelId = process.env.STORE_ADMIN_CHANNEL_ID;
    if (adminChannelId) {
      try {
        const adminChannel = await client.channels.fetch(adminChannelId);
        if (adminChannel) {
          const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('📍 New Store Request')
            .addFields(
              { name: '🏪 Store',     value: truncateField(storeName),      inline: true },
              { name: '📍 Address',   value: truncateField(storeAddress),   inline: true },
              { name: '🔁 Frequency', value: truncateField(visitFrequency), inline: true },
              { name: '🏷️ Discord',  value: `<@${userId}>`,                inline: true },
              { name: '📝 Notes',     value: truncateField(notes) },
            )
            .setFooter({ text: `Request ID: ${row.id}` })
            .setTimestamp();
          await adminChannel.send({ embeds: [embed] });
        }
      } catch (err) {
        log('error', 'Failed to post store request admin embed', { err: err.message });
      }
    }

    await interaction.reply({ content: "Nice one 🍋 We'll check it out. You're officially a Grog Scout.", ephemeral: true });
    return;
  }
});

// ─── Global Error Handlers ────────────────────────────────────────────────────

process.on('unhandledRejection', (err) => log('error', 'Unhandled rejection', { err: err?.message || String(err) }));
client.on('error', (err) => log('error', 'Discord client error', { err: err.message }));

// ─── Start ────────────────────────────────────────────────────────────────────

client.login(process.env.BOT_TOKEN);
