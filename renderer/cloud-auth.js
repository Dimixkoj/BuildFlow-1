import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cachcqnqqowmmripuqeb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pPZEJlJj-wcHzKqG6vK-_g_oIMSfd-V';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  global: { headers: { 'x-client-info': 'dimixkoj-buildflow1' } }
});
const $ = (id) => document.getElementById(id);
const panel = $('cloud-auth-panel');
const appKey = window.APP_VARIANT === 'buildflow' ? 'buildflow1' : 'conflow1';
let activeWorkspace = null;
let activeUser = null;

function status(message, connected = false) {
  const badge = $('cloud-status');
  if (badge) badge.textContent = connected ? 'Cloud connected' : 'Cloud not connected';
  const note = $('cloud-account-status');
  if (note) note.textContent = message;
}
function showPanel(show) { panel?.classList.toggle('hidden', !show); }
function localPhoto() {
  try { return localStorage.getItem('buildflow-profile-photo') || ''; } catch { return ''; }
}
function renderProfile(user) {
  const card = $('account-profile');
  if (!card) return;
  if (!user) {
    card.classList.add('hidden');
    return;
  }
  const meta = user.user_metadata || {};
  const fullName = meta.full_name || user.email?.split('@')[0] || 'Workspace user';
  const loginId = meta.login_id || user.id.slice(0, 8).toUpperCase();
  const role = meta.display_role || 'Workspace member';
  $('profile-name').textContent = fullName;
  $('profile-login-id').textContent = loginId;
  $('profile-role').textContent = role;
  const avatar = $('profile-avatar');
  const photo = localPhoto();
  if (avatar) {
    avatar.textContent = photo ? '' : fullName.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
    avatar.style.backgroundImage = photo ? 'url("' + photo + '")' : '';
    avatar.classList.toggle('has-photo', !!photo);
  }
  card.classList.remove('hidden');
}
$('cloud-open')?.addEventListener('click', () => showPanel(true));
$('cloud-close')?.addEventListener('click', () => showPanel(false));

$('profile-photo-input')?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    status('Choose a PNG, JPEG or WebP profile photograph.');
    event.target.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    status('Profile photograph must be 5 MB or smaller.');
    event.target.value = '';
    return;
  }
  try {
    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const img = new Image();
    img.src = source;
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const side = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width-side)/2, (img.height-side)/2, side, side, 0, 0, 256, 256);
    const data = canvas.toDataURL('image/webp', 0.82);
    localStorage.setItem('buildflow-profile-photo', data);
    if (activeUser) renderProfile(activeUser);
    status('Profile photograph saved on this device.');
  } catch (error) {
    status('Could not save profile photograph: ' + error.message);
  }
});

async function resolveWorkspace(user) {
  const { data: ownerWorkspace, error: ownerError } = await supabase
    .from('company_workspaces').select('id, company_name, owner_email')
    .ilike('owner_email', user.email).maybeSingle();
  if (!ownerError && ownerWorkspace) return ownerWorkspace;
  const { data: memberships, error: membershipError } = await supabase
    .from('company_memberships').select('company_id, role, status')
    .eq('user_id', user.id).eq('app_key', appKey).eq('status', 'active').limit(1);
  if (membershipError) throw membershipError;
  if (!memberships?.length) return null;
  const { data: workspace, error } = await supabase.from('company_workspaces')
    .select('id, company_name, owner_email').eq('id', memberships[0].company_id).single();
  if (error) throw error;
  return workspace;
}

async function refreshAuth() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    activeUser = session?.user || null;
    activeWorkspace = null;
    renderProfile(activeUser);
    if (!activeUser) {
      status('Not signed in. Sign in with your company email.');
      $('cloud-sync').disabled = true;
      return;
    }
    try {
      activeWorkspace = await resolveWorkspace(activeUser);
      if (!activeWorkspace) {
        status('Signed in, but this account has no active company workspace access for ' + appKey + '. Ask the company owner to assign access.');
        $('cloud-sync').disabled = true;
      } else {
        status('Signed in as ' + (activeUser.user_metadata?.full_name || activeUser.email) + ' · ' + activeWorkspace.company_name + ' · ' + appKey, true);
        $('cloud-sync').disabled = false;
      }
    } catch (error) {
      status('Signed in; workspace access check failed: ' + error.message);
      $('cloud-sync').disabled = true;
    }
  } catch (error) {
    status('Authentication could not be checked: ' + error.message);
  }
}

