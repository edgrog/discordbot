// ─────────────────────────────────────────────────────────────────────────────
// Signal Poller — Watches bot_signals table for reload commands
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 60 * 1000; // 60 seconds

function startSignalPoller(supabase, onReload, log) {
  async function poll() {
    try {
      const { data, error } = await supabase
        .from('bot_signals')
        .select('*')
        .eq('signal', 'reload_forms')
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        log('error', 'Signal poll failed', { error: error.message });
        return;
      }

      if (data && data.length > 0) {
        const signal = data[0];
        log('info', 'Reload signal received', { signalId: signal.id });

        await onReload();

        // Mark as processed
        await supabase
          .from('bot_signals')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', signal.id);

        log('info', 'Forms reloaded via signal', { signalId: signal.id });
      }
    } catch (err) {
      log('error', 'Signal poller error', { err: err.message });
    }
  }

  const interval = setInterval(poll, POLL_INTERVAL);
  poll(); // Run immediately on start

  return interval;
}

module.exports = { startSignalPoller };
