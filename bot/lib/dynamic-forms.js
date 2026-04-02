// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Form Loading — Fetches forms + form_steps from Supabase, builds modals
// ─────────────────────────────────────────────────────────────────────────────

const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

let formCache = new Map();   // Map<formId, { form, steps }>
let commandMap = new Map();  // Map<commandName, formId>
let lastLoadedAt = null;

/**
 * Load active forms and their steps from Supabase, populate both caches.
 */
async function loadFormConfig(supabase, log) {
  try {
    // Fetch active forms
    const { data: forms, error: formsErr } = await supabase
      .from('forms')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (formsErr) {
      log('error', 'Failed to load forms', { error: formsErr.message });
      return false;
    }

    if (!forms || forms.length === 0) {
      log('warn', 'No active forms found');
      formCache = new Map();
      commandMap = new Map();
      lastLoadedAt = new Date().toISOString();
      return true;
    }

    // Fetch all steps for active forms
    const formIds = forms.map(f => f.id);
    const { data: steps, error: stepsErr } = await supabase
      .from('form_steps')
      .select('*')
      .in('form_id', formIds)
      .order('position', { ascending: true });

    if (stepsErr) {
      log('error', 'Failed to load form_steps', { error: stepsErr.message });
      return false;
    }

    // Build caches
    const newFormCache = new Map();
    const newCommandMap = new Map();

    for (const form of forms) {
      const formSteps = (steps || [])
        .filter(s => s.form_id === form.id)
        .sort((a, b) => a.position - b.position);

      newFormCache.set(form.id, { form, steps: formSteps });

      if (form.discord_command_name) {
        newCommandMap.set(form.discord_command_name, form.id);
      }
    }

    formCache = newFormCache;
    commandMap = newCommandMap;
    lastLoadedAt = new Date().toISOString();

    // Update settings table
    await supabase
      .from('settings')
      .upsert({ key: 'forms_last_loaded', value: lastLoadedAt })
      .then();

    log('info', 'Form config loaded', {
      forms: forms.length,
      steps: (steps || []).length,
      commands: [...newCommandMap.keys()],
    });

    return true;
  } catch (err) {
    log('error', 'loadFormConfig threw', { err: err.message });
    return false;
  }
}

/**
 * Get a form and its steps by form ID.
 */
function getFormById(formId) {
  return formCache.get(formId) || null;
}

/**
 * Get the form ID mapped to a slash command name.
 */
function getFormByCommand(commandName) {
  return commandMap.get(commandName) || null;
}

/**
 * Build a Discord ModalBuilder from a form step.
 * customId format: form_<formId>_<stepIndex>
 */
