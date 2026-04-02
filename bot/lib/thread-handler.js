// ─────────────────────────────────────────────────────────────────────────────
// Thread-Based Application Flow — Private thread conversations for form filling
// ─────────────────────────────────────────────────────────────────────────────

const {
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const {
  getFormById,
  getFlattenedFields,
  resolveNextStep,
} = require('./dynamic-forms');

// ─── In-Memory Session Cache (LRU-ish) ──────────────────────────────────────
// Avoids hitting Supabase on every messageCreate event.
// Max 500 entries, evict oldest on overflow.

const sessionCache = new Map();
const MAX_CACHE = 500;

function cacheSession(threadId, session) {
  if (sessionCache.size >= MAX_CACHE) {
    const oldest = sessionCache.keys().next().value;
    sessionCache.delete(oldest);
  }
  sessionCache.set(threadId, session);
}

function uncacheSession(threadId) {
  sessionCache.delete(threadId);
}

// ─── Post Apply Embed ────────────────────────────────────────────────────────

async function postApplyEmbed(client, supabase, form, log) {
  const channelId = form.settings?.apply_channel_id;
  if (!channelId) {
    log('warn', 'No apply_channel_id configured for form', { formId: form.id, formName: form.name });
    return;
  }

  const channel = client.channels.cache.get(channelId);
  if (!channel) {
    log('error', 'Apply channel not found', { channelId, formId: form.id });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(form.name || 'Apply Now')
    .setDescription(form.description || 'Click the button below to start your application.')
    .setFooter({ text: 'Powered by Formie' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`applystart_${form.id}`)
      .setLabel('Apply Now')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📝')
  );

  // Check if we already have a message posted
  const existingMessageId = form.settings?.apply_message_id;
  if (existingMessageId) {
    try {
      const existing = await channel.messages.fetch(existingMessageId);
      await existing.edit({ embeds: [embed], components: [row] });
      log('info', 'Updated existing apply embed', { formId: form.id, messageId: existingMessageId });
      return;
    } catch {
      // Message was deleted or not found, post a new one
    }
  }

  const msg = await channel.send({ embeds: [embed], components: [row] });

  // Store message ID in form settings
  const newSettings = { ...(form.settings || {}), apply_message_id: msg.id };
  await supabase
    .from('forms')
    .update({ settings: newSettings })
    .eq('id', form.id);

  log('info', 'Posted apply embed', { formId: form.id, messageId: msg.id, channelId });
}

// ─── Start Thread Session ────────────────────────────────────────────────────

async function startThreadSession(interaction, formId, supabase, client, log) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  // Check for existing active session
  const { data: existing } = await supabase
    .from('application_sessions')
    .select('id, thread_id')
    .eq('discord_id', userId)
    .eq('form_id', formId)
    .in('status', ['in_progress', 'confirming'])
    .limit(1);

  if (existing && existing.length > 0) {
    await interaction.reply({
      content: `You already have an active application in <#${existing[0].thread_id}>. Please complete or abandon it first.`,
      ephemeral: true,
    });
    return;
  }

  const entry = getFormById(formId);
  if (!entry) {
    await interaction.reply({ content: 'Form not found. Please try again later.', ephemeral: true });
    return;
  }

  const fields = getFlattenedFields(formId);
  if (fields.length === 0) {
    await interaction.reply({ content: 'This form has no questions configured yet.', ephemeral: true });
    return;
  }

  // Create private thread
  const channel = interaction.channel;
  let thread;
  try {
    thread = await channel.threads.create({
      name: `${interaction.user.displayName}'s Application`,
      type: ChannelType.PrivateThread,
      autoArchiveDuration: 1440, // 24 hours
      reason: `Application for ${entry.form.name} by ${interaction.user.tag}`,
    });
  } catch (err) {
    log('error', 'Failed to create private thread', { err: err.message, userId, formId });
    await interaction.reply({
      content: 'Failed to create a private thread. Make sure this server has Boost Level 2 for private threads.',
      ephemeral: true,
    });
    return;
  }

  // Add user to thread
  await thread.members.add(userId);

  // Insert session
  const { error: insertErr } = await supabase
    .from('application_sessions')
    .insert({
      thread_id: thread.id,
      form_id: formId,
      discord_id: userId,
      guild_id: guildId,
      current_step: 0,
      current_field: 0,
      answers: {},
      status: 'in_progress',
    });

  if (insertErr) {
    log('error', 'Failed to create session', { err: insertErr.message, userId, formId });
    await interaction.reply({ content: 'Something went wrong. Please try again.', ephemeral: true });
    return;
  }

  // Reply in the main channel (ephemeral)
  await interaction.reply({
    content: `Your private application thread has been created! Head over to <#${thread.id}> 👀`,
    ephemeral: true,
  });

  // Welcome message in thread
  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`${entry.form.name}`)
    .setDescription(
      `Welcome! I'll walk you through the application step by step.\n\n` +
      `Answer each question as it comes — take your time. Your progress is saved automatically.\n\n` +
      `Let's get started! 👇`
    );

  await thread.send({ embeds: [welcomeEmbed] });

  // Ask first question
  await askNextQuestion(thread.id, supabase, client, log);
}

