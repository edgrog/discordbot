// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Form Loading — Fetches forms + form_steps from Supabase, builds modals
// ─────────────────────────────────────────────────────────────────────────────

const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
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
      .eq('is_active', true)
      .order('display_order', { ascending: true });

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
      .order('step_order', { ascending: true });

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
        .sort((a, b) => a.step_order - b.step_order);

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
};