$('cloud-sign-in')?.addEventListener('click', async () => {
  const email = $('cloud-email').value.trim();
  const password = $('cloud-password').value;
  if (!email || !password) return status('Enter your email address and password.');
  const button = $('cloud-sign-in');
  button.disabled = true;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message || '')) {
        status('This account is awaiting email confirmation. Use Resend confirmation after the email service is configured.');
        return;
      }
      throw error;
    }
    await refreshAuth();
    if (activeUser) showPanel(false);
  } catch (error) {
    status('Sign-in failed: ' + error.message);
  } finally {
    button.disabled = false;
  }
});


const authActions = document.querySelector('.auth-actions');
if (authActions && !$('cloud-resend-confirm')) {
  const resendButton = document.createElement('button');
  resendButton.className = 'secondary';
  resendButton.id = 'cloud-resend-confirm';
  resendButton.type = 'button';
  resendButton.textContent = 'Resend confirmation';
  authActions.insertBefore(resendButton, $('cloud-sync'));
  resendButton.addEventListener('click', async () => {
    const email = $('cloud-email').value.trim();
    if (!email) return status('Enter your company email address first.');
    resendButton.disabled = true;
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) {
        const message = String(error.message || '');
        if (error.status === 429 || /rate limit|too many requests/i.test(message)) {
          status('Supabase email limit reached. Do not retry yet. Configure custom SMTP, then request one fresh confirmation email.');
        } else {
          status('Confirmation email could not be requested: ' + message);
        }
        return;
      }
      status('Confirmation email requested. Check your inbox and spam folder. Use only the newest confirmation link.');
    } catch (error) {
      status('Confirmation email could not be requested: ' + error.message);
    } finally {
      resendButton.disabled = false;
    }
  });
}

$('cloud-sign-up')?.addEventListener('click', async () => {
  const fullName = $('profile-full-name').value.trim();
  const loginId = $('profile-login-input').value.trim();
  const role = $('profile-role-input').value;
  const email = $('cloud-email').value.trim();
  const password = $('cloud-password').value;
  if (!fullName || fullName.length < 2) return status('Enter your full name before creating an account.');
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(loginId)) return status('Login ID must be 3–32 letters, numbers, hyphens or underscores.');
  if (!email || password.length < 8) return status('Enter your email and a password of at least 8 characters.');
  if (email.toLowerCase() === 'dimixcom@hotmail.com') return status('The company owner account already exists. Do not create it again. Sign in, or use Resend confirmation after SMTP is configured.');
  const button = $('cloud-sign-up');
  button.disabled = true;
  try {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, login_id: loginId, display_role: role } }
    });
    if (error) throw error;
    if (!data.session) {
      status('Account request created. Check your email to confirm it, then sign in. Company workspace access may still need owner approval.');
    } else {
      await refreshAuth();
      status(activeWorkspace ? 'Account created and company workspace connected.' : 'Account created. Your company owner must assign BuildFlow workspace access.', !!activeWorkspace);
      showPanel(false);
    }
  } catch (error) {
    const message = String(error.message || 'Unknown error');
    status(error.status === 429 || /email rate limit|over_email_send_rate_limit/i.test(message)
      ? 'Supabase email rate limit reached. Stop creating accounts for now. Configure custom SMTP, then use Resend confirmation once.'
      : 'Account creation failed: ' + message);
  } finally {
    button.disabled = false;
  }
});

async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    activeUser = null;
    activeWorkspace = null;
    renderProfile(null);
    await refreshAuth();
    showPanel(false);
  } catch (error) {
    status('Sign-out failed: ' + error.message);
  }
}
$('profile-signout')?.addEventListener('click', signOut);

$('cloud-sync')?.addEventListener('click', async () => {
  if (!activeUser || !activeWorkspace) return status('Sign in and confirm company membership before syncing.');
  const button = $('cloud-sync');
  button.disabled = true;
  try {
    const localProjects = await window.desktop.listProjects();
    const rows = localProjects.map(project => ({
      id: project.id, company_id: activeWorkspace.id, app_key: appKey,
      name: project.title, site_address: null, timezone: 'Africa/Lagos',
      status: ['active','paused','completed','archived'].includes(project.status) ? project.status : 'active',
      created_by: activeUser.id, updated_at: project.updated_at || new Date().toISOString()
    }));
    if (rows.length) {
      const { error } = await supabase.from('projects').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
    status('Uploaded ' + rows.length + ' local project record(s). Full two-way sync is not yet enabled.', true);
  } catch (error) {
    status('Project sync failed: ' + error.message);
  } finally {
    button.disabled = !activeWorkspace;
  }
});

supabase.auth.onAuthStateChange(() => { queueMicrotask(() => refreshAuth()); });
refreshAuth();
