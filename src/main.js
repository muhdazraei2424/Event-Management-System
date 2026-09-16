const AUTH_KEY = 'eventManagement_auth';
const DEMO_CREDENTIALS = { username: 'admin', password: 'admin123' };
const DATA_KEYS = {
  events: 'eventManagement_events',
  participants: 'eventManagement_participants',
  registrations: 'eventManagement_registrations',
  attendance: 'eventManagement_attendance',
};

const SEED_DATA = {
  events: [
    { eventId: 'event-1', eventName: 'Frontend Workshop', description: 'Practical frontend development workshop.', date: '2099-10-15', time: '10:00', location: 'Training Room A', organizer: 'Workshop Committee', capacity: 30, status: 'Upcoming' },
  ],
  participants: [
    { participantId: 'participant-1', name: 'Aisha Rahman', email: 'aisha@example.com', phone: '012-3456789', organisation: 'Example College' },
  ],
  registrations: [
    { registrationId: 'registration-1', eventId: 'event-1', participantId: 'participant-1', registrationDate: '2099-09-16', status: 'Registered' },
  ],
  attendance: [
    { attendanceId: 'attendance-1', eventId: 'event-1', participantId: 'participant-1', status: 'Present' },
  ],
};

const app = document.querySelector('#app');

function getCollection(name) {
  const key = DATA_KEYS[name];
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(stored)) return stored;
  } catch {
    // Invalid stored data is treated as an empty collection.
  }
  localStorage.setItem(key, JSON.stringify(SEED_DATA[name] || []));
  return SEED_DATA[name] || [];
}

function saveCollection(name, items) {
  localStorage.setItem(DATA_KEYS[name], JSON.stringify(items));
}

function getDashboardData() {
  const events = getCollection('events');
  const participants = getCollection('participants');
  const registrations = getCollection('registrations');
  const attendance = getCollection('attendance');
  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events
    .filter((event) => event.date >= today && !['Completed', 'Cancelled'].includes(event.status))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const presentCount = attendance.filter((record) => record.status === 'Present').length;

  return {
    events,
    participants,
    registrations,
    attendance,
    upcomingEvents,
    attendanceRate: registrations.length ? Math.round((presentCount / registrations.length) * 100) : 0,
  };
}

