// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Form Loading — Fetches form_config from Supabase, builds Discord modals
// ─────────────────────────────────────────────────────────────────────────────

const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

let formCache = null;  // { [category]: { [step]: { title, fields } } }
let lastLoadedAt = null;

/**
 * Load form configuration from Supabase and cache it.
 */
async function loadFormConfig(supabase, log) {
  const { data, error } = await supabase
    .from('form_config')
    .select('*')
    .order('category')
    .order('step');

  if (error) {
    log('error', 'Failed to load form_config', { error: error.message });
    return false;
  }

  const newCache = {};
  for (const row of data) {
    if (!newCache[row.category]) newCache[row.category] = {};
    newCache[row.category][row.step] = {
      title: row.step_title,
      fields: row.fields,
    };
  }

  formCache = newCache;
  lastLoadedAt = new Date().toISOString();

  // Update settings table with last loaded timestamp
  await supabase
    .from('settings')
    .upsert({ key: 'forms_last_loaded', value: lastLoadedAt })
    .then();

  log('info', 'Form config loaded', {
    categories: Object.keys(newCache),
    totalSteps: data.length,
  });

  return true;
}

/**
 * Build a Discord modal from cached form config.
 * @param {string} customId - The custom ID for the modal
 * @param {string} category - Category name
 * @param {number} step - Step number (1-indexed)
 * @param {string} [titleOverride] - Optional title override (for emoji prefix)
 */
function buildModal(customId, category, step, titleOverride) {
  if (!formCache || !formCache[category] || !formCache[category][step]) {
    return null;
  }

  const config = formCache[category][step];
  const title = titleOverride || config.title;

  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title);

  for (const field of config.fields) {
    const input = new TextInputBuilder()
      .setCustomId(field.key)
      .setLabel(field.label)
      .setStyle(field.type === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(field.required);

    if (field.placeholder) {
      input.setPlaceholder(field.placeholder);
    }

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

/**
 * Get personal step modals (shared across all categories)
 */
function getPersonalModal(step, category) {
  const emoji = '🍋';
  const titles = { 1: `${emoji} Grog Partner — Your Details`, 2: `${emoji} Grog Partner — Your Address` };
  return buildModal(`personal_${step}_${category}`, 'personal', step, titles[step]);
}

/**
 * Get category-specific step modal
 */
function getCategoryModal(category, step) {
  const emojis = { bar: '🍺', club: '🎉', artist: '🎨', creator: '🎥' };
  const emoji = emojis[category] || '';
  const config = formCache?.[category]?.[step];
  const title = config ? `${emoji} ${config.title}` : '';
  return buildModal(`cat_${category}_${step}`, category, step, title);
}

/**
 * Get the number of category-specific steps for a category.
 */
function getCategoryStepCount(category) {
  if (!formCache || !formCache[category]) return 0;
  return Object.keys(formCache[category]).length;
}

/**
 * Get all field keys for a category step.
 */
function getFieldKeys(category, step) {
  if (!formCache?.[category]?.[step]) return [];
  return formCache[category][step].fields.map(f => f.key);
}

function getLastLoadedAt() {
  return lastLoadedAt;
}

function isLoaded() {
  return formCache !== null;
}

module.exports = {
  loadFormConfig,
  buildModal,
  getPersonalModal,
  getCategoryModal,
  getCategoryStepCount,
  getFieldKeys,
  getLastLoadedAt,
  isLoaded,
};
