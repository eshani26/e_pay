// =================================================================
// AUDITORIUM BOOKING SYSTEM — script.js  v3.0
// Sri Lanka Postal Service
// =================================================================

const API = {
    getData:        'backend/get_data.php',
    bookingHandler: 'backend/booking_handler.php'
};

// =============== CONSTANTS ===============
const DEPOSIT      = 15000;
const SERVICE_RATE = 0.15;
const AUD_FEE      = 0; // Auditorium fee (set per booking if applicable)

// Two roles: 'maintenance' (calendar only) | 'admin' (full CMS)
const CREDENTIALS = {
    maintenance: { pass: 'maint2024', role: 'maintenance' },
    mainadmin:   { pass: 'postal2024', role: 'admin'      }
};

const AUD_NAMES = {
    '1':'Headquarters','2':'Kandy','3':'Jaffna',
    '4':'Badulla','5':'Batticaloa','6':'Mathara','7':'Rathnapura'
};

// =============== STATE ===============
let currentRole       = null;   // null | 'maintenance' | 'admin'
let currentUser       = null;
let adminCalDate      = new Date();
let maintCalDate      = new Date();
let lastSnap          = null;   // last booking snapshot for print
let currentAdminRef   = null;   // ref currently shown in admin detail modal

// Helper: days from today
function daysFromNow(n) {
    const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0];
}
function nextDow(dow) {
    const d = new Date(); let delta = (dow - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + delta);
    return d.toISOString().split('T')[0];
}

// =============== DEMO BOOKINGS DATABASE ===============
// Each booking: same auditorium can appear multiple times on the same date with different hours
let bookingsDB = [
    { ref:'REF-000101', auditorium:'Jaffna',      date:daysFromNow(5),  checkIn:'09:00', checkOut:'13:00',
      bookedBy:'H.M. Perera', institute:'Ministry of Education', address:'No. 1 Sri Jayawardenepura Kotte',
      dept:'Education', desig:'Director', nic:'196512340987', phone:'+94 11 234 5678', email:'edu@gov.lk',
      purpose:'Teacher Training Workshop', attendees:150, chiefGuest:'Hon. Minister of Education',
      guests:['Prof. K. Silva','Dr. R. Bandara',''], status:'Approved',
      multimedia:true, canteen:true, sound:false, lighting:false },

    // Same auditorium (Jaffna), same day, DIFFERENT hours — demonstrates multi-slot booking
    { ref:'REF-000107', auditorium:'Jaffna',      date:daysFromNow(5),  checkIn:'14:00', checkOut:'17:00',
      bookedBy:'S. Krishnan', institute:'Northern Province Sports Council', address:'Jaffna, Northern Province',
      dept:'Sports', desig:'Secretary', nic:'197803211234', phone:'+94 21 222 3456', email:'sports@np.lk',
      purpose:'Sports Coordination Meeting', attendees:50, chiefGuest:'', guests:['','',''],
      status:'Pending', multimedia:false, canteen:false, sound:true, lighting:false },

    { ref:'REF-000102', auditorium:'Headquarters', date:daysFromNow(7),  checkIn:'13:00', checkOut:'17:00',
      bookedBy:'A.B. Fernando', institute:'Colombo Municipal Council', address:'Town Hall, Colombo 07',
      dept:'Municipal', desig:'Engineer', nic:'198001234567', phone:'+94 11 234 5679', email:'cmc@gov.lk',
      purpose:'Staff Annual Meeting', attendees:300, chiefGuest:'Mayor of Colombo',
      guests:['Deputy Mayor','City Engineer',''], status:'Approved',
      multimedia:true, canteen:true, sound:true, lighting:true },

    { ref:'REF-000103', auditorium:'Kandy',        date:daysFromNow(3),  checkIn:'10:00', checkOut:'15:00',
      bookedBy:'Dr. P. Wijesinghe', institute:'Central Province Health Dept', address:'Kandy, Central Province',
      dept:'Health', desig:'Regional Director', nic:'197505678901', phone:'+94 81 234 5680', email:'health@gov.lk',
      purpose:'Health Awareness Seminar', attendees:200, chiefGuest:'Director General of Health',
      guests:['Dr. N. Perera','',''], status:'Pending',
      multimedia:true, canteen:false, sound:false, lighting:false },

    { ref:'REF-000104', auditorium:'Headquarters', date:nextDow(6),       checkIn:'08:00', checkOut:'12:00',
      bookedBy:'R.M. Jayawardena', institute:'Colombo Lions Club', address:'Liberty Plaza, Colombo 03',
      dept:'NGO', desig:'President', nic:'196812345678', phone:'+94 11 234 5681', email:'lions@org.lk',
      purpose:'Community Fundraiser (Weekend)', attendees:100, chiefGuest:'',
      guests:['','',''], status:'Approved',
      multimedia:false, canteen:true, sound:false, lighting:false },

    { ref:'REF-000105', auditorium:'Badulla',      date:daysFromNow(10), checkIn:'09:00', checkOut:'12:00',
      bookedBy:'W.D. Rathnayake', institute:'Badulla Education Office', address:'Badulla, Uva Province',
      dept:'Education', desig:'Officer', nic:'198509871234', phone:'+94 55 234 5682', email:'bad@gov.lk',
      purpose:'School Prize Giving Ceremony', attendees:80, chiefGuest:'District Superintendent',
      guests:['','',''], status:'Approved',
      multimedia:false, canteen:false, sound:true, lighting:true },

    { ref:'REF-000106', auditorium:'Mathara',      date:nextDow(0),       checkIn:'14:00', checkOut:'18:00',
      bookedBy:'P.K. Gunawardena', institute:'Southern Traders Association', address:'Matara, Southern Province',
      dept:'Commerce', desig:'Chairman', nic:'197201234567', phone:'+94 41 234 5683', email:'sta@trade.lk',
      purpose:'Annual General Meeting (Sunday)', attendees:60, chiefGuest:'',
      guests:['','',''], status:'Pending',
      multimedia:false, canteen:false, sound:false, lighting:false },
];

