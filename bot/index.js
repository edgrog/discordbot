// ─────────────────────────────────────────────────────────────────────────────
// GROG PARTNER BOT — Multi-Form Architecture with Dynamic Commands
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
  PermissionFlagsBits,
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const {
  loadFormConfig,
  getFormById,
  getFormByCommand,
  getModalForStep,
  getStepCount,
  getFieldKeysForStep,
  getActiveCommands,
} = require('./lib/dynamic-forms');
const { startSignalPoller } = require('./lib/signal-poller');
const { createHttpApi } = require('./lib/http-api');

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_TTL_MS           = 30 * 60 * 1000;
const SESSION_CLEANUP_INTERVAL = 5  * 60 * 1000;
const EMBED_FIELD_MAX          = 1024;
const HEARTBEAT_INTERVAL       = 60 * 1000;

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
// Sessions track multi-step modal flows: { formId, step, answers, expiresAt }

const sessions = new Map();

function setSession(userId, data) {
  sessions.set(userId, { ...data, expiresAt: Date.now() + SESSION_TTL_MS });
}

function getSession(userId) {
  const s = sessions.get(userId);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { sessions.delete(userId); return null; }
  return s;
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

  // One command per active form
  for (const [cmdName, formId] of getActiveCommands()) {
    const { form } = getFormById(formId);
    commands.push(
      new SlashCommandBuilder()
        .setName(cmdName)
        .setDescription((form.description || `Fill out ${form.name}`).slice(0, 100))
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

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  log('info', 'Slash commands registered', { count: commands.length, names: commands.map(c => c.name) });
}

// ─── Finalize Submission ──────────────────────────────────────────────────────

async function finalizeSubmission(interaction, userId, formId) {
  const session = getSession(userId);
  if (!session) {
    await interaction.reply({ content: 'Your session expired. Please start over.', ephemeral: true });
    return;
  }

  const entry = getFormById(formId);
  if (!entry) {
    await interaction.reply({ content: 'Form not found. Please try again.', ephemeral: true });
    return;
  }

  const { form } = entry;

  // Insert into submissions table
  const { data: submission, error } = await supabase
    .from('submissions')
    .insert({
      form_id: formId,
      discord_id: userId,
      discord_username: interaction.user.tag,
      answers: session.answers,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    log('error', 'Supabase insert failed', { userId, formId, error: error.message });
    await interaction.reply({ content: 'Something went wrong saving your submission. Please try again.', ephemeral: true });
    return;
  }

  log('info', 'Submission created', { submissionId: submission.id, userId, formId, formName: form.name });

  // Build embed with answers
  const answerFields = Object.entries(session.answers).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: truncate(value),
    inline: String(value).length < 50,
  }));

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(`New Submission: ${form.name}`)
    .setDescription(`**/${form.discord_command_name}** by <@${userId}>`)
    .addFields(answerFields.slice(0, 25)) // Discord max 25 fields
    .setFooter({ text: `Submission ID: ${submission.id} | Form: ${form.name}` })
    .setTimestamp();

  // Approve/reject buttons
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`approve_${submission.id}_${userId}_${formId}`).setLabel('Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject_${submission.id}_${userId}_${formId}`).setLabel('Reject').setStyle(ButtonStyle.Danger),
  );

  // Post to admin channel (form.settings.admin_channel_id or env fallback)
  const adminChannelId = form.settings?.admin_channel_id || process.env.ADMIN_CHANNEL_ID;
  const adminChannel = client.channels.cache.get(adminChannelId);
  if (adminChannel) {
    await adminChannel.send({ embeds: [embed], components: [buttons] });
  } else {
    log('error', 'Admin channel not found — submission saved to DB but no card posted', { submissionId: submission.id, adminChannelId });
  }

  clearSession(userId);

  // Confirmation reply
  const confirmMsg = form.settings?.confirmation_message || 'Your submission has been received! We will review it and get back to you soon.';
  await interaction.reply({ content: confirmMsg, ephemeral: true });
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

  // Start signal poller (reload forms + re-register commands on signal)
  startSignalPoller(supabase, async () => {
    await loadFormConfig(supabase, log);
    await registerCommands();
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

  // Start HTTP API
  const port = process.env.BOT_API_PORT || 3001;
  const httpApp = createHttpApi({
    supabase,
    client,
    log,
    reloadForms: async () => {
      await loadFormConfig(supabase, log);
      await registerCommands();
    },
  });
  httpApp.listen(port, () => {
    log('info', `HTTP API listening on port ${port}`);
  });
});

