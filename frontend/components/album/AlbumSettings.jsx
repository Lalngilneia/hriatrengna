/**
 * components/album/AlbumSettings.jsx
 * Album settings page with all sub-tabs:
 *   General, Profile, Cover, Media, Biography, Captions,
 *   Theme, Music, Security, WeddingDetails, GuestWishes
 *
 * Sub-tab components are co-located in this file because they are
 * tightly coupled to AlbumSettings state and not used elsewhere.
 * If any tab grows beyond ~150 lines it should be split further.
 */

import { useState, useEffect, useRef } from 'react';
import { apiCall, CDN, API } from '../../lib/api';
import { getToken } from '../../lib/auth';
import {
  getAlbumFeatureAccess,
  getMediaLimitsForType,
  MEMORIAL_THEMES, WEDDING_THEMES,
} from '../../lib/constants';
import Spinner from '../shared/Spinner';
import InvitationTab from './InvitationTab';
import RsvpTab       from './RsvpTab';
import RichTextEditor from '../shared/RichTextEditor';

function AlbumSettings({ user, setPage, currentAlbum, setCurrentAlbum, showToast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [album, setAlbum] = useState(null);
  const [bio, setBio] = useState("");
  
  // Album edit fields
  const [albumName, setAlbumName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [partner1, setPartner1] = useState("");
  const [partner2, setPartner2] = useState("");
  const [venue, setVenue] = useState("");
  
  const [avatarKey, setAvatarKey] = useState(null);
  const [coverKey, setCoverKey] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [allMedia, setAllMedia] = useState([]);
  const [activeTab, setActiveTab] = useState("general");
  const [savingCaption, setSavingCaption] = useState(null);
  const [captionEdit, setCaptionEdit] = useState({});
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingMedia, setDeletingMedia] = useState(null);
  const avatarInputRef = useRef();
  const coverInputRef = useRef();
  const token = getToken();
  const isWedding = album?.type === 'wedding';
  const albumType = isWedding ? 'wedding' : 'memorial';
  const mediaLimits = getMediaLimitsForType(user, albumType);
  const featureAccess = getAlbumFeatureAccess(user, albumType);
  const photoCount = allMedia.filter(m => m.type === 'photo').length;
  const videoCount = allMedia.filter(m => m.type === 'video').length;

  useEffect(() => {
    if (!currentAlbum?.id) {
      setPage("dashboard");
      return;
    }
    loadAlbumData();
  }, [currentAlbum?.id]);

  const loadAlbumData = async () => {
    try {
      const [albumRes, mediaRes] = await Promise.all([
        apiCall(`/api/albums/${currentAlbum.id}`, {}, token),
        apiCall(`/api/media/${currentAlbum.id}`, {}, token),
      ]);
      setAlbum(albumRes.album);
      setBio(albumRes.album.biography || "");
      setAvatarKey(albumRes.album.avatar_key);
      setCoverKey(albumRes.album.cover_key);
      setAvatarPreview(albumRes.album.avatar_key ? `${CDN}/${albumRes.album.avatar_key}` : null);
      setCoverPreview(albumRes.album.cover_key ? `${CDN}/${albumRes.album.cover_key}` : null);
      // media.list returns flat array — filter by type
      const flatMedia = Array.isArray(mediaRes.media) ? mediaRes.media : [];
      setAllMedia(flatMedia.filter(m => m.type === 'photo' || m.type === 'video'));
      
      // Set edit fields
      setAlbumName(albumRes.album.name || "");
      setBirthDate(albumRes.album.birth_date ? albumRes.album.birth_date.split('T')[0] : "");
      setDeathDate(albumRes.album.death_date ? albumRes.album.death_date.split('T')[0] : "");
      setWeddingDate(albumRes.album.wedding_date ? albumRes.album.wedding_date.split('T')[0] : "");
      setPartner1(albumRes.album.partner1_name || "");
      setPartner2(albumRes.album.partner2_name || "");
      setVenue(albumRes.album.venue_name || "");
    } catch (err) {
      setError("Failed to load album data");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/api/albums/${currentAlbum.id}/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setAvatarKey(data.avatarKey);
      setAvatarPreview(data.avatarUrl);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/api/albums/${currentAlbum.id}/cover`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setCoverKey(data.coverKey);
      setCoverPreview(data.coverUrl);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingCover(false);
    }
  };

  const removeAvatar = () => {
    setAvatarKey(null);
    setAvatarPreview(null);
  };

  const removeCover = () => {
    setCoverKey(null);
    setCoverPreview(null);
  };

  const saveChanges = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      // Build update body based on album type
      const updateBody = {
        biography: bio,
        avatarKey: avatarKey,
        coverKey: coverKey,
      };
      
      // Add album-specific fields
      if (isWedding) {
        updateBody.name = albumName;
        updateBody.weddingDate = weddingDate || null;
        updateBody.partner1Name = partner1 || null;
        updateBody.partner2Name = partner2 || null;
        updateBody.venueName = venue || null;
      } else {
        updateBody.name = albumName;
        updateBody.birthDate = birthDate || null;
        updateBody.deathDate = deathDate || null;
      }
      
      await apiCall(`/api/albums/${currentAlbum.id}`, {
        method: "PUT",
        body: JSON.stringify(updateBody),
      }, token);
      const updated = await apiCall(`/api/albums/${currentAlbum.id}`, {}, token);
      setAlbum(updated.album);
      setCurrentAlbum(updated.album);
      setSuccess("Saved successfully!");
      showToast?.("Changes saved!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveCaption = async (mediaItem) => {
    setSavingCaption(mediaItem.id);
    try {
      const res = await fetch(`${API}/api/media/${currentAlbum.id}/${mediaItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ caption: captionEdit[mediaItem.id] || "" }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      setAllMedia(prev => prev.map(m => m.id === mediaItem.id ? { ...m, caption: data.media.caption } : m));
      setCaptionEdit(prev => ({ ...prev, [mediaItem.id]: "" }));
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingCaption(null);
    }
  };

  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setUploadingMedia(true);
    setUploadProgress(0);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const type = file.type.startsWith('image/') ? 'photo' : file.type.startsWith('video/') ? 'video' : 'audio';
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        
        const res = await fetch(`${API}/api/media/${currentAlbum.id}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Failed to upload ${file.name}`);
        
        setAllMedia(prev => [...prev, { ...data.media, url: data.media.url }]);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      showToast?.(`${files.length} file(s) uploaded successfully`);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingMedia(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const deleteMedia = async (mediaId) => {
    if (!confirm('Are you sure you want to delete this media? This cannot be undone.')) return;
    
    setDeletingMedia(mediaId);
    try {
      const res = await fetch(`${API}/api/media/${currentAlbum.id}/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
      setAllMedia(prev => prev.filter(m => m.id !== mediaId));
      showToast?.('Media deleted');
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingMedia(null);
    }
  };

  if (loading) return (
    <div style={{minHeight:'50vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center'}}><Spinner dark /> <p style={{marginTop:'1rem',color:'#666'}}>Loading...</p></div>
    </div>
  );

  const handlePreview = () => {
    setCurrentAlbum(album);
    setPage("public-view");
  };

  return (
    <div className="subpage">
      <div className="subsettings-shell">
        {/* HEADER */}
        <div className="subpage-header" style={{marginBottom:'1.25rem'}}>
          <div className="subpage-header-copy">
            <button type="button" className="subpage-back" onClick={() => setPage("dashboard")}>
              ← Back
            </button>
            <div className="subpage-eyebrow">Album Settings</div>
            <h1 className="subpage-title" style={{margin:0}}>Album Settings</h1>
            <p className="subpage-sub" style={{marginTop:'0.25rem'}}>Customize {album?.name}</p>
          </div>
          <div className="subpage-actions">
            <button type="button"
              onClick={handlePreview}
              className="subdash-btn ghost"
            >
              👁 Preview
            </button>
            <button type="button"
              onClick={saveChanges} 
              disabled={saving}
              className="subdash-btn primary"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{marginBottom:'1rem'}}>{error}</div>}
        {success && <div className="alert alert-success" style={{marginBottom:'1rem'}}>{success}</div>}

        {/* TABS */}
        <div className="subsettings-tabs" style={{marginBottom:'1.5rem'}}>
          {[
            {id:'general',   label:'General',   icon:'⚙️'},
            {id:'profile',   label:'Profile',   icon:'👤'},
            {id:'cover',     label:'Cover',      icon:'🖼️'},
            {id:'media',     label:'Media',      icon:'📷'},
            {id:'biography', label:'About',      icon:'✍️'},
            {id:'captions',  label:'Captions',   icon:'📝'},
            // Use featureAccess.canChangeTheme (derived from the active subscription
            // object) instead of hard-coding legacy plan slugs. This correctly handles
            // custom plans, dual-subscriptions, and the wedding/memorial plan fields.
            ...(featureAccess?.canChangeTheme ? [{id:'theme', label:'Theme', icon:'🎨'}] : []),
            ...(featureAccess?.audioEnabled ? [{id:'music', label:'Music', icon:'🎵'}] : []),
            {id:'security',  label:'Security',   icon:'🔒'},
            ...(album?.type === 'wedding' ? [
              {id:'wedding-details', label:'Wedding',    icon:'💍'},
              {id:'wishes',          label:'Wishes',     icon:'💌'},
              {id:'invitation',      label:'Invitation', icon:'✉️'},
              {id:'rsvps',           label:'RSVPs',      icon:'📋'},
            ] : []),
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`subsettings-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <div className="subpage-card pad">
            <h2 style={{fontSize:'1.1rem',fontWeight:600,color:'#1a1a1a',marginBottom:'0.25rem'}}>
              {isWedding ? '💍 Album Details' : '🕯 Album Details'}
            </h2>
            <p className="subpage-section-sub">Edit the core details that shape this album everywhere it appears.</p>
            
            <div style={{display:'grid',gap:'1.25rem'}}>
              <div>
                <label style={{display:'block',fontSize:'0.85rem',fontWeight:500,color:'#1a1a1a',marginBottom:'0.4rem'}}>
                  {isWedding ? 'Album Name *' : 'Full Name *'}
                </label>
                <input 
                  className="form-input"
                  placeholder={isWedding ? 'e.g. Liana & James Wedding' : 'e.g. Margaret Rose Chen'}
                  value={albumName}
                  onChange={e => setAlbumName(e.target.value)}
                />
              </div>

              {isWedding ? (
                <>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
                    <div>
                      <label style={{display:'block',fontSize:'0.85rem',fontWeight:500,color:'#1a1a1a',marginBottom:'0.4rem'}}>Partner 1 Name</label>
                      <input className="form-input" placeholder="e.g. Liana" value={partner1} onChange={e => setPartner1(e.target.value)} />
                    </div>
                    <div>
                      <label style={{display:'block',fontSize:'0.85rem',fontWeight:500,color:'#1a1a1a',marginBottom:'0.4rem'}}>Partner 2 Name</label>
                      <input className="form-input" placeholder="e.g. James" value={partner2} onChange={e => setPartner2(e.target.value)} />
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
                    <div>
                      <label style={{display:'block',fontSize:'0.85rem',fontWeight:500,color:'#1a1a1a',marginBottom:'0.4rem'}}>Wedding Date</label>
                      <input className="form-input" type="date" value={weddingDate} onChange={e => setWeddingDate(e.target.value)} />
                    </div>
                    <div>
                      <label style={{display:'block',fontSize:'0.85rem',fontWeight:500,color:'#1a1a1a',marginBottom:'0.4rem'}}>Venue</label>
                      <input className="form-input" placeholder="e.g. The Grand Palace" value={venue} onChange={e => setVenue(e.target.value)} />
                    </div>
                  </div>
                </>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
                  <div>
                    <label style={{display:'block',fontSize:'0.85rem',fontWeight:500,color:'#1a1a1a',marginBottom:'0.4rem'}}>Date of Birth</label>
                    <input className="form-input" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:'0.85rem',fontWeight:500,color:'#1a1a1a',marginBottom:'0.4rem'}}>Date of Passing</label>
                    <input className="form-input" type="date" value={deathDate} onChange={e => setDeathDate(e.target.value)} />
                  </div>
                </div>
              )}

              <div>
                <label style={{display:'block',fontSize:'0.85rem',fontWeight:500,color:'#1a1a1a',marginBottom:'0.4rem'}}>
                  {isWedding ? 'Love Story' : 'Biography'}
                </label>
                <RichTextEditor
                  content={bio}
                  onChange={setBio}
                  placeholder={isWedding ? "How did you meet? What makes your love story unique..." : "A few sentences about who they were..."}
                />
              </div>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="subpage-card pad">
            <h2 className="subpage-section-title">Profile Photo</h2>
            <p className="subpage-section-sub">This image appears as the main portrait across your dashboard and public page.</p>
            
            <div style={{display:'flex',alignItems:'flex-start',gap:'2rem'}}>
              <div style={{position:'relative',width:140,height:140,flexShrink:0}}>
                <div style={{
                  width:140,height:140,borderRadius:'50%',overflow:'hidden',
                  background: avatarPreview ? 'none' : 'linear-gradient(135deg, #f5f5f5, #e0e0e0)',
                  border:'3px solid #E5E5E5',display:'flex',alignItems:'center',justifyContent:'center'
                }}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Album avatar preview" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                  ) : (
                    <span style={{fontSize:'3rem',color:'#999'}}>{album?.name?.[0]?.toUpperCase() || '✦'}</span>
                  )}
                </div>
                {avatarPreview && (
                  <button onClick={removeAvatar} style={{
                    position:'absolute',bottom:0,right:0,background:'#DC2626',color:'white',
                    border:'none',borderRadius:'50%',width:32,height:32,cursor:'pointer',
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.9rem'
                  }} aria-label="Close">✕</button>
                )}
              </div>
              <div style={{flex:1}}>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{display:'none'}} />
                <button 
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  style={{
                    background: uploadingAvatar ? '#ccc' : 'white',color:'#1a1a1a',
                    border:'1.5px solid #E5E5E5',borderRadius:8,padding:'0.7rem 1.25rem',
                    fontSize:'0.9rem',cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                    transition:'all 0.2s',fontWeight:500
                  }}
                >
                  {uploadingAvatar ? 'Uploading...' : '📤 Upload New Photo'}
                </button>
                <p style={{color:'#999',fontSize:'0.8rem',marginTop:'0.75rem'}}>Recommended: Square image, at least 400x400px</p>
              </div>
            </div>
          </div>
        )}

        {/* COVER TAB */}
        {activeTab === 'cover' && (
          <div className="subpage-card pad">
            <h2 className="subpage-section-title">Cover Photo</h2>
            <p className="subpage-section-sub">Use a wide image that sets the tone of the public page before visitors scroll.</p>
            
            <div style={{aspectRatio:'21/9',borderRadius:12,overflow:'hidden',background:'linear-gradient(135deg, #f5f5f5, #e8e8e8)',border:'2px dashed #D4D4D4',marginBottom:'1rem',position:'relative'}}>
              {coverPreview ? (
                <img src={coverPreview} alt="Album cover preview" style={{width:'100%',height:'100%',objectFit:'cover'}} />
              ) : (
                <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'#999'}}>
                  <span style={{fontSize:'1.25rem'}}>No cover photo selected</span>
                </div>
              )}
              {coverPreview && (
                <button onClick={removeCover} style={{
                  position:'absolute',top:12,right:12,background:'rgba(0,0,0,0.6)',color:'white',
                  border:'none',borderRadius:8,padding:'0.5rem 1rem',cursor:'pointer',fontSize:'0.85rem'
                }}>Remove</button>
              )}
            </div>
            
            <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} style={{display:'none'}} />
            <button 
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              style={{
                background: uploadingCover ? '#ccc' : 'white',color:'#1a1a1a',
                border:'1.5px solid #E5E5E5',borderRadius:8,padding:'0.7rem 1.25rem',
                fontSize:'0.9rem',cursor: uploadingCover ? 'not-allowed' : 'pointer',
                transition:'all 0.2s',fontWeight:500,width:'100%'
              }}
            >
              {uploadingCover ? 'Uploading...' : '📤 Upload Cover Photo'}
            </button>
            <p style={{color:'#999',fontSize:'0.8rem',marginTop:'0.75rem',textAlign:'center'}}>Recommended: Wide image, at least 1200x500px</p>
          </div>
        )}

        {/* MEDIA TAB */}
        {activeTab === 'media' && (
          <div className="subpage-card pad">
            <h2 className="subpage-section-title">Manage Photos and Videos</h2>
            <p className="subpage-section-sub">Upload, review, and manage the photos and videos that tell this story.</p>
            <p style={{color:'#888',fontSize:'0.8rem',marginBottom:'1.5rem'}}>
              Plan limit: {Number.isFinite(mediaLimits.photos) ? `${photoCount}/${mediaLimits.photos} photos` : `${photoCount} photos`} · {Number.isFinite(mediaLimits.videos) ? `${videoCount}/${mediaLimits.videos} videos` : `${videoCount} videos`} · Videos are optimized to 1080p on upload.
            </p>
            
            <div style={{border:'2px dashed #E5E5E5',borderRadius:12,padding:'2rem',textAlign:'center',marginBottom:'1.5rem',background:'#FAFAFA'}}>
              <input
                type="file"
                id="media-upload"
                multiple
                accept="image/*,video/*"
                onChange={handleMediaUpload}
                style={{display:'none'}}
              />
              <label htmlFor="media-upload" style={{cursor:'pointer',display:'block'}}>
                <div style={{fontSize:'2.5rem',marginBottom:'0.75rem'}}>📷</div>
                <div style={{color:'#1a1a1a',fontWeight:500,marginBottom:'0.25rem'}}>Click to upload photos or videos</div>
                <div style={{color:'#999',fontSize:'0.85rem'}}>JPG, PNG, MP4, MOV and more · Portrait photos keep their orientation</div>
              </label>
              {uploadingMedia && <div style={{marginTop:'1rem',color:'#666'}}>Uploading... {uploadProgress}%</div>}
            </div>

            {allMedia.length === 0 ? (
              <div className="subpage-empty" style={{background:'#FAFAFA',borderRadius:12}}>
                <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>🖼️</div>
                <p style={{margin:0}}>No media yet. Upload photos or videos above.</p>
              </div>
            ) : (
              <div>
                <div style={{fontSize:'0.9rem',fontWeight:500,color:'#1a1a1a',marginBottom:'1rem'}}>
                  Your Media ({allMedia.length} items)
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:'0.75rem',maxHeight:400,overflowY:'auto'}}>
                  {allMedia.map(m => (
                    <div key={m.id} style={{position:'relative',aspectRatio:'1',borderRadius:10,overflow:'hidden',background:'#f0f0f0',border:'1px solid #E5E5E5'}}>
                      {m.type === 'photo' || m.type === 'video' ? (
                        <img src={m.url} alt={m.file_name} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                      ) : (
                        <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem'}}>🎵</div>
                      )}
                      <button
                        onClick={() => deleteMedia(m.id)}
                        disabled={deletingMedia === m.id}
                        style={{
                          position:'absolute',top:4,right:4,background:'rgba(220,38,38,0.9)',color:'white',
                          border:'none',borderRadius:'50%',width:24,height:24,cursor:deletingMedia === m.id ? 'not-allowed' : 'pointer',
                          display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem'
                        }}
                      >
                        {deletingMedia === m.id ? '...' : '✕'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* BIOGRAPHY TAB */}
        {activeTab === 'biography' && (
          <div className="subpage-card pad">
            <h2 className="subpage-section-title">About {album?.name}</h2>
            <p className="subpage-section-sub">Write the main story visitors should read when they land on this page.</p>
            <RichTextEditor content={bio} onChange={setBio} placeholder="Write about their life, achievements, and what they meant to you..." />
          </div>
        )}

        {/* CAPTIONS TAB */}
        {activeTab === 'captions' && (
          <div className="subpage-card pad">
            <h2 className="subpage-section-title">Photo and Video Captions</h2>
            <p className="subpage-section-sub">Add context so each upload feels like part of a full story.</p>
            
            {allMedia.length === 0 ? (
              <div className="subpage-empty" style={{background:'#FAFAFA',borderRadius:12}}>
                <div style={{fontSize:'2.5rem',marginBottom:'0.75rem'}}>📷</div>
                <p style={{margin:0,fontSize:'0.95rem'}}>No photos or videos yet.</p>
                <p style={{margin:'0.5rem 0 0',fontSize:'0.85rem',color:'#999'}}>Add media in the Create/Edit album page.</p>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'0.75rem',maxHeight:500,overflowY:'auto'}}>
                {allMedia.map(m => (
                  <div key={m.id} style={{display:'flex',gap:'1rem',alignItems:'center',padding:'0.75rem',background:'#FAFAFA',borderRadius:12,border:'1px solid #F0F0F0'}}>
                    <div style={{width:64,height:64,borderRadius:8,overflow:'hidden',flexShrink:0,background:'#fff'}}>
                      <img src={m.url} alt={m.file_name} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'0.8rem',color:'#999',marginBottom:'0.25rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.file_name}</div>
                      <input 
                        className="form-input"
                        style={{fontSize:'0.9rem',padding:'0.5rem 0.75rem',width:'100%'}}
                        placeholder="Add a caption..."
                        value={captionEdit[m.id] !== undefined ? captionEdit[m.id] : (m.caption || "")}
                        onChange={e => setCaptionEdit(prev => ({ ...prev, [m.id]: e.target.value }))}
                      />
                    </div>
                    <button 
                      onClick={() => saveCaption(m)}
                      disabled={savingCaption === m.id}
                      style={{
                        background: savingCaption === m.id ? '#ccc' : '#1a1a1a',
                        color: 'white',border:'none',borderRadius:6,
                        padding:'0.5rem 1rem',cursor: savingCaption === m.id ? 'not-allowed' : 'pointer',
                        fontSize:'0.85rem',whiteSpace:'nowrap'
                      }}
                    >
                      {savingCaption === m.id ? '...' : 'Save'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* THEME TAB */}
        {activeTab === 'theme' && (
          <ThemeTab albumId={currentAlbum?.id} token={token} showToast={showToast} featureAccess={featureAccess} />
        )}

        {/* MUSIC TAB */}
        {activeTab === 'music' && (
          <MusicTab album={album} albumId={currentAlbum?.id} token={token} showToast={showToast} onUpdate={loadAlbumData} />
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && album && (
          <SecurityTab albumId={currentAlbum?.id} album={album} token={token} showToast={showToast} featureAccess={featureAccess} />
        )}

        {activeTab === 'wedding-details' && album?.type === 'wedding' && (
          <WeddingDetailsTab album={album} albumId={currentAlbum?.id} token={token} showToast={showToast} onUpdate={loadAlbumData} />
        )}

        {activeTab === 'wishes' && album?.type === 'wedding' && (
          <GuestWishesTab albumId={currentAlbum?.id} token={token} showToast={showToast} />
        )}

        {activeTab === 'invitation' && album?.type === 'wedding' && (
          <InvitationTab
            albumId={currentAlbum?.id}
            album={album}
            token={token}
            showToast={showToast}
            onUpdate={loadAlbumData}
          />
        )}

        {activeTab === 'rsvps' && album?.type === 'wedding' && (
          <RsvpTab
            albumId={currentAlbum?.id}
            token={token}
            showToast={showToast}
          />
        )}

      </div>
    </div>
  );
}

// ── WEDDING DETAILS TAB ───────────────────────────────────────

function WeddingDetailsTab({ album, albumId, token, showToast, onUpdate }) {
  const [weddingDate, setWeddingDate] = useState(album?.wedding_date ? album.wedding_date.split('T')[0] : '');
  const [partner1,    setPartner1]    = useState(album?.partner1_name || '');
  const [partner2,    setPartner2]    = useState(album?.partner2_name || '');
  const [venue,       setVenue]       = useState(album?.venue_name    || '');
  const [albumLabel,  setAlbumLabel]  = useState(album?.album_label   || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiCall(`/api/albums/${albumId}`, {
        method: 'PUT',
        body: JSON.stringify({ weddingDate, partner1Name: partner1, partner2Name: partner2, venueName: venue, albumLabel }),
      }, token);
      showToast?.('✓ Wedding details saved');
      onUpdate?.();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const LABELS = [
    { id: '',            label: 'No label' },
    { id: 'pre-wedding', label: 'Pre-Wedding Shoot' },
    { id: 'ceremony',    label: 'Ceremony' },
    { id: 'reception',   label: 'Reception' },
    { id: 'honeymoon',   label: 'Honeymoon' },
    { id: 'anniversary', label: 'Anniversary' },
  ];

  return (
    <div className="subpage-card pad">
      <h2 style={{fontSize:'1.1rem',fontWeight:600,color:'#1a1a1a',marginBottom:'1.5rem'}}>💍 Wedding Details</h2>
      <div style={{display:'grid',gap:'1rem'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
          <div className="form-group">
            <label className="form-label">Partner 1 Name</label>
            <input className="form-input" value={partner1} onChange={e => setPartner1(e.target.value)} placeholder="e.g. Liana" />
          </div>
          <div className="form-group">
            <label className="form-label">Partner 2 Name</label>
            <input className="form-input" value={partner2} onChange={e => setPartner2(e.target.value)} placeholder="e.g. James" />
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
          <div className="form-group">
            <label className="form-label">Wedding Date</label>
            <input className="form-input" type="date" value={weddingDate} onChange={e => setWeddingDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Venue Name</label>
            <input className="form-input" value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. The Grand Palace" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Album Label</label>
          <select className="form-input" value={albumLabel} onChange={e => setAlbumLabel(e.target.value)}
            style={{appearance:'auto'}}>
            {LABELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <div style={{fontSize:'0.75rem',color:'#999',marginTop:'0.3rem'}}>Tag this album within a wedding collection (pre-shoot, ceremony, etc.)</div>
        </div>
      </div>
      <button onClick={save} disabled={saving}
        style={{marginTop:'1.5rem',background:'#1a1a1a',color:'white',border:'none',borderRadius:8,
          padding:'0.75rem 1.5rem',fontWeight:500,cursor:'pointer',opacity:saving?0.6:1}}>
        {saving ? 'Saving…' : 'Save Wedding Details'}
      </button>
    </div>
  );
}

// ── GUEST WISHES TAB ──────────────────────────────────────────

function GuestWishesTab({ albumId, token, showToast }) {
  const [wishes, setWishes]     = useState([]);
  const [filter, setFilter]     = useState('pending');
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(null);

  const load = (status = filter) => {
    setLoading(true);
    apiCall(`/api/albums/wishes?status=${status}`, {}, token)
      .then(d => setWishes((d.wishes || []).filter(w => w.album_id === albumId || true)))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const moderate = async (wishId, action) => {
    setActing(wishId);
    try {
      await apiCall(`/api/albums/wishes/${wishId}`, { method: 'PUT', body: JSON.stringify({ action }) }, token);
      showToast?.(action === 'approve' ? '✓ Wish approved and published' : 'Wish rejected');
      load();
    } catch (err) { alert(err.message); }
    finally { setActing(null); }
  };

  const remove = async (wishId) => {
    if (!confirm('Delete this wish permanently?')) return;
    setActing(wishId);
    try {
      await apiCall(`/api/albums/wishes/${wishId}`, { method: 'DELETE' }, token);
      showToast?.('Wish deleted');
      load();
    } catch (err) { alert(err.message); }
    finally { setActing(null); }
  };

  const statusColors = { pending:'#eab308', approved:'#22c55e', rejected:'#ef4444' };

  return (
    <div className="subpage-card pad">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:'0.5rem'}}>
        <div>
          <h2 style={{fontSize:'1.1rem',fontWeight:600,color:'#1a1a1a',margin:0}}>💌 Guest Wishes</h2>
          <p style={{color:'#666',fontSize:'0.82rem',marginTop:'0.2rem'}}>Approve wishes to show them on your public wedding page.</p>
        </div>
        <div style={{display:'flex',gap:'0.4rem'}}>
          {['pending','approved','rejected','all'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{padding:'0.35rem 0.75rem',borderRadius:8,border:'1.5px solid',fontSize:'0.78rem',fontWeight:500,cursor:'pointer',
                background:filter===s?'#1a1a1a':'white', color:filter===s?'white':'#666',
                borderColor:filter===s?'#1a1a1a':'#E5E5E5', textTransform:'capitalize'}}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading
        ? <div style={{color:'#999',padding:'2rem',textAlign:'center'}}>Loading…</div>
        : wishes.length === 0
          ? <div style={{color:'#999',padding:'2rem',textAlign:'center',fontStyle:'italic'}}>
              {filter === 'pending' ? 'No pending wishes — share your album link to start receiving wishes from guests.' : `No ${filter} wishes.`}
            </div>
          : <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              {wishes.map(w => (
                <div key={w.id} style={{border:'1.5px solid #E5E5E5',borderRadius:12,padding:'1rem',
                  borderColor:statusColors[w.status]+'33'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:'0.88rem',marginBottom:'0.3rem',display:'flex',alignItems:'center',gap:'0.5rem'}}>
                        {w.guest_name || 'Anonymous'}
                        <span style={{fontSize:'0.7rem',fontWeight:600,padding:'0.15rem 0.5rem',borderRadius:100,
                          background:statusColors[w.status]+'20',color:statusColors[w.status]}}>
                          {w.status}
                        </span>
                      </div>
                      <p style={{color:'#555',fontSize:'0.88rem',lineHeight:1.6,margin:0}}>{w.message}</p>
                      <div style={{fontSize:'0.72rem',color:'#999',marginTop:'0.4rem'}}>
                        {new Date(w.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                      </div>
                    </div>
                    {w.status === 'pending' && (
                      <div style={{display:'flex',gap:'0.4rem',flexShrink:0}}>
                        <button disabled={acting===w.id} onClick={() => moderate(w.id,'approve')}
                          style={{padding:'0.4rem 0.8rem',background:'#f0fdf4',color:'#16a34a',border:'1px solid #bbf7d0',borderRadius:8,fontSize:'0.78rem',fontWeight:600,cursor:'pointer'}}>
                          ✓ Approve
                        </button>
                        <button disabled={acting===w.id} onClick={() => moderate(w.id,'reject')}
                          style={{padding:'0.4rem 0.8rem',background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',borderRadius:8,fontSize:'0.78rem',fontWeight:600,cursor:'pointer'}}>
                          ✕ Reject
                        </button>
                      </div>
                    )}
                    <button disabled={acting===w.id} onClick={() => remove(w.id)}
                      style={{padding:'0.4rem 0.6rem',background:'transparent',color:'#999',border:'none',cursor:'pointer',fontSize:'0.85rem'}}>
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
      }
    </div>
  );
}

// ── THEME TAB COMPONENT ───────────────────────────────────────
function ThemeTab({ albumId, token, showToast, featureAccess }) {
  const [current,   setCurrent]   = useState('classic');
  const [albumType, setAlbumType] = useState('memorial');
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    apiCall(`/api/albums/${albumId}`,{},token)
      .then(d => {
        setCurrent(d.album.theme || (d.album.type === 'wedding' ? 'classic-romance' : 'classic'));
        setAlbumType(d.album.type || 'memorial');
      })
      .catch(() => {});
  }, [albumId]);

  const save = async (theme) => {
    if (!featureAccess?.allowedThemes?.includes(theme)) {
      showToast?.('This theme is not available on your current plan', 'error');
      return;
    }
    setCurrent(theme); setSaving(true);
    try {
      await apiCall(`/api/albums/${albumId}/theme`,{method:'PUT',body:JSON.stringify({theme})},token);
      showToast?.('✓ Theme saved');
    } catch(err){ alert(err.message); } finally { setSaving(false); }
  };

  const themes = (albumType === 'wedding' ? WEDDING_THEMES : MEMORIAL_THEMES)
    .filter((theme) => featureAccess?.allowedThemes?.includes(theme.id));
  const otherThemes = [];
  const otherLabel  = albumType === 'wedding' ? 'Memorial Themes' : 'Wedding Themes';

  return (
    <div className="subpage-card pad">
      <h2 className="subpage-section-title">Album Theme</h2>
      <p className="subpage-section-sub">
        {featureAccess?.canChangeTheme
          ? (albumType === 'wedding' ? 'Choose how your wedding page looks for guests.' : 'Choose how your public memorial page looks.')
          : 'Your current plan includes the default theme only. Upgrade to unlock theme changes.'}
      </p>
      {saving && <div style={{color:'#999',fontSize:'0.85rem',marginBottom:'0.5rem'}}>Saving…</div>}

      <div style={{marginBottom:'0.6rem',fontSize:'0.75rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#888'}}>
        {albumType === 'wedding' ? '💍 Wedding Themes' : '🖤 Memorial Themes'}
      </div>
      <div className="theme-grid">
        {themes.map(t => (
          <div key={t.id} className={`theme-option${current===t.id?' selected':''}`} onClick={()=>featureAccess?.canChangeTheme && save(t.id)}>
            <div className="theme-preview">{t.icon}</div>
            <div className="theme-name">{t.label}</div>
            <div style={{fontSize:'0.68rem',color:'#999',marginTop:'0.2rem'}}>{t.desc}</div>
            {current===t.id && <div style={{fontSize:'0.72rem',color:'var(--accent)',marginTop:'0.2rem',fontWeight:600}}>✓ Active</div>}
          </div>
        ))}
      </div>

      <details hidden style={{marginTop:'1.5rem'}}>
        <summary style={{fontSize:'0.8rem',color:'#999',cursor:'pointer',userSelect:'none'}}>
          Also available: {otherLabel}
        </summary>
        <div className="theme-grid" style={{marginTop:'0.75rem',opacity:0.7}}>
          {otherThemes.map(t => (
            <div key={t.id} className={`theme-option${current===t.id?' selected':''}`} onClick={()=>save(t.id)}>
              <div className="theme-preview">{t.icon}</div>
              <div className="theme-name">{t.label}</div>
              <div style={{fontSize:'0.68rem',color:'#999',marginTop:'0.2rem'}}>{t.desc}</div>
              {current===t.id && <div style={{fontSize:'0.72rem',color:'var(--accent)',marginTop:'0.2rem',fontWeight:600}}>✓ Active</div>}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

// ── MUSIC TAB COMPONENT ───────────────────────────────────────

function MusicTab({ album, albumId, token, showToast, onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const musicRef = useRef();
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]; if(!file) return;
    setUploading(true);
    try {
      const form = new FormData(); form.append('file',file);
      const res = await fetch(`${API}/api/albums/${albumId}/music`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});
      if(!res.ok) { const d=await res.json(); throw new Error(d.error||'Upload failed'); }
      onUpdate?.(); showToast?.('Background music uploaded');
    } catch(err){ alert(err.message); } finally{ setUploading(false); e.target.value=''; }
  };
  const deleteMusic = async () => {
    if(!confirm('Remove background music?')) return;
    setDeleting(true);
    try {
      await apiCall(`/api/albums/${albumId}/music`,{method:'DELETE'},token);
      onUpdate?.(); showToast?.('Music removed');
    } catch(err){ alert(err.message); } finally{ setDeleting(false); }
  };
  return (
    <div className="subpage-card pad">
      <h2 className="subpage-section-title">Background Music</h2>
      <p className="subpage-section-sub">Add a song that plays when visitors open the memorial page.</p>
      {album?.background_music_key ? (
        <div className="music-current">
          <div className="music-icon">🎵</div>
          <div style={{flex:1}}>
            <div className="music-name">{album.background_music_name||'Background Music'}</div>
            <div className="music-sub">Playing on memorial page</div>
          </div>
          <button onClick={deleteMusic} disabled={deleting} style={{background:'#FEF2F2',color:'#DC2626',border:'1px solid #FECACA',borderRadius:8,padding:'0.4rem 0.8rem',cursor:'pointer',fontSize:'0.82rem'}}>{deleting?'…':'Remove'}</button>
        </div>
      ) : (
        <div style={{border:'2px dashed var(--border)',borderRadius:12,padding:'2rem',textAlign:'center',background:'#FAFAFA',marginBottom:'1rem'}}>
          <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>🎵</div>
          <div style={{fontWeight:500,color:'#1a1a1a',marginBottom:'0.25rem'}}>No background music</div>
          <div style={{color:'#999',fontSize:'0.82rem'}}>MP3, WAV, OGG supported</div>
        </div>
      )}
      <input ref={musicRef} type="file" accept="audio/*" style={{display:'none'}} onChange={handleUpload} />
      <button onClick={()=>musicRef.current?.click()} disabled={uploading}
        style={{background:uploading?'#ccc':'white',color:'#1a1a1a',border:'1.5px solid var(--border)',borderRadius:8,padding:'0.7rem 1.25rem',cursor:uploading?'not-allowed':'pointer',fontWeight:500,fontSize:'0.9rem'}}>
        {uploading?'Uploading…':'📤 Upload Music'}
      </button>
    </div>
  );
}

// ── SECURITY TAB COMPONENT ────────────────────────────────────

function SecurityTab({ albumId, album, token, showToast, featureAccess }) {
  const [pwEnabled, setPwEnabled]       = useState(album?.is_password_protected||false);
  const [password, setPassword]         = useState('');
  const [heirEmail, setHeirEmail]       = useState(album?.heir_email||'');
  const [nfcUid, setNfcUid]             = useState(album?.nfc_uid||'');
  const [saving, setSaving]             = useState(false);
  const isWeddingAlbum  = album?.type === 'wedding';
  const [allowTributes, setAllowTributes] = useState(Boolean(album?.allow_public_tributes || album?.allowPublicTributes));
  const [allowWishes,   setAllowWishes]   = useState(Boolean(album?.allow_public_wishes   || album?.allowPublicWishes));


  const savePassword = async () => {
    setSaving(true);
    try {
      await apiCall(`/api/albums/${albumId}/password`,{method:'PUT',body:JSON.stringify({isPasswordProtected:pwEnabled,password:pwEnabled?password:''})},token);
      showToast?.(pwEnabled?'Password protection enabled':'Password protection disabled');
      setPassword('');
    } catch(err){ alert(err.message); } finally{ setSaving(false); }
  };
  const saveContributions = async (field, value) => {
    try {
      await apiCall(`/api/albums/${albumId}`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: value }),
      }, token);
      showToast?.(value ? 'Public contributions enabled' : 'Public contributions disabled');
    } catch (err) { showToast?.('Save failed: ' + err.message); }
  };

  const saveHeir = async () => {
    setSaving(true);
    try {
      await apiCall(`/api/albums/${albumId}/heir`,{method:'PUT',body:JSON.stringify({heirEmail})},token);
      showToast?.('Heir email saved');
    } catch(err){ alert(err.message); } finally{ setSaving(false); }
  };
  const saveNfc = async () => {
    if (!featureAccess?.canUseNfc) {
      showToast?.('NFC support is not included in your current plan', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiCall(`/api/albums/${albumId}/nfc`,{method:'PUT',body:JSON.stringify({nfcUid})},token);
      showToast?.('NFC UID saved');
    } catch(err){ alert(err.message); } finally{ setSaving(false); }
  };

  return (
    <div className="subpage" style={{gap:'1rem'}}>
      {/* Password */}
      <div className="subpage-card pad">
        <h2 className="subpage-section-title">Password Protection</h2>
        <p className="subpage-section-sub">Require a password for visitors to view this album.</p>
        <div className="toggle-wrap" style={{marginBottom:'1rem'}}>
          <button className={`toggle${pwEnabled?' on':''}`} onClick={()=>setPwEnabled(v=>!v)} />
          <span className="toggle-label">{pwEnabled?'Password protection is ON':'Password protection is OFF'}</span>
        </div>
        {pwEnabled && (
          <div style={{marginBottom:'1rem'}}>
            <label className="form-label">Set Password</label>
            <input className="form-input" type="password" placeholder="Enter new password" value={password} onChange={e=>setPassword(e.target.value)} />
          </div>
        )}
        <button className="btn-primary" style={{padding:'0.6rem 1.25rem',fontSize:'0.9rem'}} onClick={savePassword} disabled={saving}>{saving?'Saving…':'Save'}</button>
      </div>

      {/* Heir Email */}
      <div className="subpage-card pad">
        <h2 className="subpage-section-title">Heir / Successor</h2>
        <p className="subpage-section-sub">Grant another person ownership of this album, such as a family member.</p>
        <div className="form-group">
          <label className="form-label">Heir Email Address</label>
          <input className="form-input" type="email" placeholder="heir@example.com" value={heirEmail} onChange={e=>setHeirEmail(e.target.value)} />
        </div>
        <button className="btn-primary" style={{padding:'0.6rem 1.25rem',fontSize:'0.9rem'}} onClick={saveHeir} disabled={saving}>{saving?'Saving…':'Save Heir'}</button>
      </div>

      {/* NFC */}
      <div className="subpage-card pad">
        <h2 className="subpage-section-title">NFC Tag UID</h2>
        <p className="subpage-section-sub">Link a physical NFC tag, such as one on a plaque, to this album.</p>
        <div className="form-group">
          <label className="form-label">NFC UID (hex, e.g. A1:B2:C3:D4)</label>
          <input className="form-input" placeholder="A1:B2:C3:D4" value={nfcUid} onChange={e=>setNfcUid(e.target.value)} />
        </div>
        <button className="btn-primary" style={{padding:'0.6rem 1.25rem',fontSize:'0.9rem'}} onClick={saveNfc} disabled={saving}>{saving?'Saving…':'Save NFC UID'}</button>
      </div>

      {/* Public Contributions */}
      <div className="subpage-card pad">
        <h2 style={{fontSize:'1.1rem',fontWeight:600,color:'#1a1a1a',marginBottom:'0.25rem'}}>
          {isWeddingAlbum ? '💌 Public Guest Wishes' : '✍ Public Tributes'}
        </h2>
        <p className="subpage-section-sub">
          {isWeddingAlbum
            ? 'Allow anyone viewing your album to leave a wish via a floating button on the page.'
            : 'Allow anyone viewing this memorial to leave a tribute message. They appear instantly — you can delete any from your dashboard.'}
        </p>
        <div className="toggle-wrap">
          <button
            className={`toggle${(isWeddingAlbum ? allowWishes : allowTributes) ? ' on' : ''}`}
            onClick={async () => {
              if (isWeddingAlbum) {
                const next = !allowWishes;
                setAllowWishes(next);
                try {
                  await apiCall(`/api/albums/${albumId}`, { method:'PUT', body:JSON.stringify({ allowPublicWishes: next }) }, token);
                  showToast?.(next ? 'Guest wishes enabled' : 'Guest wishes disabled');
                } catch(e) { setAllowWishes(!next); }
              } else {
                const next = !allowTributes;
                setAllowTributes(next);
                try {
                  await apiCall(`/api/albums/${albumId}`, { method:'PUT', body:JSON.stringify({ allowPublicTributes: next }) }, token);
                  showToast?.(next ? 'Public tributes enabled' : 'Public tributes disabled');
                } catch(e) { setAllowTributes(!next); }
              }
            }}
          />
          <span className="toggle-label">
            {(isWeddingAlbum ? allowWishes : allowTributes)
              ? (isWeddingAlbum ? 'Guest wishes are ON' : 'Public tributes are ON')
              : (isWeddingAlbum ? 'Guest wishes are OFF' : 'Public tributes are OFF')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── CREATE / EDIT ALBUM ───────────────────────────────────────

export default AlbumSettings;
