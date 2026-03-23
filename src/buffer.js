class MessageBuffer {
  constructor(maxSize = 20, expirationMinutes = 5, deduplicationWindow = 1000) {
    this.buffers = new Map();
    this.maxSize = maxSize;
    this.expirationMs = expirationMinutes * 60 * 1000;
    this.deduplicationWindow = deduplicationWindow;
    this.seen = new Map();
  }

  add(message) {
    this.pruneSeen();

    if (this.seen.has(message.id)) {
      return false;
    }

    const channelId = message.channel_id;
    const channelBuffer = this.buffers.get(channelId) || [];
    const enriched = {
      id: message.id,
      content: message.content || '',
      author_id: message.author_id || null,
      author_name: message.author_name || 'Unknown',
      author_bot: Boolean(message.author_bot),
      channel_id: channelId,
      channel_name: message.channel_name || null,
      guild_id: message.guild_id || null,
      created_at: message.created_at || new Date().toISOString(),
      added_at: Date.now()
    };

    channelBuffer.unshift(enriched);
    const cutoff = Date.now() - this.expirationMs;
    const filtered = channelBuffer
      .filter((entry) => entry.added_at >= cutoff)
      .slice(0, this.maxSize);

    this.buffers.set(channelId, filtered);
    this.seen.set(message.id, Date.now() + this.deduplicationWindow);

    return true;
  }

  getContext(channelId, count = 10) {
    this.expireChannel(channelId);
    return (this.buffers.get(channelId) || []).slice(0, count);
  }

  clear() {
    this.buffers.clear();
    this.seen.clear();
  }

  expireChannel(channelId) {
    const existing = this.buffers.get(channelId) || [];
    const cutoff = Date.now() - this.expirationMs;
    const filtered = existing.filter((entry) => entry.added_at >= cutoff);
    if (filtered.length > 0) {
      this.buffers.set(channelId, filtered);
    } else {
      this.buffers.delete(channelId);
    }
  }

  pruneSeen() {
    const now = Date.now();
    for (const [id, expiresAt] of this.seen.entries()) {
      if (expiresAt <= now) {
        this.seen.delete(id);
      }
    }
  }
}

module.exports = MessageBuffer;
