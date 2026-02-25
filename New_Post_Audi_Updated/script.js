// ============================================
// AUDITORIUM BOOKING SYSTEM — script.js
// Sri Lanka Postal Service
// ============================================

const API = {
    getData:        'backend/get_data.php',
    bookingHandler: 'backend/booking_handler.php'
};

// ============ CONSTANTS ============
const DEPOSIT       = 15000;
const SERVICE_RATE  = 0.15;
const ADMIN_CREDS   = { user: 'mainadmin', pass: 'postal2024' };

const AUD_NAMES = {
  '1':'Headquarters','2':'Kandy','3':'Jaffna',
  '4':'Badulla','5':'Batticaloa','6':'Mathara','7':'Rathnapura'
};

// ============ STATE ============
let adminLoggedIn      = false;
let currentCalDate     = new Date();
let lastBookingData    = null;  // stored after submit to allow "view"

// Seed demo bookings
function daysFromNow(n){ const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0]; }
function nextWeekday(dow){ const d=new Date(); let delta=(dow-d.getDay()+7)%7||7; d.setDate(d.getDate()+delta); return d.toISOString().split('T')[0]; }

let bookingsDB = [
  { ref:'REF-000101', auditorium:'Jaffna',      date:daysFromNow(5),  checkIn:'09:00', checkOut:'14:00', bookedBy:'Ministry of Education',    dept:'Education',  desig:'Director',  purpose:'Teacher Training',     attendees:150, status:'Approved', phone:'+94 11 234 5678', email:'edu@gov.lk'    },
  { ref:'REF-000102', auditorium:'Headquarters', date:daysFromNow(7),  checkIn:'13:00', checkOut:'17:00', bookedBy:'Colombo Municipal Council', dept:'Municipal',  desig:'Engineer',  purpose:'Staff Annual Meeting',  attendees:300, status:'Approved', phone:'+94 11 234 5679', email:'cmc@gov.lk'    },
  { ref:'REF-000103', auditorium:'Kandy',        date:daysFromNow(3),  checkIn:'10:00', checkOut:'15:00', bookedBy:'Central Province Health',   dept:'Health',     desig:'Dr.',       purpose:'Health Seminar',        attendees:200, status:'Pending',  phone:'+94 81 234 5680', email:'health@gov.lk' },
  { ref:'REF-000104', auditorium:'Headquarters', date:nextWeekday(6),  checkIn:'08:00', checkOut:'12:00', bookedBy:'Colombo Lions Club',        dept:'NGO',        desig:'President', purpose:'Community Fundraiser',  attendees:100, status:'Approved', phone:'+94 11 234 5681', email:'lions@org.lk'  },
  { ref:'REF-000105', auditorium:'Badulla',      date:daysFromNow(10), checkIn:'09:00', checkOut:'12:00', bookedBy:'Badulla Education Office',  dept:'Education',  desig:'Officer',   purpose:'School Prize Giving',   attendees: 80, status:'Approved', phone:'+94 55 234 5682', email:'bad@gov.lk'    },
  { ref:'REF-000106', auditorium:'Mathara',      date:nextWeekday(0),  checkIn:'14:00', checkOut:'18:00', bookedBy:'Southern Traders Assoc.',   dept:'Commerce',   desig:'Chairman',  purpose:'Annual AGM',            attendees: 60, status:'Pending',  phone:'+94 41 234 5683', email:'sta@trade.lk'  },
];