function renderEventsPage() {
  const auth = getAuthState();
  if (!auth.isAuthenticated) {
    renderLogin();
    return;
  }

  const events = getCollection('events');
  const registrations = getCollection('registrations');
  const registrationCounts = registrations.reduce((counts, registration) => {
    counts[registration.eventId] = (counts[registration.eventId] || 0) + 1;
    return counts;
  }, {});

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div><p class="eyebrow">Event Management System</p><h1>Events</h1></div>
        <div class="user-actions"><button id="dashboard-link" class="button secondary">Dashboard</button><button id="participants-link" class="button secondary">Participants</button><button id="registrations-link" class="button secondary">Registrations</button><button id="attendance-link" class="button secondary">Attendance</button><span>Signed in as <strong>${auth.username}</strong></span><button id="logout" class="button secondary">Logout</button></div>
      </header>
      <main class="dashboard-content">
        <section class="panel">
          <div class="panel-heading"><div><h2>Event Records</h2><p class="muted panel-description">Search and review your stored events.</p></div><span id="event-count" class="panel-count">${events.length}</span></div>
          <div class="event-controls">
            <label>Search events<input id="event-search" type="search" placeholder="Search by name, location or organizer" /></label>
            <label>Status<select id="event-status"><option value="All">All statuses</option><option>Draft</option><option>Upcoming</option><option>Ongoing</option><option>Completed</option><option>Cancelled</option></select></label>
            <label>Sort by<select id="event-sort"><option value="asc">Date: earliest first</option><option value="desc">Date: latest first</option></select></label>
          </div>
          <div id="event-list"></div>
        </section>
      </main>
    </div>`;

  const list = document.querySelector('#event-list');
  const search = document.querySelector('#event-search');
  const status = document.querySelector('#event-status');
  const sort = document.querySelector('#event-sort');

  function updateList() {
    const query = search.value.trim().toLowerCase();
    const selectedStatus = status.value;
    const filtered = events.filter((event) => {
      const searchable = `${event.eventName} ${event.location} ${event.organizer}`.toLowerCase();
      return (!query || searchable.includes(query)) && (selectedStatus === 'All' || event.status === selectedStatus);
    }).sort((a, b) => {
      const comparison = `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
      return sort.value === 'asc' ? comparison : -comparison;
    });

    document.querySelector('#event-count').textContent = `${filtered.length} of ${events.length}`;
    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state-box"><h3>No events found</h3><p>Try changing your search or status filter.</p></div>';
      return;
    }
    list.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Event Name</th><th>Date</th><th>Time</th><th>Location</th><th>Capacity</th><th>Status</th><th>Registration Count</th><th>Actions</th></tr></thead><tbody>${filtered.map((event) => `<tr><td><strong>${event.eventName}</strong></td><td>${event.date}</td><td>${event.time}</td><td>${event.location}</td><td>${event.capacity}</td><td><span class="status">${event.status}</span></td><td>${registrationCounts[event.eventId] || 0} / ${event.capacity}</td><td><div class="row-actions"><button class="button small edit-event" data-id="${event.eventId}">Edit</button><button class="button small danger delete-event" data-id="${event.eventId}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`;
    list.querySelectorAll('.edit-event').forEach((button) => button.addEventListener('click', () => {
      const item = events.find((event) => event.eventId === button.dataset.id);
      const name = window.prompt('Event name', item.eventName);
      if (name === null) return;
      if (!name.trim()) return;
      item.eventName = name.trim();
      saveCollection('events', events);
      updateList();
    }));
    list.querySelectorAll('.delete-event').forEach((button) => button.addEventListener('click', () => {
      if (!window.confirm('Delete this event and its related registrations and attendance?')) return;
      const eventId = button.dataset.id;
      saveCollection('events', events.filter((event) => event.eventId !== eventId));
      saveCollection('registrations', getCollection('registrations').filter((registration) => registration.eventId !== eventId));
      saveCollection('attendance', getCollection('attendance').filter((record) => record.eventId !== eventId));
      renderEventsPage();
    }));
  }

  [search, status, sort].forEach((control) => control.addEventListener('input', updateList));
  document.querySelector('#dashboard-link').addEventListener('click', renderApp);
  document.querySelector('#participants-link').addEventListener('click', renderParticipantsPage);
  document.querySelector('#registrations-link').addEventListener('click', renderRegistrationsPage);
  document.querySelector('#attendance-link').addEventListener('click', renderAttendancePage);
  document.querySelector('#logout').addEventListener('click', () => {
    clearAuthState();
    renderLogin();
  });
  updateList();
}

function renderParticipantsPage() {
  const auth = getAuthState();
  if (!auth.isAuthenticated) {
    renderLogin();
    return;
  }

  const participants = getCollection('participants');
  const registrations = getCollection('registrations');
  const registrationCounts = registrations.reduce((counts, registration) => {
    counts[registration.participantId] = (counts[registration.participantId] || 0) + 1;
    return counts;
  }, {});

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div><p class="eyebrow">Event Management System</p><h1>Participants</h1></div>
        <div class="user-actions"><button id="dashboard-link" class="button secondary">Dashboard</button><button id="events-link" class="button secondary">Events</button><button id="registrations-link" class="button secondary">Registrations</button><button id="attendance-link" class="button secondary">Attendance</button><span>Signed in as <strong>${auth.username}</strong></span><button id="logout" class="button secondary">Logout</button></div>
      </header>
      <main class="dashboard-content">
        <section class="panel">
          <div class="panel-heading"><div><h2>Participant Records</h2><p class="muted panel-description">Search and review your stored participants.</p></div><span id="participant-count" class="panel-count">${participants.length}</span></div>
          <div class="event-controls participant-controls">
            <label>Search participants<input id="participant-search" type="search" placeholder="Search by name, email or organisation" /></label>
          </div>
          <div id="participant-list"></div>
        </section>
      </main>
    </div>`;

  const list = document.querySelector('#participant-list');
  const search = document.querySelector('#participant-search');

  function updateList() {
    const query = search.value.trim().toLowerCase();
    const filtered = participants.filter((participant) => `${participant.name} ${participant.email} ${participant.phone} ${participant.organisation}`.toLowerCase().includes(query));
    document.querySelector('#participant-count').textContent = `${filtered.length} of ${participants.length}`;
    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state-box"><h3>No participants found</h3><p>Try changing your search.</p></div>';
      return;
    }
    list.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Organisation</th><th>Registration Count</th><th>Actions</th></tr></thead><tbody>${filtered.map((participant) => `<tr><td><strong>${participant.name}</strong></td><td>${participant.email}</td><td>${participant.phone || '—'}</td><td>${participant.organisation || '—'}</td><td>${registrationCounts[participant.participantId] || 0}</td><td><div class="row-actions"><button class="button small edit-participant" data-id="${participant.participantId}">Edit</button><button class="button small danger delete-participant" data-id="${participant.participantId}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`;
    list.querySelectorAll('.edit-participant').forEach((button) => button.addEventListener('click', () => {
      const item = participants.find((participant) => participant.participantId === button.dataset.id);
      const name = window.prompt('Participant name', item.name);
      if (name === null) return;
      if (!name.trim()) return;
      item.name = name.trim();
      saveCollection('participants', participants);
      updateList();
    }));
    list.querySelectorAll('.delete-participant').forEach((button) => button.addEventListener('click', () => {
      if (!window.confirm('Delete this participant and related registrations and attendance?')) return;
      const participantId = button.dataset.id;
      saveCollection('participants', participants.filter((participant) => participant.participantId !== participantId));
      saveCollection('registrations', getCollection('registrations').filter((registration) => registration.participantId !== participantId));
      saveCollection('attendance', getCollection('attendance').filter((record) => record.participantId !== participantId));
      renderParticipantsPage();
    }));
  }

  search.addEventListener('input', updateList);
  document.querySelector('#dashboard-link').addEventListener('click', renderApp);
  document.querySelector('#events-link').addEventListener('click', renderEventsPage);
  document.querySelector('#registrations-link').addEventListener('click', renderRegistrationsPage);
  document.querySelector('#attendance-link').addEventListener('click', renderAttendancePage);
  document.querySelector('#logout').addEventListener('click', () => {
    clearAuthState();
    renderLogin();
  });
  updateList();
}