// ─── Ask Next Question ───────────────────────────────────────────────────────

async function askNextQuestion(threadId, supabase, client, log) {
  // Load session
  let session = sessionCache.get(threadId);
  if (!session) {
    const { data, error } = await supabase
      .from('application_sessions')
      .select('*')
      .eq('thread_id', threadId)
      .single();

    if (error || !data) {
      log('error', 'Session not found for thread', { threadId });
      return;
    }
    session = data;
  }

  if (session.status !== 'in_progress') return;

  const allFields = getFlattenedFields(session.form_id);
  if (allFields.length === 0) return;

  // Find current position in flattened fields
  // We track by step index + field index
  let currentIdx = allFields.findIndex(
    f => f.stepIndex === session.current_step && f.fieldIndex === session.current_field
  );

  // If not found (e.g. step was deleted), try to find next valid position
  if (currentIdx === -1) {
    currentIdx = allFields.findIndex(f => f.stepIndex >= session.current_step);
    if (currentIdx === -1) {
      // No more questions — go to confirmation
      await showConfirmation(threadId, supabase, client, log);
      return;
    }
  }

  const { field, stepTitle, stepIndex, fieldIndex } = allFields[currentIdx];

  // Update session position
  session.current_step = stepIndex;
  session.current_field = fieldIndex;
  cacheSession(threadId, session);

  const thread = await client.channels.fetch(threadId);
  if (!thread) return;

  // Show step title as section header if this is the first field in a new step
  const prevField = currentIdx > 0 ? allFields[currentIdx - 1] : null;
  if (!prevField || prevField.stepIndex !== stepIndex) {
    if (stepTitle) {
      await thread.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle(`📋 ${stepTitle}`)
        ],
      });
    }
  }

  // Build question based on field type
  const questionEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setDescription(`**${field.label}**${field.required ? ' *' : ''}`)
    .setFooter({ text: `Question ${currentIdx + 1} of ${allFields.length}` });

  if (field.type === 'short' || field.type === 'paragraph') {
    if (field.placeholder) {
      questionEmbed.setDescription(
        `**${field.label}**${field.required ? ' *' : ''}\n\n` +
        `_${field.placeholder}_`
      );
    }
    questionEmbed.setDescription(
      questionEmbed.data.description + '\n\n(Type your answer below 👇)'
    );
    await thread.send({ embeds: [questionEmbed] });

  } else if (field.type === 'singleselect') {
    const options = field.options || [];
    const rows = buildButtonRows(options, threadId, field.key, 'tsel', []);
    await thread.send({ embeds: [questionEmbed], components: rows });

  } else if (field.type === 'multiselect') {
    // Reset pending multiselect
    session.pending_multiselect = [];
    cacheSession(threadId, session);
    await supabase
      .from('application_sessions')
      .update({ pending_multiselect: [], updated_at: new Date().toISOString() })
      .eq('thread_id', threadId);

    questionEmbed.setDescription(
      questionEmbed.data.description + '\n\nSelect everything that applies, then hit **Done →**'
    );

    const options = field.options || [];
    const rows = buildButtonRows(options, threadId, field.key, 'tmsel', []);
    // Add Done button
    const doneRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tmseldone_${threadId}_${field.key}`)
        .setLabel('Done →')
        .setStyle(ButtonStyle.Success)
    );
    rows.push(doneRow);

    await thread.send({ embeds: [questionEmbed], components: rows });
  }
}

// ─── Build Button Rows ───────────────────────────────────────────────────────

function buildButtonRows(options, threadId, fieldKey, prefix, selectedValues) {
  const rows = [];
  let currentRow = new ActionRowBuilder();

  for (let i = 0; i < options.length && i < 20; i++) {
    const opt = options[i];
    const isSelected = selectedValues.includes(opt.value);

    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`${prefix}_${threadId}_${fieldKey}_${opt.value}`)
        .setLabel(opt.label.slice(0, 80))
        .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    // Max 5 buttons per row
    if ((i + 1) % 5 === 0 || i === options.length - 1) {
      rows.push(currentRow);
      if (i < options.length - 1) {
        currentRow = new ActionRowBuilder();
      }
    }
  }

  // Max 4 rows for options (5th reserved for Done button in multiselect)
  return rows.slice(0, 4);
}

// ─── Handle Text Message in Thread ───────────────────────────────────────────

async function handleThreadMessage(message, supabase, log) {
  if (message.author.bot) return;
  if (!message.channel.isThread()) return;

  const threadId = message.channel.id;

  // Check cache first
  let session = sessionCache.get(threadId);
  if (!session) {
    const { data } = await supabase
      .from('application_sessions')
      .select('*')
      .eq('thread_id', threadId)
      .eq('status', 'in_progress')
      .single();

    if (!data) return; // Not an active application thread
    session = data;
  }

  if (session.status !== 'in_progress') return;
  if (session.discord_id !== message.author.id) return; // Only the applicant can answer

  // Get current field
  const allFields = getFlattenedFields(session.form_id);
  const currentIdx = allFields.findIndex(
    f => f.stepIndex === session.current_step && f.fieldIndex === session.current_field
  );
  if (currentIdx === -1) return;

  const { field } = allFields[currentIdx];

  // Only accept text messages for text fields
  if (field.type !== 'short' && field.type !== 'paragraph') return;

  const answer = message.content.trim();
  if (!answer && field.required) {
    await message.reply({ content: 'This question requires an answer. Please type your response.' });
    return;
  }

  // Store answer and advance
  session.answers[field.key] = answer;

  // Find next field
  const nextIdx = currentIdx + 1;
  if (nextIdx < allFields.length) {
    const next = allFields[nextIdx];

    // Check if we're crossing into a new step — handle branching
    if (next.stepIndex !== session.current_step) {
      // Check if current step has branching (via singleselect field)
      const branchResult = checkBranching(allFields, currentIdx, session);
      if (branchResult !== null) {
        session.current_step = branchResult.stepIndex;
        session.current_field = branchResult.fieldIndex;
      } else {
        session.current_step = next.stepIndex;
        session.current_field = next.fieldIndex;
      }
    } else {
      session.current_step = next.stepIndex;
      session.current_field = next.fieldIndex;
    }
  } else {
    // No more fields — will trigger confirmation
    session.current_step = 999;
    session.current_field = 0;
  }

  // Save to DB
  cacheSession(threadId, session);
  await supabase
    .from('application_sessions')
    .update({
      answers: session.answers,
      current_step: session.current_step,
      current_field: session.current_field,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('thread_id', threadId);

  // React to confirm receipt
  try { await message.react('✅'); } catch {}

  // Ask next question
  await askNextQuestion(threadId, supabase, message.client, log);
}

// ─── Handle Button Interactions in Thread ────────────────────────────────────

async function handleThreadButton(interaction, supabase, log) {
  const customId = interaction.customId;
  const parts = customId.split('_');
  const prefix = parts[0];

  // ── Apply Start ────────────────────────────────────────────────────────
  if (prefix === 'applystart') {
    const formId = parts[1];
    await startThreadSession(interaction, formId, supabase, interaction.client, log);
    return;
  }

  // ── Single Select ──────────────────────────────────────────────────────
  if (prefix === 'tsel') {
    const threadId = parts[1];
    const fieldKey = parts[2];
    const optionValue = parts.slice(3).join('_'); // value might contain underscores

    let session = sessionCache.get(threadId);
    if (!session) {
      const { data } = await supabase
        .from('application_sessions')
        .select('*')
        .eq('thread_id', threadId)
        .single();
      if (!data) return;
      session = data;
    }

    // Record answer
    session.answers[fieldKey] = optionValue;

    // Disable buttons on the message
    await interaction.update({
      components: interaction.message.components.map(row =>
        ActionRowBuilder.from(row).setComponents(
          row.components.map(btn => {
            const b = ButtonBuilder.from(btn);
            if (btn.customId?.includes(`_${optionValue}`)) {
              b.setStyle(ButtonStyle.Success);
            }
            return b.setDisabled(true);
          })
        )
      ),
    });

    // Check branching
    const allFields = getFlattenedFields(session.form_id);
    const currentIdx = allFields.findIndex(
      f => f.stepIndex === session.current_step && f.fieldIndex === session.current_field
    );
    const currentField = currentIdx >= 0 ? allFields[currentIdx].field : null;

    let nextStepIndex = null;
    if (currentField?.branching && currentField.options) {
      const chosen = currentField.options.find(o => o.value === optionValue);
      if (chosen?.next_step !== null && chosen?.next_step !== undefined) {
        nextStepIndex = chosen.next_step;
      }
    }

    // Advance to next field
    if (nextStepIndex !== null && nextStepIndex !== undefined) {
      // Branch to specific step
      if (nextStepIndex === -1) {
        // End form
        session.current_step = 999;
        session.current_field = 0;
      } else {
        // Find first field in target step
        const targetField = allFields.find(f => f.stepIndex === nextStepIndex);
        if (targetField) {
          session.current_step = targetField.stepIndex;
          session.current_field = targetField.fieldIndex;
        } else {
          session.current_step = 999;
          session.current_field = 0;
        }
      }
    } else {
      // Sequential: next field
      const nextIdx = currentIdx + 1;
      if (nextIdx < allFields.length) {
        session.current_step = allFields[nextIdx].stepIndex;
        session.current_field = allFields[nextIdx].fieldIndex;
      } else {
        session.current_step = 999;
        session.current_field = 0;
      }
    }

    cacheSession(threadId, session);
    await supabase
      .from('application_sessions')
      .update({
        answers: session.answers,
        current_step: session.current_step,
        current_field: session.current_field,
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('thread_id', threadId);

    await askNextQuestion(threadId, supabase, interaction.client, log);
    return;
  }

  // ── Multi Select Toggle ────────────────────────────────────────────────
  if (prefix === 'tmsel') {
    const threadId = parts[1];
    const fieldKey = parts[2];
    const optionValue = parts.slice(3).join('_');

    let session = sessionCache.get(threadId);
    if (!session) {
      const { data } = await supabase
        .from('application_sessions')
        .select('*')
        .eq('thread_id', threadId)
        .single();
      if (!data) return;
      session = data;
    }

    // Toggle value in pending_multiselect
    const pending = session.pending_multiselect || [];
    const idx = pending.indexOf(optionValue);
    if (idx >= 0) {
      pending.splice(idx, 1);
    } else {
      pending.push(optionValue);
    }
    session.pending_multiselect = pending;

    cacheSession(threadId, session);
    await supabase
      .from('application_sessions')
      .update({
        pending_multiselect: pending,
        updated_at: new Date().toISOString(),
      })
      .eq('thread_id', threadId);

    // Re-render buttons with updated toggle state
    const allFields = getFlattenedFields(session.form_id);
    const currentField = allFields.find(
      f => f.stepIndex === session.current_step && f.fieldIndex === session.current_field
    );
    if (!currentField) return;

    const options = currentField.field.options || [];
    const rows = buildButtonRows(options, threadId, fieldKey, 'tmsel', pending);
    const doneRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tmseldone_${threadId}_${fieldKey}`)
        .setLabel('Done →')
        .setStyle(ButtonStyle.Success)
    );
    rows.push(doneRow);

    await interaction.update({ components: rows });
    return;
  }

  // ── Multi Select Done ──────────────────────────────────────────────────
  if (prefix === 'tmseldone') {
    const threadId = parts[1];
    const fieldKey = parts[2];

    let session = sessionCache.get(threadId);
    if (!session) {
      const { data } = await supabase
        .from('application_sessions')
        .select('*')
        .eq('thread_id', threadId)
        .single();
      if (!data) return;
      session = data;
    }

    const selected = session.pending_multiselect || [];
    session.answers[fieldKey] = selected.join(', ');
    session.pending_multiselect = null;

    // Disable all buttons
    await interaction.update({
      components: interaction.message.components.map(row =>
        ActionRowBuilder.from(row).setComponents(
          row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
        )
      ),
    });

    // Advance
    const allFields = getFlattenedFields(session.form_id);
    const currentIdx = allFields.findIndex(
      f => f.stepIndex === session.current_step && f.fieldIndex === session.current_field
    );
    const nextIdx = currentIdx + 1;
    if (nextIdx < allFields.length) {
      session.current_step = allFields[nextIdx].stepIndex;
      session.current_field = allFields[nextIdx].fieldIndex;
    } else {
      session.current_step = 999;
      session.current_field = 0;
    }

    cacheSession(threadId, session);
    await supabase
      .from('application_sessions')
      .update({
        answers: session.answers,
        pending_multiselect: null,
        current_step: session.current_step,
        current_field: session.current_field,
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('thread_id', threadId);

    await askNextQuestion(threadId, supabase, interaction.client, log);
    return;
  }

  // ── Edit (from confirmation) ───────────────────────────────────────────
  if (prefix === 'tedit') {
    const threadId = parts[1];
    const targetStep = parseInt(parts[2]);
    const targetField = parseInt(parts[3]);

    let session = sessionCache.get(threadId);
    if (!session) {
      const { data } = await supabase
        .from('application_sessions')
        .select('*')
        .eq('thread_id', threadId)
        .single();
      if (!data) return;
      session = data;
    }

    session.current_step = targetStep;
    session.current_field = targetField;
    session.status = 'in_progress';

    cacheSession(threadId, session);
    await supabase
      .from('application_sessions')
      .update({
        current_step: targetStep,
        current_field: targetField,
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('thread_id', threadId);

    await interaction.update({
      components: interaction.message.components.map(row =>
        ActionRowBuilder.from(row).setComponents(
          row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
        )
      ),
    });

    await askNextQuestion(threadId, supabase, interaction.client, log);
    return;
  }

  // ── Confirm ────────────────────────────────────────────────────────────
  if (prefix === 'tconfirm') {
    const threadId = parts[1];
    await interaction.update({
      components: interaction.message.components.map(row =>
        ActionRowBuilder.from(row).setComponents(
          row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
        )
      ),
    });
    await finalizeThreadSubmission(threadId, supabase, interaction.client, log);
    return;
  }
}

// ─── Show Confirmation ───────────────────────────────────────────────────────

async function showConfirmation(threadId, supabase, client, log) {
  let session = sessionCache.get(threadId);
  if (!session) {
    const { data } = await supabase
      .from('application_sessions')
      .select('*')
      .eq('thread_id', threadId)
      .single();
    if (!data) return;
    session = data;
  }

  session.status = 'confirming';
  cacheSession(threadId, session);
  await supabase
    .from('application_sessions')
    .update({ status: 'confirming', updated_at: new Date().toISOString() })
    .eq('thread_id', threadId);

  const allFields = getFlattenedFields(session.form_id);
  const thread = await client.channels.fetch(threadId);
  if (!thread) return;

  // Build summary
  const summaryLines = allFields.map(({ field }) => {
    const answer = session.answers[field.key] || '_Not answered_';
    return `**${field.label}**\n${answer}`;
  });

  const summaryEmbed = new EmbedBuilder()
    .setColor(0x00C853)
    .setTitle('📋 Review Your Application')
    .setDescription(
      summaryLines.join('\n\n') +
      '\n\n---\n\nLook good? Hit **Confirm** to submit, or **Edit** to change an answer.'
    );

  // Build edit buttons (one per field, max 20 to fit in 4 rows)
  const editRows = [];
  let currentRow = new ActionRowBuilder();
  const fieldsToShow = allFields.slice(0, 20);

  for (let i = 0; i < fieldsToShow.length; i++) {
    const { stepIndex, fieldIndex, field } = fieldsToShow[i];
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`tedit_${threadId}_${stepIndex}_${fieldIndex}`)
        .setLabel(`Edit: ${field.label.slice(0, 40)}`)
        .setStyle(ButtonStyle.Secondary)
    );

    if ((i + 1) % 5 === 0 || i === fieldsToShow.length - 1) {
      editRows.push(currentRow);
      if (i < fieldsToShow.length - 1) {
        currentRow = new ActionRowBuilder();
      }
    }
  }

  // Confirm button in its own row
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tconfirm_${threadId}`)
      .setLabel('Confirm & Submit ✓')
      .setStyle(ButtonStyle.Success)
  );

  // Discord max 5 rows — use last row for confirm
  const allRows = [...editRows.slice(0, 4), confirmRow];

  await thread.send({ embeds: [summaryEmbed], components: allRows });
}

// ─── Finalize Submission ─────────────────────────────────────────────────────

async function finalizeThreadSubmission(threadId, supabase, client, log) {
  let session = sessionCache.get(threadId);
  if (!session) {
    const { data } = await supabase
      .from('application_sessions')
      .select('*')
      .eq('thread_id', threadId)
      .single();
    if (!data) return;
    session = data;
  }

  const entry = getFormById(session.form_id);
  if (!entry) {
    log('error', 'Form not found for finalization', { formId: session.form_id });
    return;
  }

  const { form } = entry;

  // Insert submission
  const { data: submission, error } = await supabase
    .from('submissions')
    .insert({
      form_id: session.form_id,
      discord_id: session.discord_id,
      discord_username: null, // Will be set below
      answers: session.answers,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    log('error', 'Failed to insert submission', { err: error.message, threadId });
    const thread = await client.channels.fetch(threadId);
    if (thread) await thread.send('Something went wrong saving your submission. Please try again.');
    return;
  }

  // Get user info for embed
  let username = session.discord_id;
  try {
    const user = await client.users.fetch(session.discord_id);
    username = user.tag;
    await supabase
      .from('submissions')
      .update({ discord_username: username })
      .eq('id', submission.id);
  } catch {}

  log('info', 'Submission created from thread', {
    submissionId: submission.id,
    userId: session.discord_id,
    formName: form.name,
  });

  // Build admin embed
  const EMBED_FIELD_MAX = 1024;
  const answerFields = Object.entries(session.answers).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: String(value || '—').slice(0, EMBED_FIELD_MAX),
    inline: String(value).length < 50,
  }));

  const adminEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(`New Submission: ${form.name}`)
    .setDescription(`By <@${session.discord_id}> (${username})`)
    .addFields(answerFields.slice(0, 25))
    .setFooter({ text: `Submission ID: ${submission.id} | Form: ${form.name}` })
    .setTimestamp();

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve_${submission.id}_${session.discord_id}_${session.form_id}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`reject_${submission.id}_${session.discord_id}_${session.form_id}`)
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger),
  );

  const adminChannelId = form.settings?.admin_channel_id || process.env.ADMIN_CHANNEL_ID;
  const adminChannel = client.channels.cache.get(adminChannelId);
  if (adminChannel) {
    await adminChannel.send({ embeds: [adminEmbed], components: [buttons] });
  } else {
    log('error', 'Admin channel not found', { adminChannelId, submissionId: submission.id });
  }

  // Update session
  session.status = 'submitted';
  uncacheSession(threadId);
  await supabase
    .from('application_sessions')
    .update({ status: 'submitted', updated_at: new Date().toISOString() })
    .eq('thread_id', threadId);

  // Completion message in thread
  const thread = await client.channels.fetch(threadId);
  if (thread) {
    const confirmMsg = form.settings?.confirmation_message ||
      'Your application has been submitted! We\'ll review it and get back to you soon. 🎉';
    await thread.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00C853)
          .setTitle('✅ Application Submitted')
          .setDescription(confirmMsg)
      ],
    });

    // Archive thread after a short delay
    setTimeout(async () => {
      try {
        await thread.setArchived(true);
      } catch (err) {
        log('warn', 'Failed to archive thread', { threadId, err: err.message });
      }
    }, 10000);
  }
}

// ─── Session Cleanup ─────────────────────────────────────────────────────────

async function runSessionCleanup(supabase, client, log) {
  try {
    const { data: expired } = await supabase
      .from('application_sessions')
      .select('id, thread_id')
      .eq('status', 'in_progress')
      .lt('expires_at', new Date().toISOString());

    if (!expired || expired.length === 0) return;

    log('info', `Cleaning up ${expired.length} expired sessions`);

    for (const session of expired) {
      // Send timeout message
      try {
        const thread = await client.channels.fetch(session.thread_id);
        if (thread) {
          await thread.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF3366)
                .setTitle('⏰ Application Expired')
                .setDescription('This application has timed out due to inactivity. Start a new one to try again.')
            ],
          });
          await thread.setArchived(true);
        }
      } catch {}

      uncacheSession(session.thread_id);
    }

    // Bulk update
    const ids = expired.map(s => s.id);
    await supabase
      .from('application_sessions')
      .update({ status: 'timed_out', updated_at: new Date().toISOString() })
      .in('id', ids);

  } catch (err) {
    log('error', 'Session cleanup failed', { err: err.message });
  }
}

// ─── Branching Helper ────────────────────────────────────────────────────────

function checkBranching(allFields, currentIdx, session) {
  // Look backwards from currentIdx to find any singleselect with branching in the same step
  const currentStep = allFields[currentIdx].stepIndex;

  for (let i = currentIdx; i >= 0; i--) {
    if (allFields[i].stepIndex !== currentStep) break;
    const f = allFields[i].field;
    if (f.type === 'singleselect' && f.branching && f.options) {
      const answer = session.answers[f.key];
      if (answer) {
        const chosen = f.options.find(o => o.value === answer);
        if (chosen?.next_step !== null && chosen?.next_step !== undefined) {
          if (chosen.next_step === -1) return null; // End form

          // Find first field in target step
          const target = allFields.find(af => af.stepIndex === chosen.next_step);
          if (target) return { stepIndex: target.stepIndex, fieldIndex: target.fieldIndex };
        }
      }
    }
  }

  return null;
}

module.exports = {
  postApplyEmbed,
  startThreadSession,
  askNextQuestion,
  handleThreadMessage,
  handleThreadButton,
  showConfirmation,
  finalizeThreadSubmission,
  runSessionCleanup,
};
