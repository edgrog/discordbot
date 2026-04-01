// ─────────────────────────────────────────────────────────────────────────────
// Bot HTTP API — Express server for dashboard-to-bot communication
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');

function createHttpApi({ supabase, client, log, reloadForms }) {
  const app = express();
  app.use(express.json());

  // Bearer token auth middleware
  app.use('/api', (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${process.env.BOT_API_SECRET}`) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    next();
  });

  // Request logging
  app.use('/api', (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      log('info', `HTTP ${req.method} ${req.path}`, {
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    next();
  });

  // ── Health ───────────────────────────────────────────────────────────────

  app.get('/api/health', (req, res) => {
    const { getLastLoadedAt } = require('./dynamic-forms');
    res.json({
      ok: true,
      uptime: Math.floor(process.uptime()),
      formsLastLoaded: getLastLoadedAt(),
    });
  });

  // ── Reload Forms + Re-register Commands ─────────────────────────────────

  app.post('/api/reload-forms', async (req, res) => {
    try {
      await reloadForms();
      const { getLastLoadedAt } = require('./dynamic-forms');
      res.json({ ok: true, reloadedAt: getLastLoadedAt() });
    } catch (err) {
      log('error', 'Form reload via API failed', { err: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Approve Submission ──────────────────────────────────────────────────

  app.post('/api/submissions/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      const { reviewerName, note } = req.body;

      // Fetch submission
      const { data: submission, error: fetchErr } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !submission) {
        return res.status(404).json({ ok: false, error: 'Submission not found' });
      }

      if (submission.status !== 'pending') {
        return res.json({
          ok: false,
          error: 'already_reviewed',
          currentStatus: submission.status,
        });
      }

      // Update DB
      const { error: updateErr } = await supabase
        .from('submissions')
        .update({
          status: 'approved',
          reviewed_by: reviewerName || 'Dashboard',
          review_note: note || null,
        })
        .eq('id', id);

      if (updateErr) {
        return res.status(500).json({ ok: false, error: updateErr.message });
      }

      log('info', 'Submission approved via API', { submissionId: id, reviewer: reviewerName });

      // Load form settings for role_id and DM templates
      let formSettings = {};
      if (submission.form_id) {
        const { getFormById } = require('./dynamic-forms');
        const entry = getFormById(submission.form_id);
        formSettings = entry?.form?.settings || {};
      }

      // Assign Discord role
      const roleId = formSettings.role_id || process.env.PARTNER_ROLE_ID;
      let roleAssigned = false;

      if (roleId) {
        try {
          const guild = client.guilds.cache.first();
          if (guild) {
            const member = await guild.members.fetch(submission.discord_id);
            await member.roles.add(roleId);
            roleAssigned = true;
            log('info', 'Role assigned via API', { userId: submission.discord_id, roleId });
          }
        } catch (err) {
          const hint = err.code === 50013
            ? 'Bot role must be above the target role in Server Settings > Roles.'
            : err.message;
          log('error', 'Role assignment failed via API', { err: err.message, code: err.code });

          // Alert admin channel
          const adminChannelId = formSettings.admin_channel_id || process.env.ADMIN_CHANNEL_ID;
          if (adminChannelId) {
            const ch = client.channels.cache.get(adminChannelId);
            if (ch) {
              await ch.send(`Warning: Role assignment failed for <@${submission.discord_id}> (Submission \`${id}\`) — ${hint}. Please assign manually.`).catch(() => {});
            }
          }
        }
      }

      // DM applicant
      let dmSent = false;
      try {
        let message = formSettings.dm_approve_message
          || 'Your submission has been approved! Welcome aboard.';

        if (note) {
          message += `\n\nNote from the team: ${note}`;
        }

        const targetUser = await client.users.fetch(submission.discord_id);
        await targetUser.send(message);
        dmSent = true;
      } catch (err) {
        log('warn', 'Could not DM applicant via API', { userId: submission.discord_id });
      }

      // Update dm_sent
      await supabase
        .from('submissions')
        .update({ dm_sent: dmSent })
        .eq('id', id);

      res.json({ ok: true, roleAssigned, dmSent });
    } catch (err) {
      log('error', 'Approve API error', { err: err.message });
      res.status(500).json({ ok: false, error: 'Internal error' });
    }
  });

  // ── Reject Submission ───────────────────────────────────────────────────

  app.post('/api/submissions/:id/reject', async (req, res) => {
    try {
      const { id } = req.params;
      const { reviewerName, note } = req.body;

      // Fetch submission
      const { data: submission, error: fetchErr } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !submission) {
        return res.status(404).json({ ok: false, error: 'Submission not found' });
      }

      if (submission.status !== 'pending') {
        return res.json({
          ok: false,
          error: 'already_reviewed',
          currentStatus: submission.status,
        });
      }

      // Update DB
      const { error: updateErr } = await supabase
        .from('submissions')
        .update({
          status: 'rejected',
          reviewed_by: reviewerName || 'Dashboard',
          review_note: note || null,
        })
        .eq('id', id);

      if (updateErr) {
        return res.status(500).json({ ok: false, error: updateErr.message });
      }

      log('info', 'Submission rejected via API', { submissionId: id, reviewer: reviewerName });

      // Load form settings for DM template
      let formSettings = {};
      if (submission.form_id) {
        const { getFormById } = require('./dynamic-forms');
        const entry = getFormById(submission.form_id);
        formSettings = entry?.form?.settings || {};
      }

      // DM applicant
      let dmSent = false;
      try {
        let message = formSettings.dm_reject_message
          || 'Thank you for your submission. Unfortunately, we are not moving forward at this time.';

        if (note) {
          message += `\n\nNote from the team: ${note}`;
        }

        const targetUser = await client.users.fetch(submission.discord_id);
        await targetUser.send(message);
        dmSent = true;
      } catch (err) {
        log('warn', 'Could not DM applicant via API', { userId: submission.discord_id });
      }

      // Update dm_sent
      await supabase
        .from('submissions')
        .update({ dm_sent: dmSent })
        .eq('id', id);

      res.json({ ok: true, dmSent });
    } catch (err) {
      log('error', 'Reject API error', { err: err.message });
      res.status(500).json({ ok: false, error: 'Internal error' });
    }
  });

  return app;
}

module.exports = { createHttpApi };
