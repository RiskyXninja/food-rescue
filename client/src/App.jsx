import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { api } from './api.js';


function AuthForm({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({
    name: '',
    email: '',
    password: '',
    role: 'donor',
  });
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [err, setErr] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) =>
    setF({ ...f, [k]: e.target.value });

  const changeMode = (nextMode) => {
    setErr('');
    setMessage('');
    setMode(nextMode);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setMessage('');
    setBusy(true);

    try {
      if (mode === 'login' || mode === 'register') {
        const d = await api(`/auth/${mode}`, {
          method: 'POST',
          body: {
            ...f,
            email: f.email.trim().toLowerCase(),
          },
        });

        localStorage.setItem('token', d.token);
        onAuth(d.user);
      }

      if (mode === 'forgot') {
        const d = await api('/auth/forgot-password/request-otp', {
          method: 'POST',
          body: { email: f.email.trim().toLowerCase() },
        });

        setMessage(d.message);
        setMode('verify');
      }

      if (mode === 'verify') {
        const d = await api('/auth/forgot-password/verify-otp', {
          method: 'POST',
          body: {
            email: f.email.trim().toLowerCase(),
            otp,
          },
        });

        setResetToken(d.resetToken);
        setMessage('OTP verified successfully. Set your new password.');
        setMode('reset');
      }

      if (mode === 'reset') {
        if (newPassword !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        if (newPassword.length < 8) {
          throw new Error('Password must be at least 8 characters.');
        }

        const d = await api('/auth/forgot-password/reset-password', {
          method: 'POST',
          body: {
            email: f.email.trim().toLowerCase(),
            resetToken,
            newPassword,
          },
        });

        setMessage(d.message);
        setOtp('');
        setResetToken('');
        setNewPassword('');
        setConfirmPassword('');
        setF({ ...f, password: '' });
        setMode('login');
      }
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  const title = {
    login: 'Welcome back',
    register: 'Create an account',
    forgot: 'Forgot password?',
    verify: 'Verify your email',
    reset: 'Set a new password',
  }[mode];

  return (
    <main className="auth-screen">
      <section className="auth-story">
        <div className="auth-story-top"><span className="brand-mark">fr</span><span>Food Rescue <i>·</i> Good food, shared</span></div>
        <div className="story-copy">
          <span className="eyebrow">A little good goes a long way</span>
          <h1>Full hearts.<br /><em>Empty plates.</em></h1>
          <p>Good food deserves a second story. Help bring fresh meals to the people who need them most.</p>
          <div className="story-proof"><span className="proof-icon">✳</span><div><strong>Every meal matters</strong><small>Donate · Collect · Deliver</small></div></div>
        </div>
        <div className="story-caption"><span>MADE FOR GOOD THINGS</span><span>01 — 03</span></div>
      </section>
      <section className="auth-column">
        <form className="card auth" onSubmit={submit}>
          <div className="auth-mobile-brand"><span className="brand-mark">fr</span><span>Food Rescue</span></div>
          {mode !== 'login' && <span className="eyebrow">A BETTER KIND OF COMMUNITY</span>}
          <h2>{title}</h2>
          <p className="auth-intro">{mode === 'login' ? 'Sign in to see the good you can do today.' : 'A few details and you’re on your way.'}</p>

      {(mode === 'login' || mode === 'register') && (
        <>
          {mode === 'register' && (
            <input
              placeholder="Name"
              value={f.name}
              onChange={set('name')}
              required
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={f.email}
            onChange={set('email')}
            autoComplete="email"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={f.password}
            onChange={set('password')}
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            required
          />

          {mode === 'register' && (
            <select value={f.role} onChange={set('role')}>
              <option value="donor">Donor</option>
              <option value="volunteer">Volunteer</option>
            </select>
          )}
        </>
      )}

      {mode === 'forgot' && (
        <>
          <p>Enter your registered email address to receive a reset code.</p>
          <input
            type="email"
            placeholder="Registered email"
            value={f.email}
            onChange={set('email')}
            autoComplete="email"
            required
          />
        </>
      )}

      {mode === 'verify' && (
        <>
          <p>Enter the 6-digit OTP sent to your email address.</p>
          <input
            type="text"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
        </>
      )}

      {mode === 'reset' && (
        <>
          <p>Choose a new password for your account.</p>
          <input
            type="password"
            placeholder="New password (minimum 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </>
      )}

      {err && <p className="err">{err}</p>}
      {message && <p className="success-message">{message}</p>}

      <button type="submit" disabled={busy}>
        {busy
          ? 'Please wait...'
          : {
              login: 'Log in',
              register: 'Create account',
              forgot: 'Send OTP',
              verify: 'Verify OTP',
              reset: 'Reset Password',
            }[mode]}
      </button>

      {mode === 'login' && (
        <>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              changeMode('forgot');
            }}
          >
            Forgot Password?
          </a>

          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              changeMode('register');
            }}
          >
            Need an account? Register
          </a>
        </>
      )}

      {mode === 'register' && (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changeMode('login');
          }}
        >
          Already registered? Log in
        </a>
      )}

      {(mode === 'forgot' || mode === 'verify' || mode === 'reset') && (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changeMode('login');
          }}
        >
          Back to login
        </a>
      )}
        </form>
        <p className="auth-footnote">GOOD FOOD. GOOD PEOPLE. A BETTER DAY.</p>
      </section>
    </main>
  );
}


