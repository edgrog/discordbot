#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Seed form_config with the current hardcoded form structure
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node supabase/scripts/seed-forms.js
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const formSteps = [
  // ── Personal (all categories) ──────────────────────────────────────────────
  {
    category: 'personal',
    step: 1,
    step_title: 'Your Details',
    fields: [
      { key: 'full_name', label: 'Full Name', type: 'short', required: true },
      { key: 'email', label: 'Email Address', type: 'short', required: true },
      { key: 'phone', label: 'Phone Number', type: 'short', required: true },
      { key: 'dob', label: 'Date of Birth (DD/MM/YYYY — Must be 21+)', type: 'short', required: true, placeholder: 'e.g. 15/03/1995' },
    ],
  },
  {
    category: 'personal',
    step: 2,
    step_title: 'Your Address',
    fields: [
      { key: 'address', label: 'Address Line 1', type: 'short', required: false },
      { key: 'city', label: 'City', type: 'short', required: false },
      { key: 'state', label: 'State / Province / Region', type: 'short', required: false },
      { key: 'zip', label: 'ZIP / Postal Code', type: 'short', required: false },
      { key: 'country', label: 'Country', type: 'short', required: false },
    ],
  },

  // ── Bar / Venue ────────────────────────────────────────────────────────────
  {
    category: 'bar',
    step: 1,
    step_title: 'Venue Location',
    fields: [
      { key: 'estab_name', label: 'Name of Establishment', type: 'short', required: true },
      { key: 'estab_address', label: 'Establishment Address', type: 'short', required: true },
      { key: 'estab_city', label: 'City', type: 'short', required: true },
      { key: 'estab_state', label: 'State / Region', type: 'short', required: true },
      { key: 'estab_zip_country', label: 'ZIP / Postal Code & Country', type: 'short', required: true, placeholder: 'e.g. 90210, USA' },
    ],
  },
  {
    category: 'bar',
    step: 2,
    step_title: 'Venue Details',
    fields: [
      { key: 'estab_type', label: 'Type of Establishment', type: 'short', required: true, placeholder: 'Cocktail Bar / Dive Bar / Nightclub / Restaurant / Liquor Store' },
      { key: 'stocks_grog', label: 'Do you currently stock Grog?', type: 'short', required: true, placeholder: 'Yes consistently / Occasionally / No but interested' },
      { key: 'promo_activities', label: "Promotional activities you're interested in?", type: 'paragraph', required: true, placeholder: 'e.g. Grog cocktail menu, dedicated events, tastings...' },
    ],
  },

  // ── Club / Organiser ───────────────────────────────────────────────────────
  {
    category: 'club',
    step: 1,
    step_title: 'Club Details',
    fields: [
      { key: 'club_name', label: 'Name of Club / Society / Organisation', type: 'short', required: true },
      { key: 'club_type', label: 'Type of Club', type: 'short', required: true, placeholder: 'e.g. Social Club, Hobby Group, Professional Network' },
      { key: 'club_activities', label: 'Primary Activities of Your Group', type: 'paragraph', required: true },
      { key: 'member_count', label: 'Approximate Number of Members', type: 'short', required: true },
    ],
  },
  {
    category: 'club',
    step: 2,
    step_title: 'Events & Grog',
    fields: [
      { key: 'event_frequency', label: 'How often does your club host events?', type: 'short', required: true, placeholder: 'Weekly / Bi-Weekly / Monthly / Quarterly / Less frequently' },
      { key: 'grog_help', label: 'How can Grog help your club?', type: 'paragraph', required: true, placeholder: 'Giveaways, event sponsorship, product supply...' },
    ],
  },

  // ── Artist ─────────────────────────────────────────────────────────────────
  {
    category: 'artist',
    step: 1,
    step_title: 'Creative Profile',
    fields: [
      { key: 'artist_name', label: 'Artist Name', type: 'short', required: true },
      { key: 'mediums', label: 'Primary Artistic Mediums', type: 'short', required: true, placeholder: 'e.g. Digital Art, Photography, Videography, Music' },
      { key: 'portfolio_link', label: 'Portfolio or Primary Creative Profile Link', type: 'short', required: true },
      { key: 'social_link', label: 'Primary Social Media Link', type: 'short', required: false },
    ],
  },

  // ── Content Creator ────────────────────────────────────────────────────────
  {
    category: 'creator',
    step: 1,
    step_title: 'Creator Profile',
    fields: [
      { key: 'creator_name', label: 'Creator Name / Handle', type: 'short', required: true },
      { key: 'platforms', label: 'Primary Platforms', type: 'short', required: true, placeholder: 'e.g. TikTok, Instagram, YouTube, Twitch' },
      { key: 'channel_links', label: 'Links to Your Channels', type: 'paragraph', required: true, placeholder: 'One link per line' },
      { key: 'follower_count', label: 'Approx. Total Followers Across All Platforms', type: 'short', required: true, placeholder: 'e.g. 84,000' },
    ],
  },
  {
    category: 'creator',
    step: 2,
    step_title: 'Your Content',
    fields: [
      { key: 'niche', label: 'Main Creator Niche / Genre', type: 'short', required: true, placeholder: 'e.g. Gaming, Lifestyle, Food/Cooking, Travel' },
      { key: 'audience_description', label: 'Describe your content & audience demographics', type: 'paragraph', required: true, placeholder: 'Age range, gender split, location, what you make...' },
      { key: 'content_types', label: 'Content types you can create for Grog', type: 'short', required: true, placeholder: 'e.g. Product Reviews, Reels, UGC, Giveaways, Live Streams' },
    ],
  },
];

async function seed() {
  // Check if already seeded
  const { count, error: countErr } = await supabase
    .from('form_config')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error('Failed to check form_config:', countErr.message);
    process.exit(1);
  }

  if (count > 0) {
    console.log(`Already seeded (${count} rows in form_config). Skipping.`);
    return;
  }

  // Insert each step
  for (const step of formSteps) {
    const { data, error } = await supabase
      .from('form_config')
      .insert(step)
      .select()
      .single();

    if (error) {
      console.error(`Failed to insert ${step.category} step ${step.step}:`, error.message);
      process.exit(1);
    }

    console.log(`Inserted: ${step.category} step ${step.step} — "${step.step_title}" (${step.fields.length} fields)`);
  }

  console.log(`\nDone. ${formSteps.length} rows seeded into form_config.`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