// =============== NAVIGATION ===============
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
    if (!currentRole) openAdminLogin();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============== DOM READY ===============
document.addEventListener('DOMContentLoaded', () => {
    const minDate = daysFromNow(3);
    ['selectDate','bookingDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('min', minDate);
    });

    const dtForm = document.getElementById('dateTimeForm');
    if (dtForm) dtForm.addEventListener('submit', e => {
        e.preventDefault();
        const date     = document.getElementById('selectDate').value;
        const checkIn  = document.getElementById('checkInTime').value;
        const checkOut = document.getElementById('checkOutTime').value;
        if (checkIn >= checkOut) { alert('Check-out must be after check-in.'); return; }
        fetchAvailability(date, checkIn, checkOut);
    });

    const bForm = document.getElementById('bookingForm');
    if (bForm) bForm.addEventListener('submit', e => {
        e.preventDefault();
        submitBooking(bForm);
    });

    document.querySelectorAll('input[name="facilities"]').forEach(cb =>
        cb.addEventListener('change', calcFees)
    );
    calcFees();
});

// =============== TIME OVERLAP MATH ===============
// Returns true if two time ranges [s1,e1] and [s2,e2] overlap
function timesOverlap(s1, e1, s2, e2) {
    // Convert "HH:MM" → minutes since midnight for easy comparison
    const toMin = t => { const [h,m] = t.split(':'); return parseInt(h)*60 + parseInt(m); };
    return toMin(s1) < toMin(e2) && toMin(e1) > toMin(s2);
}

// =============== AVAILABILITY ===============
function fetchAvailability(date, checkIn, checkOut) {
    const btn = document.querySelector('#dateTimeForm .btn-primary');
    if (btn) { btn.textContent = 'Checking…'; btn.disabled = true; }

    fetch(`${API.getData}?action=get_availability&date=${date}&check_in_time=${checkIn}&check_out_time=${checkOut}`)
        .then(r => r.json())
        .then(d => {
            if (btn) { btn.textContent = 'Check Availability'; btn.disabled = false; }
            displayResults(date, checkIn, checkOut, d.success ? d.data : buildLocalAvailability(date, checkIn, checkOut));
        })
        .catch(() => {
            if (btn) { btn.textContent = 'Check Availability'; btn.disabled = false; }
            displayResults(date, checkIn, checkOut, buildLocalAvailability(date, checkIn, checkOut));
        });
}

function buildLocalAvailability(date, reqIn, reqOut) {
    const auds = [
        {name:'Headquarters',cap:500},{name:'Kandy',cap:300},{name:'Jaffna',cap:250},
        {name:'Badulla',cap:200},{name:'Batticaloa',cap:200},{name:'Mathara',cap:180},{name:'Rathnapura',cap:150}
    ];
    return auds.map(a => {
        // All bookings on this date for this auditorium
        const dayBookings = bookingsDB.filter(b => b.auditorium === a.name && b.date === date);

        // Check if any booking overlaps the requested slot
        const conflicting = dayBookings.filter(b => timesOverlap(reqIn, reqOut, b.checkIn, b.checkOut));

        let slotStatus;
        if (conflicting.length > 0) {
            slotStatus = 'conflict';        // Your hours clash with existing booking
        } else if (dayBookings.length > 0) {
            slotStatus = 'partial';         // Date has bookings but not in your slot
        } else {
            slotStatus = 'available';       // Completely free day
        }

        return {
            name:       a.name,
            capacity:   a.cap,
            slotStatus: slotStatus,
            bookedSlots: dayBookings.map(b => ({
                time:   `${fmtTime(b.checkIn)} – ${fmtTime(b.checkOut)}`,
                by:     b.institute || b.bookedBy,
                status: b.status,
                isConflict: timesOverlap(reqIn, reqOut, b.checkIn, b.checkOut)
            }))
        };
    });
}

