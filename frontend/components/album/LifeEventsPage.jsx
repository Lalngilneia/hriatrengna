/**
 * Subscriber life events page
 */

import { useEffect, useState } from 'react';
import { apiCall } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { EVENT_ICON_OPTIONS, normalizeEventIcon, renderEventIcon } from '../../lib/constants';
import Spinner from '../../components/shared/Spinner';

function EventStat({ label, value, sub }) {
  return (
    <div className="subpage-card pad">
      <div className="subpage-stat-label">{label}</div>
      <div className="subpage-stat-value">{value}</div>
      <div className="subpage-stat-sub">{sub}</div>
    </div>
  );
}

export default function LifeEventsPage({ currentAlbum, setCurrentAlbum, setPage, showToast }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', event_date: '', description: '', icon: 'star' });
  const [error, setError] = useState('');
  const token = getToken();

  useEffect(() => {
    let active = true;

    const ensureAlbumAndLoad = async () => {
      if (!currentAlbum?.id) {
        try {
          const result = await apiCall('/api/albums', {}, token);
          const first = result.albums?.[0];
          if (!active) return;
          if (first) {
            setCurrentAlbum(first);
          } else {
            setPage('dashboard');
          }
        } catch {
          if (active) setPage('dashboard');
        }
        return;
      }

      try {
        const result = await apiCall(`/api/albums/${currentAlbum.id}/events`, {}, token);
        if (active) setEvents(result.events || []);
      } catch (err) {
        if (active) setError(err.message || 'Failed to load life events');
      } finally {
        if (active) setLoading(false);
      }
    };

    ensureAlbumAndLoad();
    return () => {
      active = false;
    };
  }, [currentAlbum?.id, setCurrentAlbum, setPage, token]);

  const startNew = () => {
    setForm({ title: '', event_date: '', description: '', icon: 'star' });
    setEditing('new');
  };

  const startEdit = (eventItem) => {
    setForm({
      title: eventItem.title,
      event_date: eventItem.event_date ? eventItem.event_date.substring(0, 10) : '',
      description: eventItem.description || '',
      icon: normalizeEventIcon(eventItem.icon),
    });
    setEditing(eventItem.id);
  };

  const saveEvent = async () => {
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (editing === 'new') {
        const result = await apiCall(
          `/api/albums/${currentAlbum.id}/events`,
          { method: 'POST', body: JSON.stringify(form) },
          token,
        );
        setEvents((prev) => [...prev, result.event].sort((a, b) => new Date(a.event_date || 0) - new Date(b.event_date || 0)));
      } else {
        const result = await apiCall(
          `/api/albums/${currentAlbum.id}/events/${editing}`,
          { method: 'PUT', body: JSON.stringify(form) },
          token,
        );
        setEvents((prev) => prev.map((item) => (item.id === editing ? result.event : item)));
      }
      setEditing(null);
      showToast?.('Life event saved');
    } catch (err) {
      setError(err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id) => {
    if (!confirm('Delete this life event?')) return;
    try {
      await apiCall(`/api/albums/${currentAlbum.id}/events/${id}`, { method: 'DELETE' }, token);
      setEvents((prev) => prev.filter((item) => item.id !== id));
      showToast?.('Life event deleted');
    } catch (err) {
      showToast?.(err.message || 'Delete failed', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner dark />
      </div>
    );
  }

  const datedEvents = events.filter((item) => item.event_date);
  const sortedByDate = [...datedEvents].sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  const firstEvent = sortedByDate[0];
  const latestEvent = sortedByDate[sortedByDate.length - 1];

  return (
    <div className="subpage">
      <section className="subpage-header">
        <div className="subpage-header-copy">
          <button type="button" className="subpage-back" onClick={() => setPage('dashboard')}>
            Back to Dashboard
          </button>
          <div className="subpage-eyebrow">Life Events</div>
          <div className="subpage-title">Timeline editor</div>
          <div className="subpage-sub">
            Build a richer story for {currentAlbum?.name || 'this album'} by adding milestones, dates, and context visitors can browse.
          </div>
        </div>
        <div className="subpage-actions">
          <button type="button" className="subdash-btn primary" onClick={startNew}>Add Event</button>
        </div>
      </section>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      <section className="subpage-grid">
        <EventStat label="Events" value={events.length} sub="Timeline milestones saved" />
        <EventStat label="First Dated Event" value={firstEvent?.event_date ? new Date(firstEvent.event_date).getFullYear() : '-'} sub={firstEvent?.title || 'No dated event yet'} />
        <EventStat label="Latest Event" value={latestEvent?.event_date ? new Date(latestEvent.event_date).getFullYear() : '-'} sub={latestEvent?.title || 'No dated event yet'} />
      </section>

      {editing && (
        <section className="subpage-card pad">
          <div className="subpage-section-title">{editing === 'new' ? 'Add a timeline event' : 'Edit timeline event'}</div>
          <div className="subpage-section-sub">Use icons, dates, and short descriptions to make the timeline easier to scan.</div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Icon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.45rem' }}>
              {EVENT_ICON_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, icon: option.id }))}
                  title={option.label}
                  style={{
                    width: 38,
                    height: 38,
                    border: `2px solid ${form.icon === option.id ? '#4338CA' : '#E5E7EB'}`,
                    borderRadius: 10,
                    background: form.icon === option.id ? '#EEF2FF' : '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {option.emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: '1rem' }}>
            <div>
              <label className="form-label">Title *</label>
              <input
                className="form-input"
                placeholder="e.g. Marriage, graduation, first home"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Date</label>
              <input
                className="form-input"
                type="date"
                value={form.event_date}
                onChange={(e) => setForm((prev) => ({ ...prev, event_date: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Add a short description..."
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="subdash-btn ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="subdash-btn primary" onClick={saveEvent} disabled={saving}>
              {saving ? 'Saving...' : 'Save Event'}
            </button>
          </div>
        </section>
      )}

      <section className="subpage-card pad">
        <div className="subpage-section-title">Timeline</div>
        <div className="subpage-section-sub">Events appear here in the order your visitors will experience them.</div>

        {events.length === 0 ? (
          <div className="subpage-empty">
            <div className="subpage-empty-title">No life events yet</div>
            <div>Add major milestones to help visitors understand the story behind this album.</div>
          </div>
        ) : (
          <div className="subtimeline">
            {events.map((eventItem) => (
              <div key={eventItem.id} className="subtimeline-item">
                <div className="subtimeline-icon">{renderEventIcon(eventItem.icon)}</div>
                <div>
                  <div className="subtimeline-title">{eventItem.title}</div>
                  {eventItem.event_date && (
                    <div className="subtimeline-date">
                      {new Date(eventItem.event_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                  {eventItem.description && <div className="subtimeline-desc">{eventItem.description}</div>}
                </div>
                <div className="subtimeline-actions">
                  <button type="button" className="subdash-btn ghost" onClick={() => startEdit(eventItem)}>Edit</button>
                  <button type="button" className="subdash-btn danger" onClick={() => deleteEvent(eventItem.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
