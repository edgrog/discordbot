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
  PermissionFlagsBits,
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

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

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  log('info', 'Slash commands registered', { count: commands.length, names: commands.map(c => c.name) });
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
  }
});

// ─── Global Error Handlers ────────────────────────────────────────────────────

process.on('unhandledRejection', (err) => log('error', 'Unhandled rejection', { err: err?.message || String(err) }));
client.on('error', (err) => log('error', 'Discord client error', { err: err.message }));

// ─── Start ────────────────────────────────────────────────────────────────────

client.login(process.env.BOT_TOKEN);
