import { useEffect, useRef, useState } from 'react';
import { CDN, apiCall, uploadFile, uploadMediaFile } from '../../lib/api';
import { getToken } from '../../lib/auth';
import {
  WEDDING_ALBUM_LABELS,
  canCreateAlbumType,
  getPlanForType,
  getRemainingAlbumSlots,
  isMemorialPlan,
  isWeddingPlan,
} from '../../lib/constants';
import RichTextEditor from '../shared/RichTextEditor';
import Spinner from '../../components/shared/Spinner';
import QRPage from './QRPage';

const DRAFT_KEY = 'mqr_create_album_draft_v2';
const DRAFT_VERSION = 2;

const parseDraft = () => {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null'); }
  catch { return null; }
};

const fmtDate = (value) => {
  if (!value) return '';
  return value.includes('T') ? value.split('T')[0] : value;
};

export default function CreateAlbum({ user, setPage, currentAlbum, setCurrentAlbum, showToast }) {
  const isEdit = !!currentAlbum?.id;
  const [existingAlbums, setExistingAlbums] = useState([]);
  const [albumSlotsReady, setAlbumSlotsReady] = useState(isEdit);
  const token = getToken();
  const memorialPlan = getPlanForType(user, 'memorial');
  const weddingPlan = getPlanForType(user, 'wedding');
  // Use an OR chain — the old `typeof ... === 'boolean'` guard was always true after
  // normalizeUserPayload, making the plan-slug fallback completely dead code.
  // Now any truthy signal grants access (API flag, per-type plan slug, or legacy subscriptionPlan).
  const canAccessMemorial = Boolean(user?.hasMemorial)
    || isMemorialPlan(memorialPlan)
    || (isMemorialPlan(user?.subscriptionPlan) && !isWeddingPlan(user?.subscriptionPlan));
  const canAccessWedding = Boolean(user?.hasWedding)
    || isWeddingPlan(weddingPlan)
    || isWeddingPlan(user?.subscriptionPlan);
  const canMakeMemorial = isEdit
    ? currentAlbum?.type !== 'wedding'
    : canCreateAlbumType(user, existingAlbums, 'memorial');
  const canMakeWedding = isEdit
    ? currentAlbum?.type === 'wedding'
    : canCreateAlbumType(user, existingAlbums, 'wedding');
  const showTypeStep = canAccessMemorial && canAccessWedding && !isEdit;
  const defaultType = currentAlbum?.type || (canMakeWedding && !canMakeMemorial ? 'wedding' : 'memorial');

  const [step, setStep] = useState(showTypeStep ? 'type' : 'details');
  const [albumType, setAlbumType] = useState(defaultType);
  const [albumLabel, setAlbumLabel] = useState(currentAlbum?.album_label || '');
  const [name, setName] = useState(currentAlbum?.name || '');
  const [birthDate, setBirthDate] = useState(fmtDate(currentAlbum?.birth_date) || (currentAlbum?.birth_year ? `${currentAlbum.birth_year}-01-01` : ''));
  const [deathDate, setDeathDate] = useState(fmtDate(currentAlbum?.death_date) || (currentAlbum?.death_year ? `${currentAlbum.death_year}-01-01` : ''));
  const [weddingDate, setWeddingDate] = useState(fmtDate(currentAlbum?.wedding_date) || '');
  const [partner1, setPartner1] = useState(currentAlbum?.partner1_name || '');
  const [partner2, setPartner2] = useState(currentAlbum?.partner2_name || '');
  const [venue, setVenue] = useState(currentAlbum?.venue_name || '');
  const [bio, setBio] = useState(currentAlbum?.biography || '');
  const [tribute, setTribute] = useState('');
  const [tributes, setTributes] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const [error, setError] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [album, setAlbum] = useState(null);
  const [uploadedMedia, setUploadedMedia] = useState([]);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [captionEdit, setCaptionEdit] = useState({});
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [allowTributes, setAllowTributes] = useState(false);
  const [allowWishes, setAllowWishes] = useState(false);
  const [rsvpEnabled, setRsvpEnabled] = useState(false);
  const [rsvpDeadline, setRsvpDeadline] = useState('');
  const [invitationEnabled, setInvitationEnabled] = useState(false);

  const baseSteps = showTypeStep ? ['type', 'details'] : ['details'];
  const settingsSteps = [
    'media',
    'profile',
    'cover',
    'captions',
    'security',
    ...(albumType === 'wedding' ? ['rsvp'] : []),
  ];
  const steps = [...baseSteps, ...settingsSteps, 'review', 'qr'];

  useEffect(() => {
    if (!steps.includes(step)) setStep(steps[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.join('|')]);

  const createdAlbumId = useRef(currentAlbum?.id || null);
  const fileRef = useRef(null);
  const filesRef = useRef([]);
  // Once albumSlotsReady flips (after the /api/albums fetch), re-evaluate the
  // correct opening step and albumType using real quota data — but only once,
  // and only when no draft was restored (which carries its own saved step).
  const stepInitializedRef = useRef(false);

  useEffect(() => {
    if (isEdit) {
      setAlbumSlotsReady(true);
      return;
    }
    let active = true;
    if (!token) {
      setAlbumSlotsReady(true);
      return;
    }
    apiCall('/api/albums', {}, token)
      .then((data) => {
        if (!active) return;
        setExistingAlbums(data.albums || []);
      })
      .catch(() => {
        if (!active) return;
        setExistingAlbums([]);
      })
      .finally(() => {
        if (active) setAlbumSlotsReady(true);
      });
    return () => {
      active = false;
    };
  }, [isEdit]);

  // Once we know actual existing-album counts (albumSlotsReady), commit the correct
  // opening step and albumType. This corrects the initial useState value which was
  // computed before the async /api/albums call returned real slot data.
  // Skipped if a local draft was already restored (it carries its own saved step).
  useEffect(() => {
    if (isEdit || stepInitializedRef.current || !albumSlotsReady) return;
    stepInitializedRef.current = true;
    if (draftRestored) return; // draft already set the step; don't override
    const correctType = (canMakeWedding && !canMakeMemorial)
      ? 'wedding'
      : (canMakeMemorial ? 'memorial' : (canMakeWedding ? 'wedding' : 'memorial'));
    setAlbumType(correctType);
    setStep(canAccessMemorial && canAccessWedding ? 'type' : 'details');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumSlotsReady]);

  useEffect(() => {
    if (isEdit) return;
    if (albumType === 'memorial' && !canMakeMemorial && canMakeWedding) {
      setAlbumType('wedding');
    } else if (albumType === 'wedding' && !canMakeWedding && canMakeMemorial) {
      setAlbumType('memorial');
    }
  }, [albumType, canMakeMemorial, canMakeWedding, isEdit]);

  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => () => {
    filesRef.current.forEach((file) => file.preview && URL.revokeObjectURL(file.preview));
  }, []);

  useEffect(() => {
    if (isEdit) {
      createdAlbumId.current = currentAlbum?.id || null;
      setStep('details');
      setAlbumType(currentAlbum?.type || defaultType);
      setAlbumLabel(currentAlbum?.album_label || '');
      setName(currentAlbum?.name || '');
      setBirthDate(fmtDate(currentAlbum?.birth_date) || (currentAlbum?.birth_year ? `${currentAlbum.birth_year}-01-01` : ''));
      setDeathDate(fmtDate(currentAlbum?.death_date) || (currentAlbum?.death_year ? `${currentAlbum.death_year}-01-01` : ''));
      setWeddingDate(fmtDate(currentAlbum?.wedding_date) || '');
      setPartner1(currentAlbum?.partner1_name || '');
      setPartner2(currentAlbum?.partner2_name || '');
      setVenue(currentAlbum?.venue_name || '');
      setBio(currentAlbum?.biography || '');
      setTributes([]);
      setFiles([]);
      setDraftRestored(false);
      setLastSavedAt(null);
      if (currentAlbum?.id) {
        loadAlbumData(currentAlbum.id).catch(() => {});
      }
      return;
    }
    const draft = parseDraft();
    if (!draft || draft.version !== DRAFT_VERSION) return;
    setStep(steps.includes(draft.step) ? draft.step : (showTypeStep ? 'type' : 'details'));
    setAlbumType(draft.albumType || defaultType);
    setAlbumLabel(draft.albumLabel || '');
    setName(draft.name || '');
    setBirthDate(draft.birthDate || '');
    setDeathDate(draft.deathDate || '');
    setWeddingDate(draft.weddingDate || '');
    setPartner1(draft.partner1 || '');
    setPartner2(draft.partner2 || '');
    setVenue(draft.venue || '');
    setBio(draft.bio || '');
    setTributes(Array.isArray(draft.tributes) ? draft.tributes : []);
    setDraftRestored(true);
    setLastSavedAt(draft.savedAt || null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, currentAlbum?.id]);

  useEffect(() => {
    if (isEdit || typeof window === 'undefined') return;
    const hasContent = [name, birthDate, deathDate, weddingDate, partner1, partner2, venue, bio, albumLabel, tributes.length].some(Boolean);
    if (!hasContent) {
      window.localStorage.removeItem(DRAFT_KEY);
      setLastSavedAt(null);
      return;
    }
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
        version: DRAFT_VERSION, step, albumType, albumLabel, name, birthDate, deathDate,
        weddingDate, partner1, partner2, venue, bio, tributes, savedAt,
      }));
      setLastSavedAt(savedAt);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isEdit, step, albumType, albumLabel, name, birthDate, deathDate, weddingDate, partner1, partner2, venue, bio, tributes]);

  const clearDraft = () => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(DRAFT_KEY);
    setDraftRestored(false);
    setLastSavedAt(null);
  };

  const discardDraft = () => {
    clearDraft();
    // Re-derive the correct type using the real slot data (existingAlbums is populated by now).
    const freshType = (canMakeWedding && !canMakeMemorial)
      ? 'wedding'
      : (canMakeMemorial ? 'memorial' : (canMakeWedding ? 'wedding' : 'memorial'));
    setAlbumType(freshType);
    setStep(canAccessMemorial && canAccessWedding ? 'type' : 'details');
    setAlbumLabel('');
    setName('');
    setBirthDate('');
    setDeathDate('');
    setWeddingDate('');
    setPartner1('');
    setPartner2('');
    setVenue('');
    setBio('');
    setTribute('');
    setTributes([]);
    setFiles((prev) => {
      prev.forEach((file) => file.preview && URL.revokeObjectURL(file.preview));
      return [];
    });
    setAlbum(null);
    setUploadedMedia([]);
    setAvatarPreview(null);
    setCoverPreview(null);
    setCaptionEdit({});
    setPasswordEnabled(false);
    setPasswordValue('');
    setAllowTributes(false);
    setAllowWishes(false);
    setRsvpEnabled(false);
    setRsvpDeadline('');
    setInvitationEnabled(false);
    showToast?.('Local draft cleared');
  };

  const buildAlbumPayload = () => (
    albumType === 'wedding'
      ? { name, biography: bio, type: 'wedding', weddingDate, partner1Name: partner1, partner2Name: partner2, venueName: venue, albumLabel }
      : { name, birthDate, deathDate, biography: bio, type: 'memorial' }
  );

  const loadAlbumData = async (albumId) => {
    if (!albumId || !token) return null;
    const [albumRes, mediaRes] = await Promise.all([
      apiCall(`/api/albums/${albumId}`, {}, token),
      apiCall(`/api/media/${albumId}`, {}, token),
    ]);
    const nextAlbum = albumRes.album;
    setAlbum(nextAlbum);
    setCurrentAlbum?.(nextAlbum);
    setAvatarPreview(nextAlbum.avatar_key ? `${CDN}/${nextAlbum.avatar_key}` : null);
    setCoverPreview(nextAlbum.cover_key ? `${CDN}/${nextAlbum.cover_key}` : null);
    setPasswordEnabled(Boolean(nextAlbum.is_password_protected));
    setPasswordValue('');
    setAllowTributes(Boolean(nextAlbum.allow_public_tributes || nextAlbum.allowPublicTributes));
    setAllowWishes(Boolean(nextAlbum.allow_public_wishes || nextAlbum.allowPublicWishes));
    setInvitationEnabled(Boolean(nextAlbum.invitation_enabled));
    setRsvpEnabled(Boolean(nextAlbum.rsvp_enabled));
    setRsvpDeadline(nextAlbum.rsvp_deadline ? fmtDate(nextAlbum.rsvp_deadline) : '');
    const flatMedia = Array.isArray(mediaRes.media) ? mediaRes.media : [];
    setUploadedMedia(flatMedia.filter((m) => m.type === 'photo' || m.type === 'video'));
    return nextAlbum;
  };

  const ensureAlbumDraft = async (shouldUpdate = true) => {
    if (!token) throw new Error('You must be logged in to create an album.');
    const payload = buildAlbumPayload();
    if (createdAlbumId.current) {
      if (shouldUpdate) {
        await apiCall(`/api/albums/${createdAlbumId.current}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        }, token);
      }
      return loadAlbumData(createdAlbumId.current);
    }
    const response = await apiCall('/api/albums', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
    createdAlbumId.current = response.album?.id || null;
    return loadAlbumData(createdAlbumId.current);
  };

  const uploadPendingMedia = async () => {
    if (!files.length) return;
    const albumRow = await ensureAlbumDraft(true);
    const albumId = albumRow?.id || createdAlbumId.current;
    if (!albumId) throw new Error('Album not created yet.');
    for (let index = 0; index < files.length; index += 1) {
      const item = files[index];
      setUploadLabel(`Uploading ${item.name}... (${index + 1}/${files.length})`);
      setUploadProgress(Math.round((index / files.length) * 100));
      await uploadMediaFile(albumId, item.file, token, (loaded, total) => {
        if (total) setUploadProgress(Math.round((loaded / total) * 100));
      });
    }
    setFiles((prev) => {
      prev.forEach((file) => file.preview && URL.revokeObjectURL(file.preview));
      return [];
    });
    setUploadLabel('');
    setUploadProgress(0);
    await loadAlbumData(albumId);
  };

  const saveCaption = async (mediaItem) => {
    const albumId = createdAlbumId.current || album?.id;
    if (!albumId) return;
    const text = captionEdit[mediaItem.id] ?? mediaItem.caption ?? '';
    await apiCall(`/api/media/${albumId}/${mediaItem.id}`, {
      method: 'PUT',
      body: JSON.stringify({ caption: text }),
    }, token);
    setUploadedMedia((prev) => prev.map((m) => (m.id === mediaItem.id ? { ...m, caption: text } : m)));
    setCaptionEdit((prev) => ({ ...prev, [mediaItem.id]: '' }));
  };

  const saveSecuritySettings = async () => {
    const albumRow = await ensureAlbumDraft(true);
    const albumId = albumRow?.id || createdAlbumId.current || album?.id;
    if (!albumId) return;
    if (passwordEnabled && !passwordValue && !(albumRow?.is_password_protected || album?.is_password_protected)) {
      throw new Error('Please enter a password to enable protection.');
    }
    if (!passwordEnabled || passwordValue) {
      await apiCall(`/api/albums/${albumId}/password`, {
        method: 'PUT',
        body: JSON.stringify({ isPasswordProtected: passwordEnabled, password: passwordEnabled ? passwordValue : '' }),
      }, token);
    }
    await apiCall(`/api/albums/${albumId}`, {
      method: 'PUT',
      body: JSON.stringify({
        allowPublicTributes: albumType === 'wedding' ? undefined : allowTributes,
        allowPublicWishes: albumType === 'wedding' ? allowWishes : undefined,
      }),
    }, token);
    setPasswordValue('');
    showToast?.('Security settings saved');
  };

  const saveRsvpSettings = async () => {
    const albumRow = await ensureAlbumDraft(true);
    const albumId = albumRow?.id || createdAlbumId.current || album?.id;
    if (!albumId) return;
    const invitationOn = invitationEnabled || rsvpEnabled;
    await apiCall(`/api/albums/${albumId}/invitation`, {
      method: 'PUT',
      body: JSON.stringify({
        invitationEnabled: invitationOn,
        rsvpEnabled,
        rsvpDeadline: rsvpDeadline || null,
      }),
    }, token);
    showToast?.('RSVP settings saved');
  };

  const validateDetails = () => {
    if (!isEdit) {
      if (albumType === 'wedding' && !canMakeWedding) {
        return canAccessWedding
          ? 'Your Wedding album quota is full. Upgrade or increase Wedding album capacity to add another.'
          : 'A Wedding subscription is required to create a wedding album.';
      }
      if (albumType !== 'wedding' && !canMakeMemorial) {
        return canAccessMemorial
          ? 'Your Memorial album quota is full. Upgrade or increase Memorial album capacity to add another.'
          : 'A Memorial subscription is required to create a memorial album.';
      }
    }
    if (!name.trim()) return 'Album name is required.';
    if (albumType === 'wedding' && !albumLabel) return 'Choose a wedding album category.';
    if (albumType !== 'wedding' && birthDate && deathDate && new Date(deathDate) < new Date(birthDate)) {
      return 'Date of passing cannot be earlier than date of birth.';
    }
    return '';
  };

  const goNext = async () => {
    const issue = step === 'details' || step === 'review' ? validateDetails() : '';
    if (issue) { setError(issue); return; }
    setError('');
    const next = steps[steps.indexOf(step) + 1];
    if (!next) return;
    setLoading(true);
    try {
      if (step === 'details') {
        await ensureAlbumDraft(true);
      }
      if (step === 'media') {
        await uploadPendingMedia();
      }
      if (step === 'security') {
        await saveSecuritySettings();
      }
      if (step === 'rsvp') {
        await saveRsvpSettings();
      }
      setStep(next);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const addTribute = () => {
    if (!tribute.trim()) return;
    setTributes((prev) => [...prev, { id: Date.now(), text: tribute.trim() }]);
    setTribute('');
  };

  const handleFiles = (event) => {
    const picked = Array.from(event.target.files || []).map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      preview: URL.createObjectURL(file),
      typeCategory: file.type.startsWith('video/') ? 'video' : 'photo',
    }));
    if (picked.length) setFiles((prev) => [...prev, ...picked]);
    event.target.value = '';
  };

  const save = async (publish = true) => {
    const issue = validateDetails();
    if (issue) { setError(issue); return; }
    setError('');
    setLoading(true);
    try {
      const albumRow = await ensureAlbumDraft(true);
      const albumId = albumRow?.id || createdAlbumId.current;

      await uploadPendingMedia();

      for (const item of tributes) {
        await apiCall(`/api/media/${albumId}/tribute`, { method: 'POST', body: JSON.stringify({ text: item.text }) }, token);
      }
      clearDraft();
      if (publish) {
        await apiCall(`/api/albums/${albumId}`, { method: 'PUT', body: JSON.stringify({ isPublished: true }) }, token);
        const refreshed = await loadAlbumData(albumId);
        setCurrentAlbum({ ...(refreshed || albumRow), is_published: true });
        setStep('qr');
      } else {
        setCurrentAlbum(albumRow);
        showToast?.('Album saved as draft');
        setPage('dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stepLabel = {
    type: 'Type',
    details: 'Details',
    media: 'Media',
    profile: 'Profile',
    cover: 'Cover',
    captions: 'Captions',
    security: 'Security',
    rsvp: 'RSVP',
    review: 'Review',
    qr: 'QR',
  };
  const summaryName = albumType === 'wedding' ? [partner1, partner2].filter(Boolean).join(' & ') || name : name;
  const memorialRemaining = getRemainingAlbumSlots(user, existingAlbums, 'memorial');
  const weddingRemaining = getRemainingAlbumSlots(user, existingAlbums, 'wedding');
  const pendingMediaCount = files.length;
  const uploadedMediaCount = uploadedMedia.length;
  const totalMediaCount = pendingMediaCount + uploadedMediaCount;
  const totalVideoCount = uploadedMedia.filter((m) => m.type === 'video').length
    + files.filter((file) => file.typeCategory === 'video').length;

  if (!albumSlotsReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '45vh' }}>
        <Spinner dark />
      </div>
    );
  }

  return (
    <div className="create-page">
      <div className="create-inner fade-up">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#DB2777', marginBottom: '0.3rem' }}>
              Step {steps.indexOf(step) + 1} of {steps.length}
            </div>
            <h1 className="create-title" style={{ marginBottom: '0.45rem' }}>{isEdit ? `Edit ${albumType === 'wedding' ? 'Wedding' : 'Memorial'} Album` : `Create ${albumType === 'wedding' ? 'Wedding' : 'Memorial'} Album`}</h1>
            <p className="create-sub" style={{ marginBottom: 0 }}>A guided setup with local draft restore so users can pause and come back safely.</p>
          </div>
          {!isEdit && (
            <div style={{ minWidth: '220px', textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>{lastSavedAt ? `Local draft saved at ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Draft not saved locally yet'}</div>
              {(draftRestored || lastSavedAt) && <button type="button" onClick={discardDraft} style={{ marginTop: '0.45rem', border: 'none', background: 'transparent', color: '#B45309', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Clear Local Draft</button>}
            </div>
          )}
        </div>

        {draftRestored && !isEdit && <div className="alert alert-info">Restored your draft. Files need to be selected again because browsers do not persist local file inputs.</div>}
        {error && <div className="alert alert-error">{error}</div>}
        {loading && uploadLabel && (
          <div className="alert alert-info">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}><span>{uploadLabel}</span><span>{uploadProgress}%</span></div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${uploadProgress}%` }} /></div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {steps.map((item, index) => (
            <button key={item} type="button" onClick={() => index <= steps.indexOf(step) && setStep(item)} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: `1px solid ${item === step ? '#DB2777' : index < steps.indexOf(step) ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`, background: item === step ? '#FDF2F8' : index < steps.indexOf(step) ? '#F0FDF4' : '#fff', color: item === step ? '#BE185D' : index < steps.indexOf(step) ? '#166534' : '#666', borderRadius: 14, padding: '0.85rem 1rem', cursor: index <= steps.indexOf(step) ? 'pointer' : 'default' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Step {index + 1}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{index < steps.indexOf(step) ? 'Done - ' : ''}{stepLabel[item]}</div>
            </button>
          ))}
        </div>

        {step === 'type' && (
          <div className="form-card">
            <div className="form-card-title">Choose Your Album Type</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1rem' }}>
              {[{
                id: 'memorial',
                icon: 'M',
                label: 'Memorial',
                desc: canAccessMemorial
                  ? (canMakeMemorial
                    ? `Biography, tributes, and memories. ${memorialRemaining === Infinity ? 'Unlimited slots available.' : `${memorialRemaining} slot${memorialRemaining === 1 ? '' : 's'} left.`}`
                    : 'Your Memorial album quota is full for the current plan.')
                  : 'Requires an active Memorial subscription.',
                enabled: canMakeMemorial,
              }, {
                id: 'wedding',
                icon: 'W',
                label: 'Wedding',
                desc: canAccessWedding
                  ? (canMakeWedding
                    ? `Celebration albums for every chapter. ${weddingRemaining === Infinity ? 'Unlimited slots available.' : `${weddingRemaining} slot${weddingRemaining === 1 ? '' : 's'} left.`}`
                    : 'Your Wedding album quota is full for the current plan.')
                  : 'Requires an active Wedding subscription.',
                enabled: canMakeWedding,
              }].map((option) => (
                <button key={option.id} type="button" disabled={!option.enabled} onClick={() => option.enabled && setAlbumType(option.id)} style={{ border: `2px solid ${albumType === option.id ? '#DB2777' : 'var(--border)'}`, borderRadius: 16, padding: '1.1rem', textAlign: 'left', background: albumType === option.id ? '#FDF2F8' : '#fff', opacity: option.enabled ? 1 : 0.45, cursor: option.enabled ? 'pointer' : 'not-allowed' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>{option.icon}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>{option.label}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666', lineHeight: 1.6 }}>{option.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'details' && (
          <>
            <div className="form-card">
              <div className="form-card-title">{albumType === 'wedding' ? 'Wedding Details' : 'About the Person'}</div>
              {albumType === 'wedding' && (
                <div className="form-group">
                  <label className="form-label">Album Category *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '0.75rem' }}>
                    {WEDDING_ALBUM_LABELS.map((label) => (
                      <button key={label.value} type="button" onClick={() => setAlbumLabel(label.value)} style={{ border: `2px solid ${albumLabel === label.value ? '#DB2777' : 'var(--border)'}`, borderRadius: 12, padding: '1rem', background: albumLabel === label.value ? '#FDF2F8' : '#fff', textAlign: 'left', cursor: 'pointer' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>{label.icon}</div>
                        <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{label.label}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{label.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{albumType === 'wedding' ? 'Album Name *' : 'Full Name *'}</label>
                <input className="form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder={albumType === 'wedding' ? 'e.g. Liana & James Wedding' : 'e.g. Margaret Rose Chen'} />
              </div>
              {albumType === 'wedding' ? (
                <>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Partner 1</label><input className="form-input" value={partner1} onChange={(event) => setPartner1(event.target.value)} placeholder="First partner name" /></div>
                    <div className="form-group"><label className="form-label">Partner 2</label><input className="form-input" value={partner2} onChange={(event) => setPartner2(event.target.value)} placeholder="Second partner name" /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Wedding Date</label><input className="form-input" type="date" value={weddingDate} onChange={(event) => setWeddingDate(event.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Venue</label><input className="form-input" value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Where was it celebrated?" /></div>
                  </div>
                </>
              ) : (
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Date of Birth</label><input className="form-input" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Date of Passing</label><input className="form-input" type="date" value={deathDate} onChange={(event) => setDeathDate(event.target.value)} /></div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{albumType === 'wedding' ? 'Love Story / Notes' : 'Biography'}</label>
                <RichTextEditor content={bio} onChange={setBio} placeholder={albumType === 'wedding' ? 'Share the story behind this album...' : 'A few sentences about who they were and what they meant to you...'} />
              </div>
            </div>
            <div className="form-card" style={{ background: '#FAFAF9' }}>
              <div className="form-card-title">What Happens Next</div>
              <div style={{ display: 'grid', gap: '0.7rem', fontSize: '0.9rem', color: '#57534E' }}>
                <div>- Add photos or videos in the next step.</div>
                <div>- Save a draft anytime if you need to stop here.</div>
                <div>- Review everything before publishing and generating the QR page.</div>
              </div>
            </div>
          </>
        )}

        {step === 'media' && (
          <>
            <div className="form-card">
              <div className="form-card-title">Upload Memories</div>
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={handleFiles} />
              <button type="button" className="upload-zone" onClick={() => fileRef.current?.click()} style={{ width: '100%' }}>
                <div className="upload-icon">Up</div>
                <div className="upload-text"><strong>Click to upload</strong> photos or videos<br />JPG / PNG / WebP / MP4 / MOV supported</div>
              </button>
              {!isEdit && <div style={{ marginTop: '0.9rem', padding: '0.8rem 0.95rem', borderRadius: 10, background: '#FFF7ED', color: '#9A3412', fontSize: '0.82rem', lineHeight: 1.6 }}>Draft text is saved locally while you work. Files stay in the browser only, so re-select them if you leave this page.</div>}
              {files.length > 0 && (
                <div className="media-grid" style={{ marginTop: '1rem' }}>
                  {files.map((file) => (
                    <div className="media-thumb" key={file.id}>
                      {file.typeCategory === 'video' ? <video src={file.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted /> : <img src={file.preview} alt={file.name} />}
                      <button className="media-remove" onClick={() => setFiles((prev) => { const target = prev.find((item) => item.id === file.id); if (target?.preview) URL.revokeObjectURL(target.preview); return prev.filter((item) => item.id !== file.id); })}>x</button>
                    </div>
                  ))}
                </div>
              )}
              {uploadedMedia.length > 0 && (
                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#666', marginBottom: '0.5rem' }}>
                    Already Uploaded
                  </div>
                  <div className="media-grid">
                    {uploadedMedia.slice(0, 8).map((media) => (
                      <div className="media-thumb" key={media.id}>
                        {media.type === 'video'
                          ? <video src={media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                          : <img src={media.url || (media.r2_key ? `${CDN}/${media.r2_key}` : '')} alt={media.caption || media.file_name || 'Uploaded media'} />}
                      </div>
                    ))}
                  </div>
                  {uploadedMedia.length > 8 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
                      {uploadedMedia.length - 8} more uploaded items available in the next steps.
                    </div>
                  )}
                </div>
              )}
            </div>
            {albumType !== 'wedding' && (
              <div className="form-card">
                <div className="form-card-title">Written Tributes</div>
                {tributes.length > 0 && <div className="tribute-list">{tributes.map((item) => <div className="tribute-item" key={item.id}><span>"{item.text}"</span><button className="tribute-remove" onClick={() => setTributes((prev) => prev.filter((entry) => entry.id !== item.id))}>x</button></div>)}</div>}
                <div className="add-tribute-row">
                  <textarea className="form-textarea" rows="2" value={tribute} onChange={(event) => setTribute(event.target.value)} placeholder='Add a tribute or memory...' style={{ flex: 1 }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); addTribute(); } }} />
                  <button className="add-btn" onClick={addTribute}>+ Add</button>
                </div>
              </div>
            )}
          </>
        )}

        {step === 'profile' && (
          <div className="form-card">
            <div className="form-card-title">Profile Photo</div>
            <p className="create-sub" style={{ marginTop: 0 }}>This portrait shows across your dashboard and public album.</p>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border)', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="Album avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '2rem', color: '#999' }}>{name?.[0]?.toUpperCase() || 'A'}</span>}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  id="album-avatar-upload"
                  style={{ display: 'none' }}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setLoading(true);
                    try {
                      const albumRow = await ensureAlbumDraft(true);
                      const albumId = albumRow?.id || createdAlbumId.current;
                      const formData = new FormData();
                      formData.append('file', file);
                      const data = await uploadFile(`/api/albums/${albumId}/avatar`, formData, token);
                      const url = data.avatarUrl || (data.avatarKey ? `${CDN}/${data.avatarKey}` : null);
                      setAvatarPreview(url);
                      await loadAlbumData(albumId);
                      showToast?.('Profile photo updated');
                    } catch (err) {
                      setError(err.message || 'Upload failed.');
                    } finally {
                      setLoading(false);
                      event.target.value = '';
                    }
                  }}
                />
                <button type="button" className="btn-secondary" onClick={() => document.getElementById('album-avatar-upload')?.click()} disabled={loading}>
                  {loading ? 'Uploading...' : 'Upload Profile Photo'}
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ marginLeft: '0.6rem' }}
                    onClick={async () => {
                      const albumId = createdAlbumId.current || album?.id;
                      if (!albumId) return;
                      setLoading(true);
                      try {
                        await apiCall(`/api/albums/${albumId}`, { method: 'PUT', body: JSON.stringify({ avatarKey: null }) }, token);
                        setAvatarPreview(null);
                        await loadAlbumData(albumId);
                        showToast?.('Profile photo removed');
                      } catch (err) {
                        setError(err.message || 'Failed to remove photo.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'cover' && (
          <div className="form-card">
            <div className="form-card-title">Cover Photo</div>
            <p className="create-sub" style={{ marginTop: 0 }}>This appears as the banner image for the album.</p>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 16, border: '2px dashed var(--border)', overflow: 'hidden', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {coverPreview
                  ? <img src={coverPreview} alt="Album cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: '#999' }}>No cover photo selected</span>}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  id="album-cover-upload"
                  style={{ display: 'none' }}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setLoading(true);
                    try {
                      const albumRow = await ensureAlbumDraft(true);
                      const albumId = albumRow?.id || createdAlbumId.current;
                      const formData = new FormData();
                      formData.append('file', file);
                      const data = await uploadFile(`/api/albums/${albumId}/cover`, formData, token);
                      const url = data.coverUrl || (data.coverKey ? `${CDN}/${data.coverKey}` : null);
                      setCoverPreview(url);
                      await loadAlbumData(albumId);
                      showToast?.('Cover photo updated');
                    } catch (err) {
                      setError(err.message || 'Upload failed.');
                    } finally {
                      setLoading(false);
                      event.target.value = '';
                    }
                  }}
                />
                <button type="button" className="btn-secondary" onClick={() => document.getElementById('album-cover-upload')?.click()} disabled={loading}>
                  {loading ? 'Uploading...' : 'Upload Cover Photo'}
                </button>
                {coverPreview && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ marginLeft: '0.6rem' }}
                    onClick={async () => {
                      const albumId = createdAlbumId.current || album?.id;
                      if (!albumId) return;
                      setLoading(true);
                      try {
                        await apiCall(`/api/albums/${albumId}`, { method: 'PUT', body: JSON.stringify({ coverKey: null }) }, token);
                        setCoverPreview(null);
                        await loadAlbumData(albumId);
                        showToast?.('Cover photo removed');
                      } catch (err) {
                        setError(err.message || 'Failed to remove cover.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'captions' && (
          <div className="form-card">
            <div className="form-card-title">Captions</div>
            <p className="create-sub" style={{ marginTop: 0 }}>Add short captions to make each photo or video more meaningful.</p>
            {uploadedMedia.length === 0 && (
              <div className="alert alert-info">Upload photos or videos first, then add captions here.</div>
            )}
            {uploadedMedia.length > 0 && (
              <div style={{ display: 'grid', gap: '0.9rem' }}>
                {uploadedMedia.map((media) => (
                  <div key={media.id} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '0.9rem', alignItems: 'center' }}>
                    <div style={{ width: 96, height: 72, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      {media.type === 'video'
                        ? <video src={media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                        : <img src={media.url || (media.r2_key ? `${CDN}/${media.r2_key}` : '')} alt={media.file_name || 'Media'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div>
                      <input
                        className="form-input"
                        placeholder="Add a caption..."
                        value={captionEdit[media.id] !== undefined ? captionEdit[media.id] : (media.caption || '')}
                        onChange={(event) => setCaptionEdit((prev) => ({ ...prev, [media.id]: event.target.value }))}
                      />
                      <button type="button" className="btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => saveCaption(media)}>
                        Save Caption
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'security' && (
          <div className="form-card">
            <div className="form-card-title">Security & Visibility</div>
            <p className="create-sub" style={{ marginTop: 0 }}>Control who can access this album and how people can contribute.</p>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <div className="form-label">Password Protection</div>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <button type="button" className={`toggle${passwordEnabled ? ' on' : ''}`} onClick={() => setPasswordEnabled((v) => !v)} />
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>{passwordEnabled ? 'Password protection is ON' : 'Password protection is OFF'}</span>
                </div>
                {passwordEnabled && (
                  <input className="form-input" type="password" value={passwordValue} onChange={(event) => setPasswordValue(event.target.value)} placeholder="Set a password" />
                )}
              </div>
              {albumType === 'wedding' ? (
                <div>
                  <div className="form-label">Guest Wishes</div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <button type="button" className={`toggle${allowWishes ? ' on' : ''}`} onClick={() => setAllowWishes((v) => !v)} />
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>{allowWishes ? 'Guest wishes are ON' : 'Guest wishes are OFF'}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="form-label">Public Tributes</div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <button type="button" className={`toggle${allowTributes ? ' on' : ''}`} onClick={() => setAllowTributes((v) => !v)} />
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>{allowTributes ? 'Public tributes are ON' : 'Public tributes are OFF'}</span>
                  </div>
                </div>
              )}
              <button type="button" className="btn-secondary" onClick={saveSecuritySettings} disabled={loading}>
                {loading ? 'Saving...' : 'Save Security'}
              </button>
            </div>
          </div>
        )}

        {step === 'rsvp' && albumType === 'wedding' && (
          <div className="form-card">
            <div className="form-card-title">RSVP Settings</div>
            <p className="create-sub" style={{ marginTop: 0 }}>Let guests RSVP from your wedding invitation page.</p>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <div className="form-label">Invitation Page</div>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  <button type="button" className={`toggle${invitationEnabled ? ' on' : ''}`} onClick={() => setInvitationEnabled((v) => !v)} />
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>{invitationEnabled ? 'Invitation page is ON' : 'Invitation page is OFF'}</span>
                </div>
              </div>
              <div>
                <div className="form-label">RSVP</div>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  <button type="button" className={`toggle${rsvpEnabled ? ' on' : ''}`} onClick={() => setRsvpEnabled((v) => !v)} />
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>{rsvpEnabled ? 'RSVP is ON' : 'RSVP is OFF'}</span>
                </div>
              </div>
              {rsvpEnabled && (
                <div>
                  <label className="form-label">RSVP Deadline</label>
                  <input className="form-input" type="date" value={rsvpDeadline} onChange={(event) => setRsvpDeadline(event.target.value)} />
                </div>
              )}
              <button type="button" className="btn-secondary" onClick={saveRsvpSettings} disabled={loading}>
                {loading ? 'Saving...' : 'Save RSVP'}
              </button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <>
            <div className="form-card">
              <div className="form-card-title">Review Before Publishing</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0.9rem' }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '1rem' }}><div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#888', marginBottom: '0.35rem' }}>Album</div><div style={{ fontWeight: 700, fontSize: '1rem' }}>{summaryName || 'Untitled Album'}</div><div style={{ marginTop: '0.45rem', color: '#666', fontSize: '0.85rem' }}>{albumType === 'wedding' ? 'Wedding album' : 'Memorial album'}</div></div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '1rem' }}><div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#888', marginBottom: '0.35rem' }}>Media</div><div style={{ fontWeight: 700, fontSize: '1rem' }}>{totalMediaCount} file{totalMediaCount === 1 ? '' : 's'} ready</div><div style={{ marginTop: '0.45rem', color: '#666', fontSize: '0.85rem' }}>{albumType === 'wedding' ? `${totalVideoCount} videos included` : `${tributes.length} tributes included`}</div></div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '1rem' }}><div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#888', marginBottom: '0.35rem' }}>Draft Status</div><div style={{ fontWeight: 700, fontSize: '1rem' }}>{lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not saved locally yet'}</div><div style={{ marginTop: '0.45rem', color: '#666', fontSize: '0.85rem' }}>Publishing makes the album live and QR-ready.</div></div>
              </div>
            </div>
            <div className="form-card" style={{ background: '#FAFAF9' }}>
              <div className="form-card-title">Checklist</div>
              <div style={{ display: 'grid', gap: '0.65rem', fontSize: '0.88rem' }}>
                <div>{name.trim() ? 'Done' : 'Needs attention'}: Album name added</div>
                <div>{albumType === 'wedding' ? (albumLabel ? 'Done' : 'Needs attention') : 'Done'}: {albumType === 'wedding' ? 'Wedding category selected' : 'Dates reviewed'}</div>
                <div>{files.length > 0 ? 'Done' : 'Optional'}: Add media now or continue and upload later from settings</div>
                <div>Done: You can keep editing after publishing</div>
              </div>
            </div>
          </>
        )}

        {step === 'qr' && (
          <QRPage currentAlbum={currentAlbum || album} setPage={setPage} user={user} />
        )}

        {step !== 'qr' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => setPage(isEdit ? 'settings' : 'dashboard')} disabled={loading}>Exit</button>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {steps.indexOf(step) > 0 && <button className="btn-secondary" onClick={() => setStep(steps[steps.indexOf(step) - 1])} disabled={loading}>Back</button>}
              {step !== 'review' && <button className="btn-secondary" onClick={() => save(false)} disabled={loading || !name.trim()}>{loading ? '...' : 'Save Draft'}</button>}
              {step === 'review'
                ? <>
                    <button className="btn-secondary" onClick={() => save(false)} disabled={loading || !name.trim()}>{loading ? '...' : 'Save Draft'}</button>
                    <button className="btn-primary" onClick={() => save(true)} disabled={loading}>{loading ? <><Spinner dark />{uploadLabel || 'Saving...'}</> : 'Publish & Get QR'}</button>
                  </>
                : <button className="btn-primary" onClick={goNext} disabled={loading}>Next</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