function DonorForm({ onDone }) {
  const empty = { title: '', quantity: 1, pickupAddress: '', expiresAt: '', donorPhone: '', showPhone: false, imageData: '', location: null };
  const [f, setF] = useState(empty);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      setBusy(true);
      const hasPin = f.location?.latitude !== '' && f.location?.longitude !== '' && Number.isFinite(Number(f.location?.latitude)) && Number.isFinite(Number(f.location?.longitude));
      await api('/listings', { method: 'POST', body: { ...f, location: hasPin ? { latitude: Number(f.location.latitude), longitude: Number(f.location.longitude) } : null } });
      setF(empty);
      setBusy(false);
      onDone();
    } catch (x) {
      setBusy(false);
      setErr(x.message);
    }
  };

  const chooseImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Choose an image file.'); return; }
    if (file.size > 12 * 1024 * 1024) { setErr('Choose an image smaller than 12 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        let quality = 0.82;
        let data = canvas.toDataURL('image/jpeg', quality);
        while (data.length > 1300000 && quality > 0.4) {
          quality -= 0.1;
          data = canvas.toDataURL('image/jpeg', quality);
        }
        if (data.length > 1300000) { setErr('This image could not be compressed enough. Choose a smaller photo.'); return; }
        setF((prev) => ({ ...prev, imageData: data }));
        setErr('');
      };
      image.onerror = () => setErr('Could not read that image.');
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const shareLocation = () => {
    setErr('');
    if (!navigator.geolocation) { setErr('Location is unavailable here. Enter coordinates manually.'); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setF((prev) => ({ ...prev, location: { latitude: Number(coords.latitude.toFixed(6)), longitude: Number(coords.longitude.toFixed(6)) } })),
      () => setErr('Location permission was not granted. You can enter coordinates manually.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <form className="card donor-form" onSubmit={submit}>
      <h2>Donate surplus food</h2>
      <div className="form-grid">
        <input placeholder="Food item" value={f.title} onChange={set('title')} required />
        <input type="number" min="1" value={f.quantity} onChange={set('quantity')} required />
        <input placeholder="Pickup address" value={f.pickupAddress} onChange={set('pickupAddress')} required />
        <input type="datetime-local" value={f.expiresAt} onChange={set('expiresAt')} required />
        <input type="tel" placeholder="Volunteer contact phone (optional)" value={f.donorPhone} onChange={set('donorPhone')} pattern="[+0-9 ().-]{7,24}" maxLength={24} />
      </div>
      <p className="phone-sharing-note">If you add a number, volunteers can see it to coordinate pickup.</p>
      <div className="listing-options">
        <label className="file-pick">Add food photo <input type="file" accept="image/*" capture="environment" onChange={chooseImage} /></label>
        {f.imageData && <img className="photo-preview" src={f.imageData} alt="Selected food" />}
        <button type="button" className="ghost" onClick={shareLocation}>Share current location</button>
        {f.location && <span className="location-note">Pin added · {f.location.latitude}, {f.location.longitude}</span>}
      </div>
      <div className="form-grid coordinates">
        <input aria-label="Latitude" type="number" min="-90" max="90" step="any" placeholder="Latitude (optional)" value={f.location?.latitude ?? ''} onChange={(e) => setF({ ...f, location: { ...(f.location || {}), latitude: e.target.value === '' ? '' : Number(e.target.value) } })} />
        <input aria-label="Longitude" type="number" min="-180" max="180" step="any" placeholder="Longitude (optional)" value={f.location?.longitude ?? ''} onChange={(e) => setF({ ...f, location: { ...(f.location || {}), longitude: e.target.value === '' ? '' : Number(e.target.value) } })} />
      </div>
      {err && <p className="err">{err}</p>}
      <button disabled={busy}>{busy ? 'Submitting…' : 'Submit donation'}</button>
    </form>
  );
}

function Actions({ listing, role, act }) {
  if (role === 'admin' && listing.status === 'pending') {
    return (
      <div className="action-buttons">
        <button onClick={() => act(listing._id, 'review', { decision: 'approve' })}>Approve</button>
        <button className="danger-btn" onClick={() => act(listing._id, 'review', { decision: 'reject' })}>Reject</button>
      </div>
    );
  }

  if (role === 'donor' && listing.status === 'pending') {
    return <button className="danger-btn" onClick={() => act(listing._id, 'cancel')}>Cancel</button>;
  }

  if (role === 'volunteer') {
    if (listing.status === 'approved') {
      return <button onClick={() => act(listing._id, 'claim')}>Claim</button>;
    }
    if (listing.status === 'claimed') {
      return <button onClick={() => act(listing._id, 'status', { status: 'picked_up' })}>Mark picked up</button>;
    }
    if (listing.status === 'picked_up') {
      return <button onClick={() => act(listing._id, 'status', { status: 'delivered' })}>Mark delivered</button>;
    }
  }

  return null;
}

function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{(status || 'unknown').replace('_', ' ')}</span>;
}

function AccountSettings({ user, onUpdated }) {
  const [email, setEmail] = useState(user.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    setErr('');

    if (!currentPassword) {
      setErr('Please enter your current password.');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setErr('New passwords do not match.');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setErr('New password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      const body = { currentPassword, email: email.trim() };
      if (newPassword) body.newPassword = newPassword;
      const data = await api('/auth/admin-credentials', { method: 'PATCH', body });
      localStorage.setItem('token', data.token);
      onUpdated(data.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Admin credentials updated successfully.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Admin Account Settings</h2>
          <p>Update your administrator email and password.</p>
        </div>
      </div>
      <form onSubmit={submit} className="account-form">
        <label htmlFor="admin-email">Admin Email</label>
        <input id="admin-email" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />

        <label htmlFor="current-admin-password">Current Password</label>
        <input id="current-admin-password" type="password" value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter current password" required autoComplete="current-password" />

        <label htmlFor="new-admin-password">New Password</label>
        <input id="new-admin-password" type="password" value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Leave blank to keep current password" minLength={8}
          autoComplete="new-password" />

        <label htmlFor="confirm-admin-password">Confirm New Password</label>
        <input id="confirm-admin-password" type="password" value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password" autoComplete="new-password" />

        {err && <p className="err">{err}</p>}
        {message && <p className="success-message">{message}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </section>
  );
}

function AdminDashboard({ listings, stats, users, records, refresh, cleanup, act, error, onLogout, user, onUpdated }) {
  const [section, setSection] = useState('overview');
  const [userBusy, setUserBusy] = useState('');
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState('');

  const counts = Object.fromEntries(
    (stats?.byStatus || []).map((item) => [item._id, item.count])
  );

  const toggleUser = async (user) => {
    setUserBusy(user._id);
    try {
      await api(`/admin/users/${user._id}/active`, {
        method: 'PATCH',
        body: { isActive: user.isActive === false }
      });
      await refresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setUserBusy('');
    }
  };

  const cleanPastListings = async () => {
    const confirmed = window.confirm('Delete all delivered, rejected, and cancelled listings? Active pickups and delivery history will remain.');
    if (!confirmed) return;
    setCleaning(true);
    setCleanupMessage('');
    try {
      const { deletedCount } = await cleanup();
      setCleanupMessage(`${deletedCount} past listing${deletedCount === 1 ? '' : 's'} deleted.`);
    } catch (e) {
      setCleanupMessage(e.message);
    } finally {
      setCleaning(false);
    }
  };

  const navItems = [
    ['overview', 'Overview', '▦'],
    ['donations', 'Donations', '♧'],
    ['users', 'Users', '♙'],
    ['history', 'Delivery History', '◷'],
    ['settings', 'Account Settings', '⚙']
  ];

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">fr</div>
          <div>
            <strong>Food Rescue</strong>
            <small>Management portal</small>
          </div>
        </div>

        <p className="nav-heading">MAIN MENU</p>
        <nav>
          {navItems.map(([id, label, icon]) => (
            <button
              key={id}
              className={`nav-button ${section === id ? 'selected' : ''}`}
              onClick={() => setSection(id)}
            >
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <span className="admin-dot" />
          Administrator
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>{navItems.find((item) => item[0] === section)?.[1]}</h1>
            <p>A little good goes a long way, {user.name?.split(' ')[0]}.</p>
          </div>
          <div className="header-actions">
  <button className="refresh-btn" onClick={refresh}>↻ Refresh</button>
  <button className="ghost" onClick={onLogout}>Log out</button>
</div>
        </header>

        {error && <p className="err card">{error}</p>}

        {section === 'overview' && (
          <>
            <div className="stats-grid">
              <StatCard label="Total donations" value={listings.length} icon="♧" />
              <StatCard label="Pending approval" value={counts.pending || 0} icon="◷" />
              <StatCard label="Approved" value={counts.approved || 0} icon="✓" />
              <StatCard label="Delivered" value={counts.delivered || 0} icon="⌂" />
            </div>

            <div className="stats-grid secondary-stats">
              <StatCard label="Registered users" value={users.length} icon="♙" />
              <StatCard label="Food quantity delivered" value={stats?.delivered?.total || 0} icon="▤" />
              <StatCard label="Completed deliveries" value={stats?.delivered?.count || 0} icon="✓" />
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Recent donations</h2>
                  <p>Latest food listings submitted by donors</p>
                </div>
                <button className="text-btn" onClick={() => setSection('donations')}>View all</button>
              </div>
              <DonationTable listings={listings.slice(0, 5)} act={act} />
            </section>
          </>
        )}

        {section === 'donations' && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Manage donations</h2>
                <p>Review and manage food donation requests</p>
              </div>
              <button className="danger-btn" onClick={cleanPastListings} disabled={cleaning}>
                {cleaning ? 'Cleaning…' : 'Clean past listings'}
              </button>
            </div>
            {cleanupMessage && <p className="cleanup-message" role="status">{cleanupMessage}</p>}
            <DonationTable listings={listings} act={act} />
          </section>
        )}

        {section === 'users' && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Registered users</h2>
                <p>Manage donor and volunteer accounts</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Account status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.email}</td>
                      <td><span className="role-label">{u.role}</span></td>
                      <td>
                        <StatusBadge status={u.isActive === false ? 'inactive' : 'active'} />
                      </td>
                      <td>
                        {u.role !== 'admin' ? (
                          <button
                            className={u.isActive === false ? '' : 'danger-btn'}
                            disabled={userBusy === u._id}
                            onClick={() => toggleUser(u)}
                          >
                            {userBusy === u._id ? 'Please wait...' : u.isActive === false ? 'Activate' : 'Deactivate'}
                          </button>
                        ) : <span className="muted">Protected</span>}
                      </td>
                    </tr>
                  ))}
                  {!users.length && <tr><td colSpan="5" className="empty-cell">No users found.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {section === 'history' && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Completed deliveries</h2>
                <p>Records of food donations successfully delivered</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Food listing</th><th>Quantity</th><th>Donor</th><th>Volunteer</th><th>Delivered on</th></tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record._id}>
                      <td><strong>{record.listing?.title || 'Food donation'}</strong></td>
                      <td>{record.quantity}</td>
                      <td>{record.donor?.name || '—'}</td>
                      <td>{record.volunteer?.name || '—'}</td>
                      <td>{record.deliveredAt ? new Date(record.deliveredAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                  {!records.length && <tr><td colSpan="5" className="empty-cell">No completed deliveries yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {section === 'settings' && (
          <AccountSettings user={user} onUpdated={onUpdated} />
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function DonationTable({ listings, act }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Food item</th><th>Quantity</th><th>Donor</th><th>Status</th><th>Action</th></tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <tr key={listing._id}>
              <td>
                <strong>{listing.title}</strong>
                <small className="table-subtitle">{listing.pickupAddress}</small>
              </td>
              <td>{listing.quantity} {listing.unit || ''}</td>
              <td>{listing.donor?.name || '—'}</td>
              <td><StatusBadge status={listing.status} /></td>
              <td><Actions listing={listing} role="admin" act={act} /></td>
            </tr>
          ))}
          {!listings.length && <tr><td colSpan="5" className="empty-cell">No food donations found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setReady(true);
      return;
    }
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setReady(true));
  }, []);

  const load = useCallback(async () => {
    setErr('');
    try {
      const data = await api('/listings');
      setListings(data);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  const loadAdmin = useCallback(async () => {
    setErr('');
    try {
      const [statsData, usersData, recordsData, listingsData] = await Promise.all([
        api('/admin/stats'),
        api('/admin/users'),
        api('/admin/records'),
        api('/listings')
      ]);
      setStats(statsData);
      setUsers(usersData);
      setRecords(recordsData);
      setListings(listingsData);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    if (user.role === 'admin') loadAdmin();
    else load();

    const socket = io(import.meta.env.VITE_API_URL || undefined);
    socket.on('listing:updated', () => {
      if (user.role === 'admin') loadAdmin();
      else load();
    });

    return () => socket.disconnect();
  }, [user, load, loadAdmin]);

  const act = async (id, action, body) => {
    try {
      setErr('');
      await api(`/listings/${id}/${action}`, { method: 'PATCH', body });
      if (user?.role === 'admin') await loadAdmin();
      else await load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const cleanup = async () => {
    const result = await api('/listings/cleanup', { method: 'DELETE' });
    await loadAdmin();
    return result;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setListings([]);
    setStats(null);
    setUsers([]);
    setRecords([]);
  };

  if (!ready) return <div className="loading">Loading Food Rescue...</div>;
  if (!user) return <AuthForm onAuth={setUser} />;

  if (user.role === 'admin') {
    return (
      <PullToRefresh refresh={loadAdmin}>
        <AdminDashboard
          listings={listings}
          stats={stats}
          users={users}
          records={records}
          refresh={loadAdmin}
          cleanup={cleanup}
          act={act}
          error={err}
          onLogout={logout}
          user={user}
          onUpdated={setUser}
        />
      </PullToRefresh>
    );
  }

  return (
    <PullToRefresh refresh={load}>
    <div className="wrap member-layout">
      <header className="user-header">
        <div className="member-brand">
          <span className="brand-mark">fr</span><div><h1>Food Rescue</h1>
          <p>Welcome back, {user.name} <span className="role-chip">{user.role}</span></p></div>
        </div>
        <button className="ghost" onClick={logout}>↗ &nbsp;Log out</button>
      </header>

      <section className="member-hero">
        <div><span className="eyebrow">GOOD FOOD, GOING GOOD PLACES</span>
          <h2>{user.role === 'donor' ? <>Share a little.<br /><em>Change a lot.</em></> : <>Your next good deed<br /><em>starts here.</em></>}</h2>
          <p>{user.role === 'donor' ? 'Turn extra food into something meaningful. Your community is ready.' : 'Pick up where kindness left off. Every delivery makes a difference.'}</p>
        </div><div className="hero-stamp"><span>✳</span><strong>GOOD<br />THINGS<br />HAPPEN</strong></div>
      </section>
      <div className="section-kicker"><span>THE COMMUNITY TABLE</span><span>FRESHLY SHARED ✳</span></div>

      {user.role === 'donor' && <DonorForm onDone={load} />}
      {err && <p className="err">{err}</p>}

      {listings.map((listing) => (
        <div className="card item" key={listing._id}>
          <div>
            {listing.imageData && <img className="listing-photo" src={listing.imageData} alt={`${listing.title} food`} />}
            <h3>{listing.title} <small>× {listing.quantity} {listing.unit}</small></h3>
            <p>{listing.pickupAddress} · expires {new Date(listing.expiresAt).toLocaleString()}</p>
            <p>Donor: {listing.donor?.name}{listing.volunteer && ` · Volunteer: ${listing.volunteer.name}`}</p>
            {listing.location?.latitude != null && <a href={`https://maps.google.com/?q=${listing.location.latitude},${listing.location.longitude}`} target="_blank" rel="noreferrer">Open pickup pin ↗</a>}
            {listing.donorPhone && user.role === 'volunteer' && <p className="donor-contact"><span>Donor contact</span><a href={`tel:${listing.donorPhone}`}>Call · {listing.donorPhone}</a></p>}
          </div>
          <div className="side">
            <StatusBadge status={listing.status} />
            <Actions listing={listing} role={user.role} act={act} />
          </div>
        </div>
      ))}

      {!listings.length && <div className="empty-state"><span>✳</span><h3>The table is set.</h3><p>There’s nothing to pick up just yet. Check back soon for a fresh share.</p></div>}
      <button className="ghost logout-bottom" onClick={logout}>Log out</button>
    </div>
    </PullToRefresh>
  );
}

function PullToRefresh({ refresh, children }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef(null);
  const pullValue = useRef(0);
  const refreshingRef = useRef(false);
  const holdTimer = useRef(null);

  const runRefresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setPull(72);
    const minimumAnimation = new Promise((resolve) => window.setTimeout(resolve, 700));
    try {
      await Promise.all([Promise.resolve(refresh()), minimumAnimation]);
    } finally {
      refreshingRef.current = false;
      pullValue.current = 0;
      setRefreshing(false);
      setPull(0);
    }
  };

  const onTouchStart = (event) => {
    if (refreshingRef.current || window.scrollY > 2) return;
    const touch = event.touches[0];
    start.current = touch.clientY < 120 ? touch.clientY : null;
  };

  const onTouchMove = (event) => {
    if (start.current == null || refreshingRef.current) return;
    const distance = Math.max(0, event.touches[0].clientY - start.current);
    pullValue.current = Math.min(88, distance * 0.62);
    setPull(pullValue.current);
    if (pullValue.current >= 58 && !holdTimer.current) {
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        runRefresh();
      }, 350);
    }
  };

  const finishGesture = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    if (pullValue.current >= 58) runRefresh();
    else {
      pullValue.current = 0;
      setPull(0);
    }
    start.current = null;
  };

  useEffect(() => () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
  }, []);

  const visible = pull > 8 || refreshing;
  return (
    <div className="pull-refresh-shell" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={finishGesture} onTouchCancel={finishGesture}>
      <div className={`pull-refresh-indicator ${visible ? 'visible' : ''} ${refreshing ? 'refreshing' : ''}`} style={{ '--pull-distance': `${refreshing ? 72 : pull}px` }} role="status" aria-live="polite">
        <span className="refresh-spinner" aria-hidden="true">↻</span>
        <span>{refreshing ? 'Refreshing Food Rescue…' : 'Release to refresh'}</span>
      </div>
      {children}
    </div>
  );
}