// ============================================
// NAVIGATION
// ============================================
function showTab(event, tabId) {
    event.preventDefault();
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    event.currentTarget.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showBookedTab(event) {
    event.preventDefault();
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('booked-date').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    event.currentTarget.classList.add('active');

    if (!adminLoggedIn) {
        document.getElementById('adminGate').style.display = 'block';
        document.getElementById('adminCMS').style.display  = 'none';
        openAdminLogin();
    } else {
        showCMS();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// DOM READY
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Min date = 3 days ahead (no weekend restriction — weekends allowed)
    const minDate = daysFromNow(3);
    ['selectDate','bookingDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('min', minDate);
    });

    // Availability form
    const dtForm = document.getElementById('dateTimeForm');
    if (dtForm) dtForm.addEventListener('submit', e => {
        e.preventDefault();
        const date    = document.getElementById('selectDate').value;
        const checkIn = document.getElementById('checkInTime').value;
        const checkOut= document.getElementById('checkOutTime').value;
        if (checkIn >= checkOut) { alert('Check-out must be after check-in.'); return; }
        fetchAvailability(date, checkIn, checkOut);
    });

    // Booking form
    const bForm = document.getElementById('bookingForm');
    if (bForm) bForm.addEventListener('submit', e => {
        e.preventDefault();
        submitBooking(bForm);
    });

    // Facility checkbox listeners
    document.querySelectorAll('input[name="facilities"]').forEach(cb =>
        cb.addEventListener('change', calcFees)
    );

    calcFees(); // initial (shows Rs.15,000 baseline)
    loadAuditoriumsDropdown();
});

// ============================================
// AVAILABILITY
// ============================================
function fetchAvailability(date, checkIn, checkOut) {
    const btn = document.querySelector('#dateTimeForm .btn-primary');
    if (btn) { btn.textContent = 'Checking…'; btn.disabled = true; }

    fetch(`${API.getData}?action=get_availability&date=${date}&check_in_time=${checkIn}&check_out_time=${checkOut}`)
        .then(r => r.json())
        .then(d => {
            if (btn) { btn.textContent = 'Check Availability'; btn.disabled = false; }
            displayResults(date, checkIn, checkOut, d.success ? d.data : buildDemoAvailability(date));
        })
        .catch(() => {
            if (btn) { btn.textContent = 'Check Availability'; btn.disabled = false; }
            displayResults(date, checkIn, checkOut, buildDemoAvailability(date));
        });
}

function buildDemoAvailability(date) {
    const auds = [
      {name:'Headquarters',cap:500},{name:'Kandy',cap:300},{name:'Jaffna',cap:250},
      {name:'Badulla',cap:200},{name:'Batticaloa',cap:200},{name:'Mathara',cap:180},{name:'Rathnapura',cap:150}
    ];
    return auds.map(a => {
        const slots = bookingsDB
            .filter(b => b.auditorium === a.name && b.date === date)
            .map(b => ({ time: `${fmtTime(b.checkIn)} – ${fmtTime(b.checkOut)}`, by: b.bookedBy }));
        return { name: a.name, capacity: a.cap, available: slots.length === 0, bookedSlots: slots };
    });
}