function renderRegistrationsPage() {
  const auth = getAuthState();
  if (!auth.isAuthenticated) {
    renderLogin();
    return;
  }

  const events = getCollection('events');
  const participants = getCollection('participants');
  const registrations = getCollection('registrations');
  const eventById = Object.fromEntries(events.map((event) => [event.eventId, event]));
  const participantById = Object.fromEntries(participants.map((participant) => [participant.participantId, participant]));

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div><p class="eyebrow">Event Management System</p><h1>Registrations</h1></div>
        <div class="user-actions"><button id="dashboard-link" class="button secondary">Dashboard</button><button id="events-link" class="button secondary">Events</button><button id="participants-link" class="button secondary">Participants</button><button id="attendance-link" class="button secondary">Attendance</button><span>Signed in as <strong>${auth.username}</strong></span><button id="logout" class="button secondary">Logout</button></div>
      </header>
      <main class="dashboard-content">
        <section class="panel registration-form-panel">
          <div class="panel-heading"><div><h2>Register Participant</h2><p class="muted panel-description">Select an event and participant to create a registration.</p></div></div>
          <p id="registration-feedback" class="feedback" role="alert" hidden></p>
          <form id="registration-form" class="registration-form" novalidate>
            <label for="registration-event">Event<select id="registration-event" required><option value="">Select an event</option>${events.map((event) => `<option value="${event.eventId}">${event.eventName} (${event.date})</option>`).join('')}</select></label>
            <label for="registration-participant">Participant<select id="registration-participant" required><option value="">Select a participant</option>${participants.map((participant) => `<option value="${participant.participantId}">${participant.name} — ${participant.email}</option>`).join('')}</select></label>
            <button class="button primary" type="submit">Create Registration</button>
          </form>
        </section>
        <section class="panel">
          <div class="panel-heading"><h2>Registration Records</h2><span class="panel-count">${registrations.length}</span></div>
          ${registrations.length ? `<div class="table-wrap"><table><thead><tr><th>Event</th><th>Participant</th><th>Registration Date</th><th>Status</th></tr></thead><tbody>${registrations.map((registration) => `<tr><td>${eventById[registration.eventId]?.eventName || 'Unknown event'}</td><td>${participantById[registration.participantId]?.name || 'Unknown participant'}</td><td>${registration.registrationDate}</td><td><span class="status">${registration.status}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state-box"><h3>No registrations yet</h3><p>Create the first registration using the form above.</p></div>'}
        </section>
      </main>
    </div>`;

  const form = document.querySelector('#registration-form');
  const eventSelect = document.querySelector('#registration-event');
  const participantSelect = document.querySelector('#registration-participant');
  const feedback = document.querySelector('#registration-feedback');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const eventRecord = events.find((item) => item.eventId === eventSelect.value);
    const participantRecord = participants.find((item) => item.participantId === participantSelect.value);
    const currentRegistrations = getCollection('registrations');
    const eventRegistrations = currentRegistrations.filter((item) => item.eventId === eventSelect.value && item.status !== 'Cancelled');
    const isDuplicate = currentRegistrations.some((item) => item.eventId === eventSelect.value && item.participantId === participantSelect.value && item.status !== 'Cancelled');

    let message = '';
    if (!eventSelect.value) message = 'Please select an event.';
    else if (!eventRecord) message = 'The selected event does not exist.';
    else if (!participantSelect.value) message = 'Please select a participant.';
    else if (!participantRecord) message = 'The selected participant does not exist.';
    else if (isDuplicate) message = 'This participant is already registered for the selected event.';
    else if (eventRegistrations.length >= Number(eventRecord.capacity)) message = 'This event has reached its capacity.';

    if (message) {
      feedback.hidden = false;
      feedback.className = 'feedback error';
      feedback.textContent = message;
      return;
    }

    currentRegistrations.push({ registrationId: `registration-${Date.now()}`, eventId: eventRecord.eventId, participantId: participantRecord.participantId, registrationDate: new Date().toISOString().slice(0, 10), status: 'Registered' });
    saveCollection('registrations', currentRegistrations);
    renderRegistrationsPage();
    const success = document.querySelector('#registration-feedback');
    success.hidden = false;
    success.className = 'feedback success';
    success.textContent = 'Registration created successfully.';
  });

  document.querySelector('#dashboard-link').addEventListener('click', renderApp);
  document.querySelector('#events-link').addEventListener('click', renderEventsPage);
  document.querySelector('#participants-link').addEventListener('click', renderParticipantsPage);
  document.querySelector('#attendance-link').addEventListener('click', renderAttendancePage);
  document.querySelector('#logout').addEventListener('click', () => {
    clearAuthState();
    renderLogin();
  });
}

function renderAttendancePage() {
  const auth = getAuthState();
  if (!auth.isAuthenticated) {
    renderLogin();
    return;
  }

  const events = getCollection('events');
  const participants = getCollection('participants');
  const registrations = getCollection('registrations');
  const attendance = getCollection('attendance');

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div><p class="eyebrow">Event Management System</p><h1>Attendance</h1></div>
        <div class="user-actions"><button id="dashboard-link" class="button secondary">Dashboard</button><button id="events-link" class="button secondary">Events</button><button id="participants-link" class="button secondary">Participants</button><button id="registrations-link" class="button secondary">Registrations</button><span>Signed in as <strong>${auth.username}</strong></span><button id="logout" class="button secondary">Logout</button></div>
      </header>
      <main class="dashboard-content">
        <section class="panel attendance-panel">
          <div class="panel-heading"><div><h2>Mark Attendance</h2><p class="muted panel-description">Only participants registered for the selected event are shown.</p></div></div>
          <label class="attendance-event-label" for="attendance-event">Event<select id="attendance-event"><option value="">Select an event</option>${events.map((event) => `<option value="${event.eventId}">${event.eventName} (${event.date})</option>`).join('')}</select></label>
          <div id="attendance-summary" class="attendance-summary" hidden></div>
          <div id="attendance-list" class="attendance-list"><div class="empty-state-box"><h3>Select an event</h3><p>Choose an event to view its registered participants.</p></div></div>
        </section>
      </main>
    </div>`;

  const eventSelect = document.querySelector('#attendance-event');
  const list = document.querySelector('#attendance-list');
  const summary = document.querySelector('#attendance-summary');

  function updateList() {
    const eventId = eventSelect.value;
    if (!eventId) {
      summary.hidden = true;
      list.innerHTML = '<div class="empty-state-box"><h3>Select an event</h3><p>Choose an event to view its registered participants.</p></div>';
      return;
    }

    const registeredIds = [...new Set(registrations.filter((registration) => registration.eventId === eventId && registration.status !== 'Cancelled').map((registration) => registration.participantId))];
    const registeredParticipants = registeredIds.map((participantId) => participants.find((participant) => participant.participantId === participantId)).filter(Boolean);
    const currentAttendance = attendance.filter((record) => record.eventId === eventId);
    const getStatus = (participantId) => currentAttendance.find((record) => record.participantId === participantId)?.status || '';
    const present = registeredParticipants.filter((participant) => getStatus(participant.participantId) === 'Present').length;
    const absent = registeredParticipants.filter((participant) => getStatus(participant.participantId) === 'Absent').length;
    summary.hidden = false;
    summary.textContent = `Registered: ${registeredParticipants.length} · Present: ${present} · Absent: ${absent}`;

    if (!registeredParticipants.length) {
      list.innerHTML = '<div class="empty-state-box"><h3>No registered participants</h3><p>Register participants for this event before marking attendance.</p></div>';
      return;
    }
    list.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Participant</th><th>Email</th><th>Attendance</th></tr></thead><tbody>${registeredParticipants.map((participant) => `<tr><td><strong>${participant.name}</strong></td><td>${participant.email}</td><td><select class="attendance-status" data-participant-id="${participant.participantId}" aria-label="Attendance for ${participant.name}"><option value="">Not marked</option><option value="Present" ${getStatus(participant.participantId) === 'Present' ? 'selected' : ''}>Present</option><option value="Absent" ${getStatus(participant.participantId) === 'Absent' ? 'selected' : ''}>Absent</option></select></td></tr>`).join('')}</tbody></table></div>`;
    list.onchange = (event) => {
      if (!event.target.classList.contains('attendance-status')) return;
      const participantId = event.target.dataset.participantId;
      const updated = getCollection('attendance').filter((record) => !(record.eventId === eventId && record.participantId === participantId));
      if (event.target.value) updated.push({ attendanceId: `attendance-${Date.now()}-${participantId}`, eventId, participantId, status: event.target.value });
      saveCollection('attendance', updated);
      updateList();
    };
  }

  eventSelect.addEventListener('change', updateList);
  document.querySelector('#dashboard-link').addEventListener('click', renderApp);
  document.querySelector('#events-link').addEventListener('click', renderEventsPage);
  document.querySelector('#participants-link').addEventListener('click', renderParticipantsPage);
  document.querySelector('#registrations-link').addEventListener('click', renderRegistrationsPage);
  document.querySelector('#logout').addEventListener('click', () => {
    clearAuthState();
    renderLogin();
  });
}

function getAuthState() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY)) || { isAuthenticated: false };
  } catch {
    return { isAuthenticated: false };
  }
}

function setAuthState(username) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    isAuthenticated: true,
    userId: 'user-1',
    username,
  }));
}

function clearAuthState() {
  localStorage.removeItem(AUTH_KEY);
}

function renderLogin(error = '') {
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-card" aria-labelledby="login-title">
        <p class="eyebrow">Event Management System</p>
        <h1 id="login-title">Welcome back</h1>
        <p class="muted">Sign in to manage your events and participants.</p>
        ${error ? `<p class="feedback error" role="alert">${error}</p>` : ''}
        <form id="login-form" novalidate>
          <label for="username">Username</label>
          <input id="username" name="username" type="text" autocomplete="username" required />
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
          <button class="button primary" type="submit">Login</button>
        </form>
        <p class="demo-hint">Demo credentials: <strong>admin</strong> / <strong>admin123</strong></p>
      </section>
    </main>`;

  document.querySelector('#login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = form.get('username').trim();
    const password = form.get('password');

    if (!username || !password) {
      renderLogin('Please enter both your username and password.');
      return;
    }
    if (username !== DEMO_CREDENTIALS.username || password !== DEMO_CREDENTIALS.password) {
      renderLogin('Invalid username or password.');
      return;
    }
    setAuthState(username);
    renderApp();
  });
}

function renderApp() {
  const auth = getAuthState();
  if (!auth.isAuthenticated) {
    renderLogin();
    return;
  }

  const data = getDashboardData();
  const recentRegistrations = [...data.registrations].sort((a, b) => b.registrationDate.localeCompare(a.registrationDate)).slice(0, 5);
  const eventById = Object.fromEntries(data.events.map((event) => [event.eventId, event]));
  const participantById = Object.fromEntries(data.participants.map((participant) => [participant.participantId, participant]));

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div><p class="eyebrow">Event Management System</p><h1>Dashboard</h1></div>
        <div class="user-actions"><button id="events-link" class="button secondary">Events</button><button id="participants-link" class="button secondary">Participants</button><button id="registrations-link" class="button secondary">Registrations</button><button id="attendance-link" class="button secondary">Attendance</button><span>Signed in as <strong>${auth.username}</strong></span><button id="logout" class="button secondary">Logout</button></div>
      </header>
      <main class="dashboard-content">
        <section class="stats-grid" aria-label="Dashboard statistics">
          <article class="stat-card"><span>Total Events</span><strong id="total-events">${data.events.length}</strong></article>
          <article class="stat-card"><span>Upcoming Events</span><strong id="upcoming-events">${data.upcomingEvents.length}</strong></article>
          <article class="stat-card"><span>Total Participants</span><strong id="total-participants">${data.participants.length}</strong></article>
          <article class="stat-card"><span>Total Registrations</span><strong id="total-registrations">${data.registrations.length}</strong></article>
          <article class="stat-card"><span>Attendance Rate</span><strong id="attendance-rate">${data.attendanceRate}%</strong></article>
        </section>
        <section class="dashboard-grid">
          <article class="panel">
            <div class="panel-heading"><h2>Upcoming Events</h2><span class="panel-count">${data.upcomingEvents.length}</span></div>
            ${data.upcomingEvents.length ? `<ul class="item-list">${data.upcomingEvents.slice(0, 5).map((event) => `<li><div><strong>${event.eventName}</strong><span>${event.date} · ${event.location}</span></div><span class="status">${event.status}</span></li>`).join('')}</ul>` : '<p class="empty-state">No upcoming events yet.</p>'}
          </article>
          <article class="panel">
            <div class="panel-heading"><h2>Recent Registrations</h2><span class="panel-count">${data.registrations.length}</span></div>
            ${recentRegistrations.length ? `<ul class="item-list">${recentRegistrations.map((registration) => `<li><div><strong>${participantById[registration.participantId]?.name || 'Unknown participant'}</strong><span>${eventById[registration.eventId]?.eventName || 'Unknown event'}</span></div><span class="status">${registration.status}</span></li>`).join('')}</ul>` : '<p class="empty-state">No registrations yet.</p>'}
          </article>
        </section>
        <section class="panel quick-actions">
          <div class="panel-heading"><h2>Quick Actions</h2></div>
          <div class="action-row"><button id="add-event" class="button primary">Add Event</button><button id="add-participant" class="button secondary">Add Participant</button><button id="add-registration" class="button secondary">Register Participant</button></div>
        </section>
      </main>
    </div>`;

  document.querySelector('#logout').addEventListener('click', () => {
    clearAuthState();
    renderLogin();
  });
  document.querySelector('#events-link').addEventListener('click', renderEventsPage);
  document.querySelector('#participants-link').addEventListener('click', renderParticipantsPage);
  document.querySelector('#registrations-link').addEventListener('click', renderRegistrationsPage);
  document.querySelector('#attendance-link').addEventListener('click', renderAttendancePage);

  document.querySelector('#add-event').addEventListener('click', () => {
    const events = getCollection('events');
    events.push({ eventId: `event-${Date.now()}`, eventName: `New Event ${events.length + 1}`, description: '', date: '2099-11-01', time: '09:00', location: 'Main Hall', organizer: auth.username, capacity: 20, status: 'Upcoming' });
    saveCollection('events', events);
    renderApp();
  });

  document.querySelector('#add-participant').addEventListener('click', () => {
    const participants = getCollection('participants');
    participants.push({ participantId: `participant-${Date.now()}`, name: `New Participant ${participants.length + 1}`, email: `participant${Date.now()}@example.com`, phone: '', organisation: '' });
    saveCollection('participants', participants);
    renderApp();
  });

  document.querySelector('#add-registration').addEventListener('click', () => {
    const events = getCollection('events');
    const participants = getCollection('participants');
    const registrations = getCollection('registrations');
    const event = events[0];
    const participant = participants.find((candidate) => !registrations.some((registration) => registration.eventId === event?.eventId && registration.participantId === candidate.participantId));
    if (!event || !participant || registrations.some((registration) => registration.eventId === event.eventId && registration.participantId === participant.participantId)) return;
    registrations.push({ registrationId: `registration-${Date.now()}`, eventId: event.eventId, participantId: participant.participantId, registrationDate: new Date().toISOString().slice(0, 10), status: 'Registered' });
    saveCollection('registrations', registrations);
    renderApp();
  });
}

renderApp();
