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

  // ── Reload Forms ─────────────────────────────────────────────────────────

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

  // ── Approve Application ──────────────────────────────────────────────────

  app.post('/api/applications/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      const { reviewerName, note } = req.body;

      // Race condition guard
      const { data: app, error: fetchErr } = await supabase
        .from('partner_applications')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !app) {
        return res.status(404).json({ ok: false, error: 'Application not found' });
      }

      if (app.status !== 'pending') {
        return res.json({
          ok: false,
          error: 'already_reviewed',
          currentStatus: app.status,
        });
      }

      // Update DB
      const updateData = {
        status: 'approved',
        reviewed_by: reviewerName || 'Dashboard',
        review_note: note || null,
      };

      const { error: updateErr } = await supabase
        .from('partner_applications')
        .update(updateData)
        .eq('id', id);

      if (updateErr) {
        return res.status(500).json({ ok: false, error: updateErr.message });
      }

      log('info', 'Application approved via API', { appId: id, reviewer: reviewerName });

      // Assign Discord role
      const roleKeys = { bar: 'role_id_bar', club: 'role_id_club', artist: 'role_id_artist', creator: 'role_id_creator' };
      const { data: roleSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', roleKeys[app.category])
        .single();

      const roleId = roleSetting?.value;
      let roleAssigned = false;

      if (roleId) {
        try {
          const guild = client.guilds.cache.first();
          if (guild) {
            const member = await guild.members.fetch(app.discord_id);
            await member.roles.add(roleId);
            roleAssigned = true;
            log('info', 'Role assigned via API', { userId: app.discord_id, roleId });
          }
        } catch (err) {
          const hint = err.code === 50013
            ? 'Bot role must be above partner roles in Server Settings → Roles.'
            : err.message;
          log('error', 'Role assignment failed via API', { err: err.message, code: err.code });

          // Alert admin channel
          const { data: channelSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'admin_channel_id')
            .single();

          if (channelSetting?.value) {
            const ch = client.channels.cache.get(channelSetting.value);
            if (ch) {
              await ch.send(`⚠️ **Role assignment failed** for <@${app.discord_id}> (App \`${id}\`) — ${hint} Please assign manually.`).catch(() => {});
            }
          }
        }
      }

      // DM applicant
      let dmSent = false;
      try {
        const { data: templateSetting } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'dm_approve_template')
          .single();

        let message = templateSetting?.value ||
          "🍋 **You're in!**\n\nWelcome to the Grog Partner Program! Your private channels are now unlocked.\n\nLet's cook something fun together 🍹";

        message = message.replace(/\{name\}/g, app.full_name || 'there');

        if (note) {
          message += `\n\n📝 Note from the team: ${note}`;
        }

        const targetUser = await client.users.fetch(app.discord_id);
        await targetUser.send(message);
        dmSent = true;
      } catch (err) {
        log('warn', 'Could not DM applicant via API', { userId: app.discord_id });
      }

      // Update dm_sent
      await supabase
        .from('partner_applications')
        .update({ dm_sent: dmSent })
        .eq('id', id);

      res.json({ ok: true, roleAssigned, dmSent });
    } catch (err) {
      log('error', 'Approve API error', { err: err.message });
      res.status(500).json({ ok: false, error: 'Internal error' });
    }
  });

  // ── Reject Application ───────────────────────────────────────────────────

  app.post('/api/applications/:id/reject', async (req, res) => {
    try {
      const { id } = req.params;
      const { reviewerName, note } = req.body;

      // Race condition guard
      const { data: app, error: fetchErr } = await supabase
        .from('partner_applications')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !app) {
        return res.status(404).json({ ok: false, error: 'Application not found' });
      }

      if (app.status !== 'pending') {
        return res.json({
          ok: false,
          error: 'already_reviewed',
          currentStatus: app.status,
        });
      }

      // Update DB
      const { error: updateErr } = await supabase
        .from('partner_applications')
        .update({
          status: 'rejected',
          reviewed_by: reviewerName || 'Dashboard',
          review_note: note || null,
        })
        .eq('id', id);

      if (updateErr) {
        return res.status(500).json({ ok: false, error: updateErr.message });
      }

      log('info', 'Application rejected via API', { appId: id, reviewer: reviewerName });

      // DM applicant
      let dmSent = false;
      try {
        const { data: templateSetting } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'dm_reject_template')
          .single();

        let message = templateSetting?.value ||
          "Hey! Thanks for applying to the Grog Partner Program.\n\nUnfortunately we're not moving forward right now — but keep your eyes open, things change fast. Keep drinking Grog 🍊";

        message = message.replace(/\{name\}/g, app.full_name || 'there');

        if (note) {
          message += `\n\n📝 Note from the team: ${note}`;
        }

        const targetUser = await client.users.fetch(app.discord_id);
        await targetUser.send(message);
        dmSent = true;
      } catch (err) {
        log('warn', 'Could not DM applicant via API', { userId: app.discord_id });
      }

      // Update dm_sent
      await supabase
        .from('partner_applications')
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