function displayResults(date, checkIn, checkOut, auds) {
    const [h, m]  = checkOut.split(':');
    const maintH  = String(parseInt(h) + 1).padStart(2, '0');

    document.getElementById('resultDate').textContent        = fmtDate(date);
    document.getElementById('resultCheckIn').textContent     = fmtTime(checkIn);
    document.getElementById('resultCheckOut').textContent    = fmtTime(checkOut);
    document.getElementById('resultMaintenance').textContent = fmtTime(`${maintH}:${m}`);
    document.getElementById('result').style.display          = 'block';

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    auds.forEach(a => {
        const avail   = a.available !== false;
        const slots   = a.bookedSlots || [];
        const slotHtml = slots.length
            ? slots.map(s => `<div class="slot-pill"><span class="slot-time">🕐 ${s.time}</span><span class="slot-by">Booked by: ${s.by}</span></div>`).join('')
            : '<span class="no-slots">No bookings on this date</span>';

        const actionHtml = avail
            ? `<button class="btn-book-now" onclick="prefillBooking('${a.name}','${date}','${checkIn}','${checkOut}')">Book Now →</button>`
            : `<span class="taken-label">All slots taken</span>`;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${a.name}</strong></td>
          <td>${a.capacity} pax</td>
          <td><span class="status-badge ${avail ? 'status-available':'status-booked'}">${avail ? '✔ Available':'✖ Booked'}</span></td>
          <td class="booking-details">${slotHtml}</td>
          <td>${actionHtml}</td>`;
        tbody.appendChild(row);
    });

    document.getElementById('searchInfo').textContent =
        `Results for ${fmtDate(date)} | ${fmtTime(checkIn)} → ${fmtTime(checkOut)}`;
    document.getElementById('resultsSection').style.display = 'block';
}

function prefillBooking(audName, date, checkIn, checkOut) {
    // Switch to booking tab
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('booking').classList.add('active');
    document.querySelectorAll('.nav-item').forEach((el, i) => {
        el.classList.remove('active');
        if (i === 2) el.classList.add('active'); // "Booking" is 3rd item
    });

    document.getElementById('bookingDate').value = date;
    document.getElementById('bCheckIn').value    = checkIn;
    document.getElementById('bCheckOut').value   = checkOut;

    const sel = document.getElementById('auditoriumSelect');
    for (let opt of sel.options) {
        if (opt.text.startsWith(audName)) { sel.value = opt.value; break; }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToSearch() {
    document.getElementById('resultsSection').style.display = 'none';
}

// ============================================
// AUDITORIUM DROPDOWN (from backend or keep HTML)
// ============================================
function loadAuditoriumsDropdown() {
    fetch(`${API.getData}?action=get_auditoriums`)
        .then(r => r.json())
        .then(d => {
            if (d.success && d.data && d.data.length) {
                const sel = document.getElementById('auditoriumSelect');
                sel.innerHTML = '<option value="">-- Select Auditorium --</option>';
                d.data.forEach(a => {
                    const o = document.createElement('option');
                    o.value = a.id; o.textContent = `${a.name} (Capacity: ${a.capacity})`;
                    sel.appendChild(o);
                });
            }
        }).catch(() => {});
}

// ============================================
// BOOKING SUBMIT
// ============================================
function submitBooking(form) {
    const btn = form.querySelector('.submit-btn');
    if (btn) { btn.textContent = 'Submitting…'; btn.disabled = true; }

    const audId    = document.getElementById('auditoriumSelect').value;
    const audName  = AUD_NAMES[audId] || `Auditorium #${audId}`;
    const selFacs  = [];
    document.querySelectorAll('input[name="facilities"]:checked').forEach(cb =>
        selFacs.push({ name: cb.getAttribute('data-facility'), price: parseFloat(cb.value) })
    );

    const snap = {
        auditorium: audName,
        date:       document.getElementById('bookingDate').value,
        checkIn:    document.getElementById('bCheckIn').value,
        checkOut:   document.getElementById('bCheckOut').value,
        name:       document.getElementById('bName').value,
        email:      document.getElementById('bEmail').value,
        phone:      document.getElementById('bPhone').value,
        dept:       document.getElementById('bDept').value,
        desig:      document.getElementById('bDesig').value,
        purpose:    document.getElementById('bPurpose').value,
        attendees:  document.getElementById('bAttendees').value,
        facilities: selFacs,
        total:      parseFloat(document.getElementById('totalFeeInput').value),
        submitted:  new Date().toLocaleString()
    };

    const fd = new FormData(form);
    fd.append('action', 'submit_booking');

    fetch(API.bookingHandler, { method:'POST', body:fd })
        .then(r => r.json())
        .then(d => {
            if (btn) { btn.textContent = 'Submit Application'; btn.disabled = false; }
            const ref = d.success ? d.reference : genRef();
            snap.ref  = ref;
            finaliseBooking(snap, form);
        })
        .catch(() => {
            if (btn) { btn.textContent = 'Submit Application'; btn.disabled = false; }
            snap.ref = genRef();
            finaliseBooking(snap, form);
        });
}

function genRef() {
    return 'REF-' + String(Math.floor(Math.random() * 999999)).padStart(6,'0');
}

function finaliseBooking(snap, form) {
    // Push to local bookingsDB so admin calendar sees it
    bookingsDB.push({
        ref: snap.ref, auditorium: snap.auditorium, date: snap.date,
        checkIn: snap.checkIn, checkOut: snap.checkOut, bookedBy: snap.name,
        dept: snap.dept, desig: snap.desig, purpose: snap.purpose,
        attendees: snap.attendees, status: 'Pending',
        phone: snap.phone, email: snap.email
    });
    lastBookingData = snap;
    form.reset();
    calcFees();
    openConfirmModal(snap);
}

// ============================================
// FEE CALCULATOR — Deposit & Service Charge AUTO
// ============================================
function calcFees() {
    const map = {
        'Multimedia':     ['multimediaRow','multimediaAmount'],
        'Canteen':        ['canteenRow','canteenAmount'],
        'Sound System':   ['soundRow','soundAmount'],
        'Stage Lighting': ['lightingRow','lightingAmount'],
    };
    Object.values(map).forEach(([r]) => {
        const el = document.getElementById(r); if (el) el.classList.add('hidden');
    });

    let subtotal = 0;
    document.querySelectorAll('input[name="facilities"]:checked').forEach(cb => {
        const fac = cb.getAttribute('data-facility');
        const val = parseFloat(cb.value) || 0;
        if (map[fac]) {
            subtotal += val;
            const [rId, aId] = map[fac];
            const rEl = document.getElementById(rId); if (rEl) rEl.classList.remove('hidden');
            const aEl = document.getElementById(aId); if (aEl) aEl.textContent = fmtCur(val);
        }
    });

    const svc   = subtotal * SERVICE_RATE;
    const total = subtotal + svc + DEPOSIT;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = fmtCur(val); };
    set('subtotalAmount', subtotal);
    set('serviceAmount',  svc);
    set('depositAmount',  DEPOSIT);
    set('totalAmount',    total);

    const inp = document.getElementById('totalFeeInput');
    if (inp) inp.value = total;
}

function fmtCur(n) {
    return 'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

// ============================================
// BOOKING CONFIRMATION MODAL
// ============================================
function openConfirmModal(snap) {
    document.getElementById('confirmRef').textContent = snap.ref;
    const facHtml = snap.facilities.length
        ? snap.facilities.map(f => `<li>${f.name} — ${fmtCur(f.price)}</li>`).join('')
        : '<li><em>No optional facilities selected</em></li>';

    document.getElementById('confirmBody').innerHTML = `
      <div class="conf-section">
        <h4>📅 Reservation</h4>
        <div class="conf-grid">
          <span>Auditorium</span><span>${snap.auditorium}</span>
          <span>Date</span><span>${fmtDate(snap.date)}</span>
          <span>Check In</span><span>${fmtTime(snap.checkIn)}</span>
          <span>Check Out</span><span>${fmtTime(snap.checkOut)}</span>
        </div>
      </div>
      <div class="conf-section">
        <h4>👤 Applicant</h4>
        <div class="conf-grid">
          <span>Name</span><span>${snap.name}</span>
          <span>Email</span><span>${snap.email}</span>
          <span>Phone</span><span>${snap.phone}</span>
          <span>Department</span><span>${snap.dept}</span>
          <span>Designation</span><span>${snap.desig}</span>
          <span>Programme</span><span>${snap.purpose}</span>
          <span>Attendees</span><span>${snap.attendees}</span>
        </div>
      </div>
      <div class="conf-section">
        <h4>🎛️ Optional Facilities Selected</h4>
        <ul class="fac-list">${facHtml}</ul>
      </div>
      <div class="conf-section fee-conf-box">
        <h4>💰 Fee</h4>
        <div class="conf-grid">
          <span>Total Payable</span><span class="conf-total">${fmtCur(snap.total)}</span>
        </div>
        <p class="conf-note">Includes Rs. 15,000 refundable deposit + 15% service charge</p>
      </div>
      <div class="conf-section">
        <span class="status-pending">⏳ Status: Pending Approval</span>
        <p class="conf-submitted">Submitted: ${snap.submitted}</p>
      </div>`;

    document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirm() { document.getElementById('confirmModal').style.display = 'none'; }

function printConfirm() {
    const ref  = document.getElementById('confirmRef').textContent;
    const body = document.getElementById('confirmBody').innerHTML;
    const w = window.open('','_blank');
    w.document.write(`<html><head><title>Booking ${ref}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#333}
        h4{color:#1a5490;margin:14px 0 6px}
        .conf-grid{display:grid;grid-template-columns:140px 1fr;gap:6px 12px;font-size:13px}
        .conf-grid span:nth-child(odd){font-weight:600;color:#666}
        .conf-total{font-size:18px;color:#1e40af;font-weight:700}
        .conf-section{border-bottom:1px solid #eee;padding-bottom:12px;margin-bottom:12px}
        .fac-list{padding-left:20px;font-size:13px}
        .status-pending{background:#fef3c7;color:#92400e;padding:6px 14px;border-radius:15px;font-size:13px}
        .conf-note,.conf-submitted{font-size:11px;color:#9ca3af;margin-top:6px}
        .fee-conf-box{background:#eff6ff;padding:12px;border-radius:8px}
      </style></head><body>
      <h2>Booking Confirmation — ${ref}</h2>${body}</body></html>`);
    w.document.close(); w.print();
}

// ============================================
// PDF VIEWER & DOWNLOAD
// ============================================
function openPdf() {
    document.getElementById('pdfModal').style.display = 'flex';
}
function closePdf() {
    document.getElementById('pdfModal').style.display = 'none';
}
function downloadPdf() {
    const w = window.open('','_blank');
    w.document.write(`<html><head><title>Auditorium Booking Guide</title>
      <style>
        body{font-family:Arial,sans-serif;padding:50px;color:#333;max-width:720px;margin:auto}
        h1{color:#1a5490;text-align:center;font-size:22px}
        h2{color:#555;text-align:center;font-size:15px;font-weight:normal;margin-bottom:24px}
        h3{color:#1a5490;font-size:13px;text-transform:uppercase;letter-spacing:.5px;border-left:4px solid #1a5490;padding-left:10px;margin:22px 0 8px}
        p{line-height:1.8;font-size:13px;margin:4px 0}
        .footer{margin-top:40px;padding-top:14px;border-top:1px solid #ddd;text-align:center;color:#9ca3af;font-size:11px}
        .logo{text-align:center;font-size:16px;font-weight:700;color:#1a5490;letter-spacing:2px;margin-bottom:8px}
        hr{border:none;border-top:2px solid #1a5490;margin:18px 0}
        @media print{body{padding:20px}}
      </style></head><body>
      ${document.getElementById('pdfBody').innerHTML}
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
}

// ============================================
// ADMIN LOGIN / LOGOUT
// ============================================
function openAdminLogin() {
    document.getElementById('adminLoginModal').style.display = 'flex';
    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
    document.getElementById('loginErr').style.display = 'none';
    setTimeout(() => document.getElementById('adminUser').focus(), 120);
}

function cancelAdminLogin() {
    document.getElementById('adminLoginModal').style.display = 'none';
}

function attemptLogin() {
    const u = document.getElementById('adminUser').value.trim();
    const p = document.getElementById('adminPass').value;
    if (u === ADMIN_CREDS.user && p === ADMIN_CREDS.pass) {
        adminLoggedIn = true;
        cancelAdminLogin();
        showAdminHeaderBadge(u);
        document.getElementById('adminGate').style.display = 'none';
        showCMS(u);
    } else {
        document.getElementById('loginErr').style.display = 'block';
    }
}

function adminLogout() {
    adminLoggedIn = false;
    document.getElementById('adminHeaderBadge').innerHTML = '';
    document.getElementById('adminCMS').style.display  = 'none';
    document.getElementById('adminGate').style.display = 'block';
}

function showAdminHeaderBadge(u) {
    document.getElementById('adminHeaderBadge').innerHTML =
        `<div class="admin-hdr-pill">🛡️ Admin: <strong>${u}</strong>
         <button class="hdr-logout" onclick="adminLogout()">Logout</button></div>`;
}

function showCMS(user) {
    document.getElementById('adminCMS').style.display = 'block';
    document.getElementById('adminGate').style.display = 'none';
    if (user) document.getElementById('adminWelcome').textContent = user;
    currentCalDate = new Date();
    renderCal();
    renderBookingsTable();
    // Wire nav buttons
    document.getElementById('prevBtn').onclick  = () => { currentCalDate.setMonth(currentCalDate.getMonth()-1); renderCal(); };
    document.getElementById('nextBtn').onclick  = () => { currentCalDate.setMonth(currentCalDate.getMonth()+1); renderCal(); };
    document.getElementById('todayBtn').onclick = () => { currentCalDate = new Date(); renderCal(); };
}

// ============================================
// ADMIN CALENDAR
// ============================================
function renderCal() {
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const year  = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    document.getElementById('monthYear').textContent = `${MONTHS[month]} ${year}`;

    const container = document.getElementById('daysContainer');
    if (!container) return;
    container.innerHTML = '';

    const filter      = document.getElementById('cmsFilter')?.value || 'all';
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr    = new Date().toISOString().split('T')[0];

    // Build date→bookings index
    const idx = {};
    bookingsDB.forEach(b => {
        if (filter !== 'all' && b.auditorium !== filter) return;
        if (!idx[b.date]) idx[b.date] = [];
        idx[b.date].push(b);
    });

    // Empty prefix cells
    for (let i = 0; i < firstDay; i++) {
        const e = document.createElement('div'); e.className = 'day empty'; container.appendChild(e);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const ds  = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dow = new Date(year, month, d).getDay();
        const isWknd  = dow === 0 || dow === 6;
        const isToday = ds === todayStr;
        const list    = idx[ds];
        const booked  = !!(list && list.length);

        const el = document.createElement('div');
        el.style.cursor = 'pointer';

        if (isToday && booked)    { el.className = 'day today booked-today'; el.innerHTML = `${d}<br><small>Today●${list.length}</small>`; }
        else if (isToday)         { el.className = 'day today';    el.innerHTML = `${d}<br><small>Today</small>`; }
        else if (booked && isWknd){ el.className = 'day booked-wknd'; el.innerHTML = `${d}<br><small>Wknd●${list.length}</small>`; }
        else if (booked)          { el.className = 'day booked';   el.innerHTML = `${d}<br><small>●${list.length} booked</small>`; }
        else if (isWknd)          { el.className = 'day weekend';  el.innerHTML = `${d}<br><small>Weekend</small>`; }
        else                      { el.className = 'day available';el.innerHTML = `${d}<br><small>Free</small>`; }

        el.addEventListener('click', () => showDayDetail(ds, list));
        container.appendChild(el);
    }
}

function showDayDetail(ds, list) {
    const panel = document.getElementById('dayPanel');
    document.getElementById('dayPanelTitle').textContent = `📅 ${fmtDate(ds)}`;

    if (!list || list.length === 0) {
        document.getElementById('dayPanelContent').innerHTML =
            '<div class="panel-empty"><span>✅</span><p>No bookings on this date.</p></div>';
    } else {
        document.getElementById('dayPanelContent').innerHTML = list.map(b => `
          <div class="panel-booking-card">
            <div class="panel-card-hdr">
              <span class="panel-ref">${b.ref}</span>
              <span class="st-badge st-${(b.status||'pending').toLowerCase()}">${b.status}</span>
            </div>
            <div class="panel-card-body">
              <div class="panel-row"><span>🏛️ Auditorium</span><strong>${b.auditorium}</strong></div>
              <div class="panel-row"><span>🕐 Time</span><strong>${fmtTime(b.checkIn)} – ${fmtTime(b.checkOut)}</strong></div>
              <div class="panel-row"><span>👤 Booked By</span><strong>${b.bookedBy}</strong></div>
              <div class="panel-row"><span>🏢 Department</span><strong>${b.dept||b.department||'—'}</strong></div>
              <div class="panel-row"><span>📋 Designation</span><strong>${b.desig||b.designation||'—'}</strong></div>
              <div class="panel-row"><span>🎯 Purpose</span><strong>${b.purpose}</strong></div>
              <div class="panel-row"><span>👥 Attendees</span><strong>${b.attendees}</strong></div>
              <div class="panel-row"><span>📞 Phone</span><strong>${b.phone}</strong></div>
              <div class="panel-row"><span>📧 Email</span><strong>${b.email}</strong></div>
            </div>
          </div>`).join('');
    }

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function closeDayPanel() {
    document.getElementById('dayPanel').style.display = 'none';
}

// ============================================
// ADMIN BOOKINGS TABLE
// ============================================
function renderBookingsTable() {
    const filter = document.getElementById('cmsFilter')?.value || 'all';
    const rows   = filter === 'all' ? bookingsDB : bookingsDB.filter(b => b.auditorium === filter);
    const tbody  = document.getElementById('bookingsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    rows.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="ref-code">${b.ref}</span></td>
          <td><strong>${b.auditorium}</strong></td>
          <td>${fmtDate(b.date)}</td>
          <td>${fmtTime(b.checkIn)}</td>
          <td>${fmtTime(b.checkOut)}</td>
          <td>${b.bookedBy}</td>
          <td>${b.dept||b.department||'—'}</td>
          <td><span class="st-badge st-${(b.status||'pending').toLowerCase()}">${b.status}</span></td>
          <td><button class="btn-view-detail" onclick="openAdminDetail('${b.ref}')">👁 View</button></td>`;
        tbody.appendChild(tr);
    });
}

function openAdminDetail(ref) {
    const b = bookingsDB.find(x => x.ref === ref);
    if (!b) return;
    document.getElementById('adminDetailRef').textContent = ref;
    document.getElementById('adminDetailBody').innerHTML = `
      <div class="conf-section">
        <h4>📅 Reservation</h4>
        <div class="conf-grid">
          <span>Auditorium</span><span>${b.auditorium}</span>
          <span>Date</span><span>${fmtDate(b.date)}</span>
          <span>Check In</span><span>${fmtTime(b.checkIn)}</span>
          <span>Check Out</span><span>${fmtTime(b.checkOut)}</span>
        </div>
      </div>
      <div class="conf-section">
        <h4>👤 Applicant</h4>
        <div class="conf-grid">
          <span>Name</span><span>${b.bookedBy}</span>
          <span>Department</span><span>${b.dept||b.department||'—'}</span>
          <span>Designation</span><span>${b.desig||b.designation||'—'}</span>
          <span>Phone</span><span>${b.phone}</span>
          <span>Email</span><span>${b.email}</span>
          <span>Programme</span><span>${b.purpose}</span>
          <span>Attendees</span><span>${b.attendees}</span>
        </div>
      </div>
      <div class="conf-section">
        <span class="st-badge st-${(b.status||'pending').toLowerCase()}">${b.status}</span>
      </div>`;
    document.getElementById('adminDetailModal').style.display = 'flex';
}

function closeAdminDetail() {
    document.getElementById('adminDetailModal').style.display = 'none';
}

// ============================================
// UTILITY HELPERS
// ============================================
function fmtDate(ds) {
    if (!ds) return '';
    const d = new Date(ds + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
function fmtTime(ts) {
    if (!ts) return '';
    const [h, m] = ts.split(':');
    const hr = parseInt(h), ap = hr >= 12 ? 'PM' : 'AM', h12 = hr % 12 || 12;
    return `${h12}:${m} ${ap}`;
}