function displayResults(date, checkIn, checkOut, auds) {
    const [h, m] = checkOut.split(':');
    const maintH = String(parseInt(h) + 1).padStart(2, '0');

    document.getElementById('resultDate').textContent        = fmtDate(date);
    document.getElementById('resultCheckIn').textContent     = fmtTime(checkIn);
    document.getElementById('resultCheckOut').textContent    = fmtTime(checkOut);
    document.getElementById('resultMaintenance').textContent = fmtTime(`${maintH}:${m}`);
    document.getElementById('result').style.display          = 'block';

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    auds.forEach(a => {
        // Your-slot status badge
        let statusBadge, actionHtml;
        if (a.slotStatus === 'conflict') {
            statusBadge = '<span class="slot-status-badge ss-conflict">❌ Conflict</span><div class="ss-hint">Your hours clash with an existing booking</div>';
            actionHtml  = '<span class="taken-label">Slot unavailable</span>';
        } else if (a.slotStatus === 'partial') {
            statusBadge = '<span class="slot-status-badge ss-partial">⚠️ Partially Booked</span><div class="ss-hint">Other hours on this day are taken — your slot is free</div>';
            actionHtml  = `<button class="btn-book-now" onclick="prefillBooking('${a.name}','${date}','${checkIn}','${checkOut}')">Book Now →</button>`;
        } else {
            statusBadge = '<span class="slot-status-badge ss-avail">✅ Available</span><div class="ss-hint">No bookings on this date</div>';
            actionHtml  = `<button class="btn-book-now" onclick="prefillBooking('${a.name}','${date}','${checkIn}','${checkOut}')">Book Now →</button>`;
        }

        // Existing slots column
        const slotsHtml = (a.bookedSlots && a.bookedSlots.length)
            ? a.bookedSlots.map(s => {
                const conflictClass = s.isConflict ? 'slot-pill slot-conflict' : 'slot-pill';
                const conflictIcon  = s.isConflict ? '⚠️ ' : '🕐 ';
                return `<div class="${conflictClass}">
                  <span class="slot-time">${conflictIcon}${s.time}</span>
                  <span class="slot-by">${s.by}</span>
                  <span class="slot-bstatus">${s.status}</span>
                </div>`;
              }).join('')
            : '<span class="no-slots">No bookings on this date</span>';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${a.name}</strong></td>
          <td>${a.capacity} pax</td>
          <td class="slot-status-cell">${statusBadge}</td>
          <td class="booking-details">${slotsHtml}</td>
          <td>${actionHtml}</td>`;
        tbody.appendChild(row);
    });

    document.getElementById('searchInfo').textContent =
        `Results for ${fmtDate(date)} | Your slot: ${fmtTime(checkIn)} → ${fmtTime(checkOut)}`;
    document.getElementById('resultsSection').style.display = 'block';
}

function prefillBooking(audName, date, checkIn, checkOut) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('booking').classList.add('active');
    document.querySelectorAll('.nav-item').forEach((el, i) => {
        el.classList.remove('active');
        if (i === 2) el.classList.add('active');
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

// =============== BOOKING SUBMIT ===============
function submitBooking(form) {
    const btn = form.querySelector('.submit-btn');
    if (btn) { btn.textContent = 'Submitting…'; btn.disabled = true; }

    const audId   = document.getElementById('auditoriumSelect').value;
    const audName = AUD_NAMES[audId] || `Auditorium #${audId}`;
    const selFacs = [];
    document.querySelectorAll('input[name="facilities"]:checked').forEach(cb =>
        selFacs.push({ name: cb.getAttribute('data-facility'), price: parseFloat(cb.value) })
    );

    const snap = {
        ref:        genRef(),
        auditorium: audName,
        date:       document.getElementById('bookingDate').value,
        checkIn:    document.getElementById('bCheckIn').value,
        checkOut:   document.getElementById('bCheckOut').value,
        institute:  document.getElementById('bInstitute').value,
        address:    document.getElementById('bAddress').value,
        name:       document.getElementById('bName').value,
        nic:        document.getElementById('bNIC').value,
        phone:      document.getElementById('bPhone').value,
        email:      document.getElementById('bEmail').value,
        dept:       document.getElementById('bDept').value,
        desig:      document.getElementById('bDesig').value,
        purpose:    document.getElementById('bPurpose').value,
        attendees:  document.getElementById('bAttendees').value,
        chiefGuest: document.getElementById('bChiefGuest').value,
        guest1:     document.getElementById('bGuest1').value,
        guest2:     document.getElementById('bGuest2').value,
        guest3:     document.getElementById('bGuest3').value,
        facilities: selFacs,
        multimedia: !!document.getElementById('multimedia').checked,
        canteen:    !!document.getElementById('canteen').checked,
        sound:      !!document.getElementById('soundSystem').checked,
        lighting:   !!document.getElementById('lighting').checked,
        total:      parseFloat(document.getElementById('totalFeeInput').value),
        status:     'Pending',
        submitted:  new Date().toLocaleString()
    };

    const fd = new FormData(form);
    fd.append('action', 'submit_booking');

    fetch(API.bookingHandler, { method: 'POST', body: fd })
        .then(r => r.json())
        .then(d => {
            if (btn) { btn.textContent = 'Submit Application'; btn.disabled = false; }
            if (d.success) snap.ref = d.reference;
            finaliseBooking(snap, form);
        })
        .catch(() => {
            if (btn) { btn.textContent = 'Submit Application'; btn.disabled = false; }
            finaliseBooking(snap, form);
        });
}

function genRef() {
    return 'REF-' + String(Math.floor(Math.random() * 999999)).padStart(6, '0');
}

function finaliseBooking(snap, form) {
    // Push into local DB so calendar + availability both update immediately
    bookingsDB.push({
        ref:        snap.ref,
        auditorium: snap.auditorium,
        date:       snap.date,
        checkIn:    snap.checkIn,
        checkOut:   snap.checkOut,
        bookedBy:   snap.name,
        institute:  snap.institute,
        address:    snap.address,
        dept:       snap.dept,
        desig:      snap.desig,
        nic:        snap.nic,
        phone:      snap.phone,
        email:      snap.email,
        purpose:    snap.purpose,
        attendees:  snap.attendees,
        chiefGuest: snap.chiefGuest,
        guests:     [snap.guest1, snap.guest2, snap.guest3],
        multimedia: snap.multimedia,
        canteen:    snap.canteen,
        sound:      snap.sound,
        lighting:   snap.lighting,
        status:     'Pending'
    });

    lastSnap = snap;
    form.reset();
    calcFees();
    openConfirmModal(snap);

    // Refresh calendar if admin is logged in
    if (currentRole === 'admin')       renderAdminCal();
    if (currentRole === 'maintenance') renderMaintCal();
}

// =============== FEE CALCULATOR ===============
function calcFees() {
    const map = {
        'Multimedia':   ['multimediaRow','multimediaAmount'],
        'Canteen':      ['canteenRow',   'canteenAmount'  ],
        'Sound System': ['soundRow',     'soundAmount'    ],
        'Stage Lighting':['lightingRow', 'lightingAmount' ],
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

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = fmtCur(v); };
    set('subtotalAmount', subtotal);
    set('serviceAmount',  svc);
    set('depositAmount',  DEPOSIT);
    set('totalAmount',    total);

    const inp = document.getElementById('totalFeeInput');
    if (inp) inp.value = total;
}

function fmtCur(n) {
    return 'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// =============== CONFIRMATION MODAL ===============
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
        <h4>🏢 Institute</h4>
        <div class="conf-grid">
          <span>Organisation</span><span>${snap.institute}</span>
          <span>Address</span><span>${snap.address}</span>
        </div>
      </div>
      <div class="conf-section">
        <h4>👤 Applicant</h4>
        <div class="conf-grid">
          <span>Name</span><span>${snap.name}</span>
          <span>NIC</span><span>${snap.nic}</span>
          <span>Phone</span><span>${snap.phone}</span>
          <span>Email</span><span>${snap.email}</span>
          <span>Designation</span><span>${snap.desig}</span>
          <span>Department</span><span>${snap.dept}</span>
          <span>Programme</span><span>${snap.purpose}</span>
          <span>Attendees</span><span>${snap.attendees}</span>
        </div>
      </div>
      <div class="conf-section fee-conf-box">
        <h4>💰 Fees</h4>
        <ul class="fac-list">${facHtml}</ul>
        <div class="conf-grid" style="margin-top:10px">
          <span>Total Fee</span><span class="conf-total">${fmtCur(snap.total)}</span>
        </div>
      </div>
      <div class="conf-section">
        <span class="status-pending">⏳ Status: Pending Approval</span>
        <p class="conf-submitted">Submitted: ${snap.submitted}</p>
      </div>`;

    document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirm() { document.getElementById('confirmModal').style.display = 'none'; }

// =============== OFFICIAL PMG PRINT FORM ===============
// Matches the physical form in the photo exactly
function printOfficialForm(snap) {
    const s = snap || lastSnap;
    if (!s) { alert('No booking data available.'); return; }
    openOfficialPrint(s);
}

function printAdminBooking() {
    const b = bookingsDB.find(x => x.ref === currentAdminRef);
    if (!b) return;
    // Convert DB record to snap-like object
    const s = {
        ref: b.ref, auditorium: b.auditorium, date: b.date,
        checkIn: b.checkIn, checkOut: b.checkOut,
        institute: b.institute || b.bookedBy, address: b.address || '—',
        name: b.bookedBy, nic: b.nic || '—', phone: b.phone, email: b.email,
        dept: b.dept, desig: b.desig || b.designation || '—',
        purpose: b.purpose, attendees: b.attendees,
        chiefGuest: b.chiefGuest || '', guest1: (b.guests||[])[0]||'', guest2: (b.guests||[])[1]||'', guest3: (b.guests||[])[2]||'',
        multimedia: b.multimedia, canteen: b.canteen, sound: b.sound, lighting: b.lighting,
        total: calcSnapTotal(b), status: b.status
    };
    openOfficialPrint(s);
}

function calcSnapTotal(b) {
    let sub = 0;
    if (b.multimedia) sub += 9000;
    if (b.canteen)    sub += 4000;
    if (b.sound)      sub += 3500;
    if (b.lighting)   sub += 2500;
    return sub + (sub * SERVICE_RATE) + DEPOSIT;
}

function openOfficialPrint(s) {
    // Compute fees
    let multiFee   = s.multimedia ? 9000 : 0;
    let canteenFee = s.canteen    ? 4000 : 0;
    let soundFee   = s.sound      ? 3500 : 0;
    let lightFee   = s.lighting   ? 2500 : 0;
    let facSub     = multiFee + canteenFee + soundFee + lightFee;
    let svcChg     = facSub * SERVICE_RATE;
    let total      = facSub + svcChg + DEPOSIT;

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>PMG Approval Letter — ${s.ref}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; background:#fff; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 20mm 22mm 18mm 22mm; }

  /* HEADER */
  .form-title { text-align: center; margin-bottom: 18pt; }
  .form-title .main-title { font-size: 13pt; font-weight: bold; text-decoration: underline; letter-spacing: 0.3px; }
  .form-ref { font-size: 10pt; text-align: right; margin-bottom: 6pt; color: #444; }

  /* FIELD ROWS */
  .field-table { width: 100%; border-collapse: collapse; margin-bottom: 2pt; }
  .field-table tr { height: 26pt; }
  .field-num  { width: 32pt; vertical-align: middle; font-size: 11pt; }
  .field-label{ width: 140pt; vertical-align: middle; font-size: 11pt; }
  .field-colon{ width: 12pt; text-align: center; vertical-align: middle; font-size: 11pt; }
  .field-value{ vertical-align: middle; font-size: 11pt; border-bottom: 1px dotted #555; padding-bottom: 2pt; }
  .field-value.blank { color: transparent; }

  /* FACILITIES ROW (item 10) */
  .fac-row { display: flex; gap: 20pt; align-items: center; margin: 4pt 0 6pt 44pt; font-size: 11pt; }
  .fac-box  { display: inline-block; width: 18pt; height: 14pt; border: 1px solid #000; vertical-align: middle; text-align: center; line-height: 14pt; margin-left: 6pt; }

  /* GUESTS LIST */
  .guest-list { margin: 2pt 0 4pt 44pt; font-size: 11pt; }
  .guest-line { display: flex; align-items: flex-end; margin-bottom: 8pt; }
  .guest-num  { width: 16pt; }
  .guest-val  { flex: 1; border-bottom: 1px dotted #555; padding-bottom: 2pt; min-height: 16pt; }

  /* DECLARATION */
  .declaration { margin: 14pt 0 8pt 0; font-size: 11pt; font-style: italic; }

  /* DATE + SIGNATURE LINE */
  .sig-row { display: flex; justify-content: space-between; margin: 12pt 0 6pt 0; }
  .sig-block { width: 45%; }
  .sig-label { font-size: 11pt; margin-bottom: 4pt; }
  .sig-line  { border-bottom: 1px solid #000; margin-top: 18pt; }

  /* SEPARATOR */
  .separator { border: none; border-top: 1.5px solid #000; margin: 14pt 0; }

  /* FEE TABLE */
  .fee-table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
  .fee-table td { font-size: 11pt; padding: 4pt 0; vertical-align: middle; }
  .fee-table .f-label { width: 170pt; }
  .fee-table .f-colon { width: 16pt; text-align: center; }
  .fee-table .f-value { border-bottom: 1px dotted #555; padding-bottom: 2pt; min-width: 80pt; }
  .fee-table .f-total td { font-weight: bold; border-top: 1px solid #000; padding-top: 5pt; }

  /* APPROVAL SIGNATURES */
  .approval-row { display: flex; justify-content: space-between; margin-top: 28pt; }
  .approval-block { width: 44%; }
  .approval-dot-line { border-bottom: 1px dotted #555; margin-bottom: 4pt; min-height: 30pt; }
  .approval-name { font-size: 11pt; font-weight: normal; }

  /* STATUS WATERMARK */
  .status-stamp { 
    position: fixed; top: 50%; right: 20mm; 
    transform: rotate(-30deg) translateY(-50%);
    font-size: 36pt; font-weight: bold; opacity: 0.08;
    color: #1a5490; pointer-events: none; z-index: 0;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; }
    .page { padding: 15mm 20mm; }
    .status-stamp { display: block; }
    @page { margin: 0; size: A4; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="status-stamp">${s.status ? s.status.toUpperCase() : 'PENDING'}</div>

  <div class="form-ref">Reference: ${s.ref} &nbsp;|&nbsp; Submitted: ${s.submitted || new Date().toLocaleString()}</div>

  <div class="form-title">
    <div class="main-title">Application for the Reservation of the Auditorium of the Postal Headquarters</div>
  </div>

  <table class="field-table">
    <tr>
      <td class="field-num">1.</td>
      <td class="field-label">Date of the reservation</td>
      <td class="field-colon">:</td>
      <td class="field-value">${fmtDate(s.date)}</td>
    </tr>
    <tr>
      <td class="field-num">2.</td>
      <td class="field-label">Time range</td>
      <td class="field-colon">:</td>
      <td class="field-value">${fmtTime(s.checkIn)} &nbsp;–&nbsp; ${fmtTime(s.checkOut)} &nbsp;&nbsp; (Auditorium: ${s.auditorium})</td>
    </tr>
    <tr>
      <td class="field-num">3.</td>
      <td class="field-label">Name of the institute</td>
      <td class="field-colon">:</td>
      <td class="field-value">${s.institute || '—'}</td>
    </tr>
    <tr>
      <td class="field-num">4.</td>
      <td class="field-label">Address of the institute</td>
      <td class="field-colon">:</td>
      <td class="field-value">${s.address || '—'}</td>
    </tr>
    <tr>
      <td class="field-num">5.</td>
      <td class="field-label">Applicant's Name</td>
      <td class="field-colon">:</td>
      <td class="field-value">${s.name}</td>
    </tr>
    <tr>
      <td class="field-num">6.</td>
      <td class="field-label">National Identity card No</td>
      <td class="field-colon">:</td>
      <td class="field-value">${s.nic || '—'}</td>
    </tr>
    <tr>
      <td class="field-num">7.</td>
      <td class="field-label">Telephone No</td>
      <td class="field-colon">:</td>
      <td class="field-value">${s.phone}</td>
    </tr>
    <tr>
      <td class="field-num">8.</td>
      <td class="field-label">Nature of the programme</td>
      <td class="field-colon">:</td>
      <td class="field-value">${s.purpose}</td>
    </tr>
    <tr>
      <td class="field-num">9.</td>
      <td class="field-label">Participating group</td>
      <td class="field-colon">:</td>
      <td class="field-value">${s.attendees} participants &nbsp;|&nbsp; Dept: ${s.dept} &nbsp;|&nbsp; ${s.desig}</td>
    </tr>
  </table>

  <!-- ITEM 10: Facilities (matches photo checkboxes) -->
  <table class="field-table">
    <tr>
      <td class="field-num" style="vertical-align:middle;">10.</td>
      <td class="field-label" style="vertical-align:middle;">Other facilities</td>
      <td class="field-colon" style="vertical-align:middle;">:</td>
      <td style="vertical-align:middle; padding:4pt 0;">
        <span style="margin-right:6pt;">Multimedia</span>
        <span class="fac-box">${s.multimedia ? '✓' : ''}</span>
        <span style="margin-left:18pt; margin-right:6pt;">Canteen</span>
        <span class="fac-box">${s.canteen ? '✓' : ''}</span>
        ${s.sound ? '<span style="margin-left:18pt; margin-right:6pt;">Sound System</span><span class="fac-box">✓</span>' : ''}
        ${s.lighting ? '<span style="margin-left:18pt; margin-right:6pt;">Stage Lighting</span><span class="fac-box">✓</span>' : ''}
      </td>
    </tr>
    <tr>
      <td class="field-num">11.</td>
      <td class="field-label">Chief Guest Name</td>
      <td class="field-colon">:</td>
      <td class="field-value">${s.chiefGuest || '&nbsp;'}</td>
    </tr>
  </table>

  <table class="field-table">
    <tr>
      <td class="field-num">12.</td>
      <td class="field-label">Other Special Guests Name</td>
      <td class="field-colon">:</td>
      <td></td>
    </tr>
  </table>
  <div class="guest-list">
    <div class="guest-line"><span class="guest-num">1.</span><span class="guest-val">${s.guest1 || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</span></div>
    <div class="guest-line"><span class="guest-num">2.</span><span class="guest-val">${s.guest2 || '&nbsp;'.repeat(200)}</span></div>
    <div class="guest-line"><span class="guest-num">3.</span><span class="guest-val">${s.guest3 || '&nbsp;'.repeat(200)}</span></div>
  </div>

  <div class="declaration">
    It is declared that agreed with the conditions mentioned overleaf after reading them.
  </div>

  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-label">Date:</div>
      <div class="sig-line"></div>
    </div>
    <div class="sig-block">
      <div class="sig-label">Signature:</div>
      <div class="sig-line"></div>
    </div>
  </div>

  <hr class="separator">

  <!-- FEE TABLE (matches bottom of form in photo) -->
  <table class="fee-table">
    <tr>
      <td class="f-label">Auditorium fee</td>
      <td class="f-colon">:</td>
      <td class="f-value">&nbsp;</td>
    </tr>
    <tr>
      <td class="f-label">Multimedia facility fee</td>
      <td class="f-colon">:</td>
      <td class="f-value">${multiFee > 0 ? fmtCur(multiFee) : '—'}</td>
    </tr>
    <tr>
      <td class="f-label">Canteen facility fee</td>
      <td class="f-colon">:</td>
      <td class="f-value">${canteenFee > 0 ? fmtCur(canteenFee) : '—'}</td>
    </tr>
    <tr>
      <td class="f-label">Service charges</td>
      <td class="f-colon">:</td>
      <td class="f-value">${svcChg > 0 ? fmtCur(svcChg) : '—'}</td>
    </tr>
    <tr>
      <td class="f-label">Refundable deposit amount</td>
      <td class="f-colon">:</td>
      <td class="f-value">${fmtCur(DEPOSIT)}</td>
    </tr>
    <tr class="f-total">
      <td class="f-label"><strong>Total fee</strong></td>
      <td class="f-colon"><strong>:</strong></td>
      <td class="f-value"><strong>${fmtCur(total)}</strong></td>
    </tr>
    <tr>
      <td class="f-label">Cash Receipt Number</td>
      <td class="f-colon">:</td>
      <td class="f-value">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
    </tr>
  </table>

  <!-- APPROVAL SIGNATURES (matches bottom of photo exactly) -->
  <div class="approval-row">
    <div class="approval-block">
      <div class="approval-dot-line"></div>
      <div class="approval-name">Recommended.<br><strong>Assistant Superintendent (HQ)</strong></div>
    </div>
    <div class="approval-block" style="text-align:right;">
      <div class="approval-dot-line"></div>
      <div class="approval-name">Approved.<br><strong>Deputy Post Master (Operation)</strong></div>
    </div>
  </div>

</div>
<script>setTimeout(() => { window.print(); }, 500);</script>
</body></html>`);
    w.document.close();
}

// =============== PDF VIEWER ===============
function openPdf()   { document.getElementById('pdfModal').style.display = 'flex'; }
function closePdf()  { document.getElementById('pdfModal').style.display = 'none'; }
function downloadPdf() {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Auditorium Booking Guide</title>
      <style>
        body{font-family:Arial,sans-serif;padding:50px;color:#333;max-width:720px;margin:auto}
        h1{color:#1a5490;text-align:center;font-size:22px} h2{color:#555;text-align:center;font-size:14px;font-weight:normal;margin-bottom:22px}
        h3{color:#1a5490;font-size:12px;text-transform:uppercase;border-left:4px solid #1a5490;padding-left:10px;margin:20px 0 8px}
        p{line-height:1.85;font-size:13px;margin:4px 0} .footer{margin-top:36px;padding-top:12px;border-top:1px solid #ddd;text-align:center;color:#9ca3af;font-size:11px}
        hr{border:none;border-top:2px solid #1a5490;margin:16px 0}
        @media print{body{padding:20px}}
      </style></head><body>
      ${document.getElementById('pdfBody').innerHTML}
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
}

// =============== STAFF LOGIN / LOGOUT ===============
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
    const u = document.getElementById('adminUser').value.trim().toLowerCase();
    const p = document.getElementById('adminPass').value;
    const cred = CREDENTIALS[u];
    if (cred && cred.pass === p) {
        currentRole = cred.role;
        currentUser = u;
        cancelAdminLogin();
        updateHeaderBadge();
        showCMSByRole();
    } else {
        document.getElementById('loginErr').style.display = 'block';
    }
}

function staffLogout() {
    currentRole = null;
    currentUser = null;
    document.getElementById('adminHeaderBadge').innerHTML = '';
    document.getElementById('adminGate').style.display       = 'block';
    document.getElementById('adminCMS').style.display        = 'none';
    document.getElementById('maintenanceCMS').style.display  = 'none';
}

function updateHeaderBadge() {
    const icon  = currentRole === 'admin' ? '🛡️' : '🔧';
    const label = currentRole === 'admin' ? 'Admin' : 'Maintenance';
    document.getElementById('adminHeaderBadge').innerHTML =
        `<div class="admin-hdr-pill">${icon} ${label}: <strong>${currentUser}</strong>
         <button class="hdr-logout" onclick="staffLogout()">Logout</button></div>`;
}

function showCMSByRole() {
    document.getElementById('adminGate').style.display = 'none';

    if (currentRole === 'maintenance') {
        document.getElementById('maintenanceCMS').style.display = 'block';
        document.getElementById('adminCMS').style.display       = 'none';
        document.getElementById('maintWelcome').textContent     = currentUser;
        maintCalDate = new Date();
        renderMaintCal();
        document.getElementById('maintPrevBtn').onclick  = () => { maintCalDate.setMonth(maintCalDate.getMonth()-1); renderMaintCal(); };
        document.getElementById('maintNextBtn').onclick  = () => { maintCalDate.setMonth(maintCalDate.getMonth()+1); renderMaintCal(); };
        document.getElementById('maintTodayBtn').onclick = () => { maintCalDate = new Date(); renderMaintCal(); };
    } else {
        document.getElementById('maintenanceCMS').style.display = 'none';
        document.getElementById('adminCMS').style.display       = 'block';
        document.getElementById('adminWelcome').textContent     = currentUser;
        adminCalDate = new Date();
        renderAdminCal();
        renderBookingsTable();
        document.getElementById('prevBtn').onclick  = () => { adminCalDate.setMonth(adminCalDate.getMonth()-1); renderAdminCal(); };
        document.getElementById('nextBtn').onclick  = () => { adminCalDate.setMonth(adminCalDate.getMonth()+1); renderAdminCal(); };
        document.getElementById('todayBtn').onclick = () => { adminCalDate = new Date(); renderAdminCal(); };
    }
}

// =============== MAINTENANCE CALENDAR (dates + times only, no personal data) ===============
function renderMaintCal() {
    const filter = document.getElementById('maintFilter')?.value || 'all';
    renderCalendar('maintDaysContainer', 'maintMonthYear', maintCalDate, filter, false);
}

// =============== ADMIN CALENDAR (full data) ===============
function renderAdminCal() {
    const filter = document.getElementById('cmsFilter')?.value || 'all';
    renderCalendar('daysContainer', 'monthYear', adminCalDate, filter, true);
}

// Shared calendar renderer. isAdmin controls whether day click shows details or not.
function renderCalendar(containerId, headerEl, calDate, filter, isAdmin) {
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const year   = calDate.getFullYear();
    const month  = calDate.getMonth();
    const hdr    = document.getElementById(headerEl);
    if (hdr) hdr.textContent = `${MONTHS[month]} ${year}`;

    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const todayStr    = new Date().toISOString().split('T')[0];
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Build date index
    const idx = {};
    bookingsDB.forEach(b => {
        if (filter !== 'all' && b.auditorium !== filter) return;
        if (!idx[b.date]) idx[b.date] = [];
        idx[b.date].push(b);
    });

    // Empty prefix
    for (let i = 0; i < firstDay; i++) {
        const e = document.createElement('div'); e.className = 'day empty'; container.appendChild(e);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const ds     = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dow    = new Date(year, month, d).getDay();
        const isWknd = dow === 0 || dow === 6;
        const isTdy  = ds === todayStr;
        const list   = idx[ds];
        const booked = !!(list && list.length);

        const el = document.createElement('div');
        el.style.cursor = 'pointer';

        if      (isTdy && booked)  { el.className = 'day today booked-today'; el.innerHTML = `${d}<br><small>Today ●${list.length}</small>`; }
        else if (isTdy)            { el.className = 'day today';    el.innerHTML = `${d}<br><small>Today</small>`; }
        else if (booked && isWknd) { el.className = 'day booked-wknd'; el.innerHTML = `${d}<br><small>Wknd ●${list.length}</small>`; }
        else if (booked)           { el.className = 'day booked';   el.innerHTML = `${d}<br><small>●${list.length} booking${list.length>1?'s':''}</small>`; }
        else if (isWknd)           { el.className = 'day weekend';  el.innerHTML = `${d}<br><small>Weekend</small>`; }
        else                       { el.className = 'day available';el.innerHTML = `${d}<br><small>Free</small>`; }

        el.addEventListener('click', () => {
            if (isAdmin) showAdminDayDetail(ds, list);
            else         showMaintDayDetail(ds, list);
        });
        container.appendChild(el);
    }
}

// Maintenance day detail — shows auditorium name + time only
function showMaintDayDetail(ds, list) {
    const panel = document.getElementById('maintDayPanel');
    document.getElementById('maintDayTitle').textContent = `📅 ${fmtDate(ds)}`;

    if (!list || !list.length) {
        document.getElementById('maintDayContent').innerHTML =
            '<div class="panel-empty"><span>✅</span><p>No bookings on this date — auditorium is available.</p></div>';
    } else {
        document.getElementById('maintDayContent').innerHTML = list.map(b => `
          <div class="panel-booking-card maint-card">
            <div class="panel-card-hdr">
              <span class="panel-ref">📋 ${b.auditorium}</span>
              <span class="st-badge st-${(b.status||'pending').toLowerCase()}">${b.status}</span>
            </div>
            <div class="panel-card-body">
              <div class="panel-row"><span>🕐 Time Slot</span><strong>${fmtTime(b.checkIn)} – ${fmtTime(b.checkOut)}</strong></div>
              <div class="panel-row maint-restricted"><span>👤 Booked By</span><strong class="redacted">● ● ● ● ● ●</strong></div>
              <div class="maint-note">Personal details are restricted to system administrators.</div>
            </div>
          </div>`).join('');
    }
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Admin day detail — full information
function showAdminDayDetail(ds, list) {
    const panel = document.getElementById('dayPanel');
    document.getElementById('dayPanelTitle').textContent = `📅 ${fmtDate(ds)}`;

    if (!list || !list.length) {
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
              <div class="panel-row"><span>🏢 Institute</span><strong>${b.institute||b.bookedBy}</strong></div>
              <div class="panel-row"><span>👤 Applicant</span><strong>${b.bookedBy}</strong></div>
              <div class="panel-row"><span>🪪 NIC</span><strong>${b.nic||'—'}</strong></div>
              <div class="panel-row"><span>🏷️ Dept / Desig</span><strong>${b.dept||'—'} / ${b.desig||b.designation||'—'}</strong></div>
              <div class="panel-row"><span>🎯 Purpose</span><strong>${b.purpose}</strong></div>
              <div class="panel-row"><span>👥 Attendees</span><strong>${b.attendees}</strong></div>
              <div class="panel-row"><span>📞 Phone</span><strong>${b.phone}</strong></div>
              <div class="panel-row"><span>📧 Email</span><strong>${b.email}</strong></div>
            </div>
          </div>`).join('');
    }
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeDayPanel() { document.getElementById('dayPanel').style.display = 'none'; }

// =============== ADMIN BOOKINGS TABLE ===============
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
          <td>${b.institute||'—'}</td>
          <td><span class="st-badge st-${(b.status||'pending').toLowerCase()}">${b.status}</span></td>
          <td><button class="btn-view-detail" onclick="openAdminDetail('${b.ref}')">👁 View</button></td>`;
        tbody.appendChild(tr);
    });
}

function openAdminDetail(ref) {
    currentAdminRef = ref;
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
        <h4>🏢 Institute</h4>
        <div class="conf-grid">
          <span>Organisation</span><span>${b.institute||b.bookedBy}</span>
          <span>Address</span><span>${b.address||'—'}</span>
        </div>
      </div>
      <div class="conf-section">
        <h4>👤 Applicant</h4>
        <div class="conf-grid">
          <span>Name</span><span>${b.bookedBy}</span>
          <span>NIC</span><span>${b.nic||'—'}</span>
          <span>Phone</span><span>${b.phone}</span>
          <span>Email</span><span>${b.email}</span>
          <span>Designation</span><span>${b.desig||b.designation||'—'}</span>
          <span>Department</span><span>${b.dept||b.department||'—'}</span>
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
    currentAdminRef = null;
}

// =============== UTILITY ===============
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