function getModalForStep(formId, stepIndex) {
  const entry = formCache.get(formId);
  if (!entry || !entry.steps[stepIndex]) return null;

  const step = entry.steps[stepIndex];
  const fields = step.fields || [];

  if (fields.length === 0) return null;

  const modal = new ModalBuilder()
    .setCustomId(`form_${formId}_${stepIndex}`)
    .setTitle((step.title || `Step ${stepIndex + 1}`).slice(0, 45));

  for (const field of fields) {
    const input = new TextInputBuilder()
      .setCustomId(field.key)
      .setLabel((field.label || field.key).slice(0, 45))
      .setStyle(field.type === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(field.required !== false);

    if (field.placeholder) {
      input.setPlaceholder(field.placeholder.slice(0, 100));
    }

    if (field.min_length) input.setMinLength(field.min_length);
    if (field.max_length) input.setMaxLength(field.max_length);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

/**
 * Get the total number of steps for a form.
 */
function getStepCount(formId) {
  const entry = formCache.get(formId);
  return entry ? entry.steps.length : 0;
}

/**
 * Get field keys for a specific step of a form.
 */
function getFieldKeysForStep(formId, stepIndex) {
  const entry = formCache.get(formId);
  if (!entry || !entry.steps[stepIndex]) return [];
  return (entry.steps[stepIndex].fields || []).map(f => f.key);
}

/**
 * Get all active forms with their steps.
 */
function getAllActiveForms() {
  return Array.from(formCache.values());
}

/**
 * Get the command-to-formId mapping.
 */
function getActiveCommands() {
  return commandMap;
}

function getLastLoadedAt() {
  return lastLoadedAt;
}

function isLoaded() {
  return formCache.size > 0;
}

/**
 * Get the step type ("fields" or "select") for a given step.
 */
function getStepType(formId, stepIndex) {
  const entry = formCache.get(formId);
  if (!entry || !entry.steps[stepIndex]) return null;
  return entry.steps[stepIndex].step_type || 'fields';
}

/**
 * Build a StringSelectMenu for a "select" type step.
 * customId format: formselect_<formId>_<stepIndex>
 */
function getSelectMenuForStep(formId, stepIndex) {
  const entry = formCache.get(formId);
  if (!entry || !entry.steps[stepIndex]) return null;

  const step = entry.steps[stepIndex];
  if (step.step_type !== 'select' || !step.options || step.options.length === 0) return null;

  const select = new StringSelectMenuBuilder()
    .setCustomId(`formselect_${formId}_${stepIndex}`)
    .setPlaceholder('Select an option...')
    .addOptions(
      step.options.map(opt => ({
        label: opt.label.slice(0, 100),
        value: opt.value.slice(0, 100),
      }))
    );

  return new ActionRowBuilder().addComponents(select);
}

/**
 * Resolve the next step index given current step and optional selected value.
 * Returns step index (number) or null (finalize).
 */
function resolveNextStep(formId, currentStepIndex, selectedValue) {
  const entry = formCache.get(formId);
  if (!entry) return null;

  const step = entry.steps[currentStepIndex];
  if (!step) return null;

  let nextPos = null;

  if (step.step_type === 'select' && selectedValue && step.options) {
    const chosen = step.options.find(o => o.value === selectedValue);
    nextPos = chosen?.next_step ?? null;
  } else {
    nextPos = step.next_step ?? null;
  }

  // null means "next in order"
  if (nextPos === null) {
    const sequential = currentStepIndex + 1;
    return sequential < entry.steps.length ? sequential : null;
  }

  // -1 means "end form"
  if (nextPos === -1) return null;

  // Find step by position
  const targetIndex = entry.steps.findIndex(s => s.position === nextPos);
  return targetIndex >= 0 ? targetIndex : null;
}

/**
 * Get a flat list of all fields across all steps for a form.
 * Legacy step_type="select" steps are converted to a virtual singleselect field.
 * Returns: [{ stepIndex, fieldIndex, field, stepTitle }]
 */
function getFlattenedFields(formId) {
  const entry = formCache.get(formId);
  if (!entry) return [];

  const result = [];
  for (let si = 0; si < entry.steps.length; si++) {
    const step = entry.steps[si];

    if (step.step_type === 'select' && step.options && step.options.length > 0) {
      // Convert legacy select step to a virtual singleselect field
      result.push({
        stepIndex: si,
        fieldIndex: 0,
        field: {
          key: step.title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `select_${si}`,
          label: step.title || `Selection ${si + 1}`,
          type: 'singleselect',
          required: true,
          options: step.options.map(o => ({ label: o.label, value: o.value, next_step: o.next_step })),
          branching: step.options.some(o => o.next_step !== null && o.next_step !== undefined),
        },
        stepTitle: step.title,
      });
    } else {
      const fields = step.fields || [];
      for (let fi = 0; fi < fields.length; fi++) {
        result.push({
          stepIndex: si,
          fieldIndex: fi,
          field: fields[fi],
          stepTitle: step.title,
        });
      }
    }
  }

  return result;
}

module.exports = {
  loadFormConfig,
  getFormById,
  getFormByCommand,
  getModalForStep,
  getStepCount,
  getFieldKeysForStep,
  getAllActiveForms,
  getActiveCommands,
  getLastLoadedAt,
  isLoaded,
  getStepType,
  getSelectMenuForStep,
  resolveNextStep,
  getFlattenedFields,
};