// ─── Interaction Handler ──────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
  const userId = interaction.user.id;

  // ── Slash Commands ────────────────────────────────────────────────────────

  if (interaction.isChatInputCommand()) {
    // Admin reload
    if (interaction.commandName === 'reload-forms') {
      await interaction.deferReply({ ephemeral: true });
      try {
        await loadFormConfig(supabase, log);
        await registerCommands();
        await interaction.editReply({ content: 'Form config reloaded and commands re-registered.' });
      } catch (err) {
        log('error', 'Reload failed', { err: err.message });
        await interaction.editReply({ content: 'Failed to reload form config. Check bot logs.' });
      }
      return;
    }

    // Dynamic form commands
    const formId = getFormByCommand(interaction.commandName);
    if (formId) {
      const totalSteps = getStepCount(formId);
      if (totalSteps === 0) {
        await interaction.reply({ content: 'This form has no steps configured yet.', ephemeral: true });
        return;
      }

      // Create session and show first modal
      setSession(userId, { formId, step: 0, answers: {} });

      const modal = getModalForStep(formId, 0);
      if (!modal) {
        await interaction.reply({ content: 'Form configuration error. Please try again later.', ephemeral: true });
        return;
      }

      await interaction.showModal(modal);
      return;
    }

    return;
  }

  // ── Modal Submissions ─────────────────────────────────────────────────────

  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;

    // Parse customId: form_<formId>_<stepIndex>
    const match = customId.match(/^form_(.+)_(\d+)$/);
    if (!match) return;

    const formId    = match[1];
    const stepIndex = parseInt(match[2]);

    const session = getSession(userId);
    if (!session || session.formId !== formId) {
      await interaction.reply({ content: 'Your session expired. Please start the form again.', ephemeral: true });
      return;
    }

    // Collect field values from this step
    const fieldKeys = getFieldKeysForStep(formId, stepIndex);
    for (const key of fieldKeys) {
      try {
        const value = interaction.fields.getTextInputValue(key);
        if (value !== undefined && value !== null) {
          session.answers[key] = value.trim();
        }
      } catch { /* field might be optional or missing */ }
    }

    // Update session with new step and answers
    const totalSteps = getStepCount(formId);
    const nextStep   = stepIndex + 1;

    if (nextStep < totalSteps) {
      // More steps to go — show next modal
      session.step = nextStep;
      setSession(userId, session);

      const nextModal = getModalForStep(formId, nextStep);
      if (!nextModal) {
        // No modal for next step — finalize
        await finalizeSubmission(interaction, userId, formId);
        return;
      }

      await interaction.showModal(nextModal);
    } else {
      // Last step — finalize
      setSession(userId, session); // save final answers
      await finalizeSubmission(interaction, userId, formId);
    }

    return;
  }

  // ── Approve / Reject Buttons ──────────────────────────────────────────────

  if (interaction.isButton()) {
    const parts = interaction.customId.split('_');
    // Format: approve_<submissionId>_<targetUserId>_<formId>
    // or:     reject_<submissionId>_<targetUserId>_<formId>
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
    } catch (err) {
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
  }
});

// ─── Global Error Handlers ────────────────────────────────────────────────────

process.on('unhandledRejection', (err) => log('error', 'Unhandled rejection', { err: err?.message || String(err) }));
client.on('error', (err) => log('error', 'Discord client error', { err: err.message }));

// ─── Start ────────────────────────────────────────────────────────────────────

client.login(process.env.BOT_TOKEN);
