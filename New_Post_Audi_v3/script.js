// ============================================
// AUDITORIUM BOOKING SYSTEM — script.js
// Sri Lanka Postal Service
// ============================================

const API = {
    getData:        'backend/get_data.php',
    bookingHandler: 'backend/booking_handler.php'
};

// ════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════
const DEPOSIT      = 15000;
const SERVICE_RATE = 0.15;

const CREDS = {
    admin:       { user:'mainadmin',   pass:'postal2024',  role:'admin'       },
    maintenance: { user:'maintenance', pass:'maint2024',   role:'maintenance' }
};

const AUD_NAMES = {
    '1':'Headquarters','2':'Kandy','3':'Jaffna',
    '4':'Badulla','5':'Batticaloa','6':'Mathara','7':'Rathnapura'
};

// ════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════
let currentRole       = null;   // 'admin' | 'maintenance' | null
let currentUser       = '';
let adminCalDate      = new Date();
let maintCalDate      = new Date();
let currentViewSnap   = null;   // booking currently open in admin detail modal

// ────────────────────────────────────────────
// DEMO BOOKINGS DATABASE
// ────────────────────────────────────────────
function daysFromNow(n){ const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0]; }
function nextDow(dow)  { const d=new Date(); let delta=(dow-d.getDay()+7)%7||7; d.setDate(d.getDate()+delta); return d.toISOString().split('T')[0]; }

let bookingsDB = [
    {
        ref:'REF-000101', auditorium:'Jaffna',      date:daysFromNow(5),
        checkIn:'09:00',  checkOut:'14:00',
        bookedBy:'Mr. Pradeep Silva', institute:'Ministry of Education', address:'Isurupaya, Battaramulla',
        nic:'197512345678', phone:'+94 11 234 5678', email:'edu@gov.lk', desig:'Director',
        purpose:'Teacher Training Workshop', group:'Western Province Teachers', attendees:150,
        chiefGuest:'Hon. Minister of Education', guests:['Director General of Education',''],
        hasMM:true, hasCanteen:false, status:'Approved'
    },
    {
        ref:'REF-000102', auditorium:'Headquarters', date:daysFromNow(7),
        checkIn:'13:00',  checkOut:'17:00',
        bookedBy:'Ms. Nirmala Perera', institute:'Colombo Municipal Council', address:'Town Hall, Colombo 07',
        nic:'198012345679', phone:'+94 11 234 5679', email:'cmc@gov.lk', desig:'Director',
        purpose:'Staff Annual Meeting', group:'All CMC Staff', attendees:300,
        chiefGuest:'Mayor of Colombo', guests:['Deputy Mayor',''],
        hasMM:true, hasCanteen:true, status:'Approved'
    },
    {
        ref:'REF-000103', auditorium:'Headquarters', date:daysFromNow(7),
        checkIn:'08:00',  checkOut:'11:30',
        bookedBy:'Mr. Roshan Fernando', institute:'Sri Lanka Customs', address:'Customs House, Colombo 01',
        nic:'198312345680', phone:'+94 11 234 5680', email:'customs@gov.lk', desig:'Superintendent',
        purpose:'Staff Orientation Programme', group:'New Recruits 2025', attendees:80,
        chiefGuest:'Director General of Customs', guests:['',''],
        hasMM:false, hasCanteen:false, status:'Approved'
    },
    {
        ref:'REF-000104', auditorium:'Kandy',        date:daysFromNow(3),
        checkIn:'10:00',  checkOut:'15:00',
        bookedBy:'Dr. Anura Dissanayake', institute:'Central Province Health Dept.', address:'No. 12, Peradeniya Rd, Kandy',
        nic:'197812345681', phone:'+94 81 234 5681', email:'health@cp.gov.lk', desig:'Deputy Director',
        purpose:'Community Health Awareness Seminar', group:'Health Officers — Central Province', attendees:200,
        chiefGuest:'Provincial Health Director', guests:['WHO Representative',''],
        hasMM:true, hasCanteen:true, status:'Pending'
    },
    {
        ref:'REF-000105', auditorium:'Headquarters', date:nextDow(6),
        checkIn:'08:00',  checkOut:'12:00',
        bookedBy:'Mr. Chaminda Rathnayake', institute:'Colombo Lions Club', address:'No. 45, Galle Road, Colombo 03',
        nic:'197012345682', phone:'+94 11 234 5682', email:'lions@org.lk', desig:'President',
        purpose:'Community Fundraiser', group:'Lions Club Members and Public', attendees:100,
        chiefGuest:'', guests:['',''],
        hasMM:false, hasCanteen:true, status:'Approved'
    },
    {
        ref:'REF-000106', auditorium:'Badulla',      date:daysFromNow(10),
        checkIn:'09:00',  checkOut:'12:00',
        bookedBy:'Mrs. Kamala Jayaweera', institute:'Badulla Education Office', address:'No. 7, Badulla Road, Badulla',
        nic:'198712345683', phone:'+94 55 234 5683', email:'bad@moe.gov.lk', desig:'Assistant Director',
        purpose:'Annual Prize Giving', group:'Students and Parents', attendees:80,
        chiefGuest:'Zonal Director of Education', guests:['Principal of Badulla Central College',''],
        hasMM:true, hasCanteen:false, status:'Approved'
    },
    {
        ref:'REF-000107', auditorium:'Mathara',      date:nextDow(0),
        checkIn:'14:00',  checkOut:'18:00',
        bookedBy:'Mr. Lasantha Bandara', institute:'Southern Traders Association', address:'No. 22, Galle Road, Matara',
        nic:'196812345684', phone:'+94 41 234 5684', email:'sta@trade.lk', desig:'Chairman',
        purpose:'Annual General Meeting', group:'Association Members', attendees:60,
        chiefGuest:'', guests:['',''],
        hasMM:false, hasCanteen:false, status:'Pending'
    },
];

// ════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════
function showTab(event, tabId) {
    event.preventDefault();
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    event.currentTarget.classList.add('active');
    window.scrollTo({ top:0, behavior:'smooth' });
}

function showBookedTab(event) {
    event.preventDefault();
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('booked-date').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    event.currentTarget.classList.add('active');
    if (!currentRole) {
        showGate();
        openAdminLogin();
    } else {
        showRoleView();
    }
    window.scrollTo({ top:0, behavior:'smooth' });
}

function showGate() {
    document.getElementById('adminGate').style.display = 'block';
    document.getElementById('maintView').style.display = 'none';
    document.getElementById('adminCMS').style.display  = 'none';
}

function showRoleView() {
    document.getElementById('adminGate').style.display = 'none';
    if (currentRole === 'maintenance') {
        document.getElementById('maintView').style.display = 'block';
        document.getElementById('adminCMS').style.display  = 'none';
        const mw = document.getElementById('maintWelcome');
        if (mw) mw.textContent = currentUser;
        initMaintCalendar();
    } else {
        document.getElementById('maintView').style.display = 'none';
        document.getElementById('adminCMS').style.display  = 'block';
        const aw = document.getElementById('adminWelcome');
        if (aw) aw.textContent = currentUser;
        initAdminCalendar();
        renderBookingsTable();
    }
}

// ════════════════════════════════════════════
// DOM READY
// ════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    const minDate = daysFromNow(3);
    ['selectDate','bookingDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('min', minDate);
    });

    const dtForm = document.getElementById('dateTimeForm');
    if (dtForm) dtForm.addEventListener('submit', e => {
        e.preventDefault();
        const date    = document.getElementById('selectDate').value;
        const checkIn = document.getElementById('checkInTime').value;
        const checkOut= document.getElementById('checkOutTime').value;
        if (checkIn >= checkOut) { alert('Check-out time must be after check-in time.'); return; }
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
    loadAuditoriumsDropdown();
});

// ════════════════════════════════════════════
// AVAILABILITY — with hourly conflict detection
// ════════════════════════════════════════════
function timesOverlap(s1, e1, s2, e2) {
    // Returns true if [s1,e1) overlaps [s2,e2)
    return s1 < e2 && e1 > s2;
}

function fetchAvailability(date, checkIn, checkOut) {
    const btn = document.querySelector('#dateTimeForm .btn-primary');
    if (btn) { btn.textContent = 'Checking…'; btn.disabled = true; }

    fetch(`${API.getData}?action=get_availability&date=${date}&check_in_time=${checkIn}&check_out_time=${checkOut}`)
        .then(r => r.json())
        .then(d => {
            if (btn) { btn.textContent = 'Check Availability'; btn.disabled = false; }
            displayResults(date, checkIn, checkOut, d.success ? d.data : buildDemoAvailability(date, checkIn, checkOut));
        })
        .catch(() => {
            if (btn) { btn.textContent = 'Check Availability'; btn.disabled = false; }
            displayResults(date, checkIn, checkOut, buildDemoAvailability(date, checkIn, checkOut));
        });
}

function buildDemoAvailability(date, reqIn, reqOut) {
    const auds = [
        {name:'Headquarters',cap:500},{name:'Kandy',cap:300},{name:'Jaffna',cap:250},
        {name:'Badulla',cap:200},{name:'Batticaloa',cap:200},{name:'Mathara',cap:180},{name:'Rathnapura',cap:150}
    ];

    return auds.map(a => {
        // All bookings for this auditorium on this date
        const dayBookings = bookingsDB.filter(b => b.auditorium === a.name && b.date === date);

        // Check if requested slot conflicts with any booking
        const conflicts = dayBookings.filter(b =>
            timesOverlap(reqIn, reqOut, b.checkIn, b.checkOut)
        );

        // Build slot list with status
        const bookedSlots = dayBookings.map(b => ({
            time:      `${fmtTime(b.checkIn)} – ${fmtTime(b.checkOut)}`,
            by:        b.bookedBy,
            institute: b.institute || '',
            status:    b.status,
            conflicts: timesOverlap(reqIn, reqOut, b.checkIn, b.checkOut)
        }));

        let slotStatus; // 'free' | 'partial' | 'conflict'
        if (conflicts.length > 0)        slotStatus = 'conflict';
        else if (dayBookings.length > 0) slotStatus = 'partial';
        else                             slotStatus = 'free';

        return {
            name:       a.name,
            capacity:   a.cap,
            slotStatus,
            bookedSlots
        };
    });
}

function displayResults(date, checkIn, checkOut, auds) {
    const [h,m] = checkOut.split(':');
    const mH    = String(parseInt(h)+1).padStart(2,'0');

    document.getElementById('resultDate').textContent        = fmtDate(date);
    document.getElementById('resultCheckIn').textContent     = fmtTime(checkIn);
    document.getElementById('resultCheckOut').textContent    = fmtTime(checkOut);
    document.getElementById('resultMaintenance').textContent = fmtTime(`${mH}:${m}`);
    document.getElementById('result').style.display          = 'block';

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    auds.forEach(a => {
        const st    = a.slotStatus || 'free';
        const slots = a.bookedSlots || [];

        // Status badge HTML
        const statusHtml = {
            free:     `<span class="status-badge status-available">✔ Your Slot is Free</span>`,
            partial:  `<span class="status-badge status-partial">⚡ Other Hours Booked<br><small>Your slot available</small></span>`,
            conflict: `<span class="status-badge status-booked">✖ Slot Conflict<br><small>Choose different time</small></span>`
        }[st];

        // Booked slots column
        const slotHtml = slots.length
            ? slots.map(s => `
                <div class="slot-pill ${s.conflicts ? 'slot-conflict':''}" title="${s.conflicts ? 'CONFLICTS with your requested time':''}">
                  <span class="slot-time">${s.conflicts ? '⚠ ':''} ${s.time}</span>
                  <span class="slot-by">by: ${s.by}</span>
                  <span class="slot-sts st-badge-sm st-${(s.status||'pending').toLowerCase()}">${s.status}</span>
                </div>`).join('')
            : `<span class="no-slots">✅ No bookings on this date</span>`;

        // Action button
        const actionHtml = st !== 'conflict'
            ? `<button class="btn-book-now" onclick="prefillBooking('${a.name}','${date}','${checkIn}','${checkOut}')">Book Now →</button>`
            : `<div class="taken-label">⚠ Time Conflict<br><small>Pick another slot</small></div>`;

        const row = document.createElement('tr');
        if (st === 'conflict') row.classList.add('row-conflict');
        if (st === 'partial')  row.classList.add('row-partial');

        row.innerHTML = `
          <td><strong>${a.name}</strong></td>
          <td>${a.capacity} pax</td>
          <td>${statusHtml}</td>
          <td class="booking-details">${slotHtml}</td>
          <td>${actionHtml}</td>`;
        tbody.appendChild(row);
    });

    document.getElementById('searchInfo').textContent =
        `Results for ${fmtDate(date)} | ${fmtTime(checkIn)} → ${fmtTime(checkOut)}`;
    document.getElementById('resultsSection').style.display = 'block';
}

function clearResults() {
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('result').style.display = 'none';
    document.getElementById('dateTimeForm').reset();
}

function prefillBooking(audName, date, checkIn, checkOut) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('booking').classList.add('active');
    document.querySelectorAll('.nav-item').forEach((el,i) => {
        el.classList.remove('active');
        if (i===2) el.classList.add('active');
    });
    document.getElementById('bookingDate').value = date;
    document.getElementById('bCheckIn').value    = checkIn;
    document.getElementById('bCheckOut').value   = checkOut;
    const sel = document.getElementById('auditoriumSelect');
    for (let o of sel.options) { if (o.text.startsWith(audName)) { sel.value=o.value; break; } }
    window.scrollTo({ top:0, behavior:'smooth' });
}

function backToSearch() { document.getElementById('resultsSection').style.display='none'; }

// ════════════════════════════════════════════
// AUDITORIUM DROPDOWN
// ════════════════════════════════════════════
function loadAuditoriumsDropdown() {
    fetch(`${API.getData}?action=get_auditoriums`)
        .then(r=>r.json())
        .then(d=>{
            if (d.success && d.data && d.data.length) {
                const sel = document.getElementById('auditoriumSelect');
                sel.innerHTML = '<option value="">-- Select Auditorium --</option>';
                d.data.forEach(a => {
                    const o = document.createElement('option');
                    o.value=a.id; o.textContent=`${a.name} (Capacity: ${a.capacity})`;
                    sel.appendChild(o);
                });
            }
        }).catch(()=>{});
}

// ════════════════════════════════════════════
// BOOKING SUBMIT
// ════════════════════════════════════════════
function submitBooking(form) {
    const btn = form.querySelector('.submit-btn');
    if (btn) { btn.textContent='Submitting…'; btn.disabled=true; }

    const audId   = document.getElementById('auditoriumSelect').value;
    const audName = AUD_NAMES[audId] || `Auditorium #${audId}`;

    // Conflict check before submitting
    const date    = document.getElementById('bookingDate').value;
    const checkIn = document.getElementById('bCheckIn').value;
    const checkOut= document.getElementById('bCheckOut').value;

    if (checkIn >= checkOut) {
        alert('Check-out time must be after check-in time.');
        if (btn) { btn.textContent='Submit Application'; btn.disabled=false; }
        return;
    }

    const conflicts = bookingsDB.filter(b =>
        b.auditorium === audName &&
        b.date === date &&
        timesOverlap(checkIn, checkOut, b.checkIn, b.checkOut)
    );

    if (conflicts.length > 0) {
        const slotList = conflicts.map(b => `  • ${fmtTime(b.checkIn)}–${fmtTime(b.checkOut)} (${b.bookedBy})`).join('\n');
        alert(`⚠ Time Conflict!\n\n${audName} on ${fmtDate(date)} already has a booking that overlaps your requested time:\n\n${slotList}\n\nPlease choose a different time slot.`);
        if (btn) { btn.textContent='Submit Application'; btn.disabled=false; }
        return;
    }

    const hasMM  = document.getElementById('multimedia').checked;
    const hasCanteen = document.getElementById('canteen').checked;

    const snap = {
        ref:         '',
        auditorium:  audName,
        date,
        checkIn,
        checkOut,
        bookedBy:    document.getElementById('bName').value,
        institute:   document.getElementById('bInstitute').value,
        address:     document.getElementById('bAddress').value,
        nic:         document.getElementById('bNic').value,
        phone:       document.getElementById('bPhone').value,
        email:       document.getElementById('bEmail').value,
        desig:       document.getElementById('bDesig').value,
        purpose:     document.getElementById('bPurpose').value,
        group:       document.getElementById('bGroup').value,
        attendees:   document.getElementById('bAttendees').value,
        chiefGuest:  document.getElementById('bChiefGuest').value,
        guests:      [
                       document.getElementById('bGuest1').value,
                       document.getElementById('bGuest2').value,
                       document.getElementById('bGuest3').value
                     ],
        hasMM,
        hasCanteen,
        total:       parseFloat(document.getElementById('totalFeeInput').value),
        submitted:   new Date().toLocaleString(),
        status:      'Pending'
    };

    const fd = new FormData(form);
    fd.append('action','submit_booking');

    fetch(API.bookingHandler,{method:'POST',body:fd})
        .then(r=>r.json())
        .then(d=>{
            if (btn) { btn.textContent='Submit Application'; btn.disabled=false; }
            snap.ref = d.success ? d.reference : genRef();
            finaliseBooking(snap, form);
        })
        .catch(()=>{
            if (btn) { btn.textContent='Submit Application'; btn.disabled=false; }
            snap.ref = genRef();
            finaliseBooking(snap, form);
        });
}

function genRef() {
    return 'REF-' + String(Math.floor(Math.random()*999999)).padStart(6,'0');
}

function finaliseBooking(snap, form) {
    bookingsDB.push({
        ref:       snap.ref,
        auditorium:snap.auditorium,
        date:      snap.date,
        checkIn:   snap.checkIn,
        checkOut:  snap.checkOut,
        bookedBy:  snap.bookedBy,
        institute: snap.institute,
        address:   snap.address,
        nic:       snap.nic,
        phone:     snap.phone,
        email:     snap.email,
        desig:     snap.desig,
        purpose:   snap.purpose,
        group:     snap.group,
        attendees: snap.attendees,
        chiefGuest:snap.chiefGuest,
        guests:    snap.guests,
        hasMM:     snap.hasMM,
        hasCanteen:snap.hasCanteen,
        status:    'Pending'
    });

    currentViewSnap = snap;
    form.reset();
    calcFees();
    openConfirmModal(snap);
}

// ════════════════════════════════════════════
// FEE CALCULATOR
// ════════════════════════════════════════════
function calcFees() {
    const map = {
        'Multimedia':['multimediaRow','multimediaAmount'],
        'Canteen':   ['canteenRow','canteenAmount'],
    };
    Object.values(map).forEach(([r])=>{ const el=document.getElementById(r); if(el) el.classList.add('hidden'); });

    let subtotal = 0;
    document.querySelectorAll('input[name="facilities"]:checked').forEach(cb=>{
        const fac = cb.getAttribute('data-facility');
        const val = parseFloat(cb.value)||0;
        if (map[fac]) {
            subtotal+=val;
            const [rId,aId]=map[fac];
            const rEl=document.getElementById(rId); if(rEl) rEl.classList.remove('hidden');
            const aEl=document.getElementById(aId); if(aEl) aEl.textContent=fmtCur(val);
        }
    });

    const svc   = subtotal*SERVICE_RATE;
    const total = subtotal+svc+DEPOSIT;

    const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=fmtCur(v); };
    set('subtotalAmount', subtotal);
    set('serviceAmount',  svc);
    set('depositAmount',  DEPOSIT);
    set('totalAmount',    total);

    const inp=document.getElementById('totalFeeInput');
    if (inp) inp.value=total;
}

function fmtCur(n) {
    return 'Rs. '+n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
}

// ════════════════════════════════════════════
// BOOKING CONFIRMATION MODAL
// ════════════════════════════════════════════
function openConfirmModal(snap) {
    document.getElementById('confirmRef').textContent = snap.ref;

    const mmFee  = snap.hasMM      ? 9000 : 0;
    const canFee = snap.hasCanteen ? 4000 : 0;
    const subTot = mmFee + canFee;
    const svcFee = subTot * SERVICE_RATE;

    document.getElementById('confirmBody').innerHTML = `
      <div class="conf-section">
        <h4>📅 Reservation Details</h4>
        <div class="conf-grid">
          <span>Auditorium</span><span>${snap.auditorium}</span>
          <span>Date</span><span>${fmtDate(snap.date)}</span>
          <span>Time Range</span><span>${fmtTime(snap.checkIn)} – ${fmtTime(snap.checkOut)}</span>
        </div>
      </div>
      <div class="conf-section">
        <h4>🏢 Institute</h4>
        <div class="conf-grid">
          <span>Institute</span><span>${snap.institute}</span>
          <span>Address</span><span>${snap.address}</span>
        </div>
      </div>
      <div class="conf-section">
        <h4>👤 Applicant</h4>
        <div class="conf-grid">
          <span>Name</span><span>${snap.bookedBy}</span>
          <span>NIC No.</span><span>${snap.nic}</span>
          <span>Telephone</span><span>${snap.phone}</span>
          <span>Email</span><span>${snap.email}</span>
          <span>Designation</span><span>${snap.desig}</span>
          <span>Programme</span><span>${snap.purpose}</span>
          <span>Group</span><span>${snap.group}</span>
          <span>Participants</span><span>${snap.attendees}</span>
        </div>
      </div>
      <div class="conf-section fee-conf-box">
        <h4>💰 Fee Summary</h4>
        <div class="conf-grid">
          ${mmFee  ? `<span>Multimedia Facility Fee</span><span>${fmtCur(mmFee)}</span>` : ''}
          ${canFee ? `<span>Canteen Facility Fee</span><span>${fmtCur(canFee)}</span>`   : ''}
          <span>Service Charges (15%)</span><span>${fmtCur(svcFee)}</span>
          <span>Refundable Deposit</span><span>${fmtCur(DEPOSIT)}</span>
          <span><strong>Total Fee</strong></span><span class="conf-total">${fmtCur(snap.total)}</span>
        </div>
      </div>
      <div class="conf-section">
        <span class="status-pending">⏳ Status: Pending Approval</span>
        <p class="conf-submitted">Submitted: ${snap.submitted}</p>
      </div>`;

    document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirm() { document.getElementById('confirmModal').style.display='none'; }

// ════════════════════════════════════════════
// OFFICIAL PRINT FORM (matches the image)
// ════════════════════════════════════════════
function buildOfficialFormHTML(b) {
    const mmFee  = b.hasMM      ? 9000 : 0;
    const canFee = b.hasCanteen ? 4000 : 0;
    const subTot = mmFee + canFee;
    const svcFee = subTot * SERVICE_RATE;
    const total  = subTot + svcFee + DEPOSIT;

    const aud_fee = ''; // auditorium fee not separately charged — left blank as per form
    const g = b.guests || ['','',''];

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Booking Form — ${b.ref || b.bookedBy}</title>
<style>
  @page { size: A4; margin: 18mm 15mm 18mm 18mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size:12px; color:#111; background:#fff; }

  .page { max-width:680px; margin:0 auto; padding:10px; }

  /* Header */
  .form-title { text-align:center; font-size:14px; font-weight:bold;
                text-decoration:underline; margin-bottom:22px; letter-spacing:.3px; }

  /* Field rows */
  .field-row { display:flex; align-items:flex-start;
               border-bottom:1px solid #ccc; margin-bottom:0; }
  .field-num  { min-width:28px; padding:7px 4px 7px 0; font-weight:bold; }
  .field-label{ min-width:200px; padding:7px 8px; }
  .field-colon{ padding:7px 6px; }
  .field-value{ flex:1; padding:7px 6px; min-height:30px; }

  /* Facilities row */
  .fac-row { display:flex; align-items:center; gap:20px; padding:7px 6px; }
  .fac-box  { display:inline-flex; align-items:center; gap:6px; }
  .checkbox-drawn { display:inline-block; width:14px; height:14px;
                    border:1.5px solid #333; vertical-align:middle; text-align:center;
                    line-height:14px; font-size:11px; }

  /* Guests area */
  .guests-area { padding:8px 6px 6px; border-bottom:1px solid #ccc; }
  .guest-line  { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
  .guest-num   { min-width:18px; font-weight:bold; }
  .guest-field { flex:1; border-bottom:1px dotted #999; padding-bottom:2px; min-height:18px; }

  /* Declaration */
  .declaration { font-size:11px; margin:14px 0 8px; font-style:italic; line-height:1.5; }

  /* Sign row */
  .sign-row { display:flex; justify-content:space-between; padding:8px 0 12px; gap:20px; }
  .sign-box  { flex:1; }
  .sign-label{ font-size:11px; color:#444; }
  .sign-line { border-bottom:1px solid #333; min-height:24px; margin-top:6px; }

  /* Divider */
  .section-divider { border-top:2px solid #333; margin:14px 0 10px; }

  /* Fee table */
  .fee-table { width:100%; border-collapse:collapse; margin-bottom:14px; }
  .fee-table td { padding:6px 8px; font-size:12px; }
  .fee-table .fee-label { width:240px; }
  .fee-table .fee-colon { width:20px; }
  .fee-table .fee-val   { border-bottom:1px dotted #bbb; min-width:120px; padding-bottom:3px; }
  .fee-table tr { border-bottom:1px solid #e0e0e0; }

  /* Signature section */
  .sig-section { display:flex; justify-content:space-between; margin-top:20px; gap:30px; }
  .sig-block   { flex:1; }
  .sig-dotted  { border-top:1px dotted #666; padding-top:4px; margin-bottom:4px; min-height:36px; }
  .sig-title   { font-size:11px; font-weight:bold; }
  .sig-sub     { font-size:10px; color:#444; }

  .ref-label { font-size:10px; color:#888; text-align:right; margin-bottom:8px; }
  .page-header { text-align:center; font-size:11px; color:#555; margin-bottom:4px; }

  @media print { body { -webkit-print-color-adjust:exact; } }
</style></head>
<body>
<div class="page">

  <div class="page-header">SRI LANKA POSTAL SERVICE — POSTAL HEADQUARTERS</div>
  <div class="ref-label">Reference No: ${b.ref || '________________'}</div>

  <div class="form-title">Application for the reservation of the Auditorium of the Postal Headquarters</div>

  <!-- FIELDS 1–9 -->
  <div class="field-row">
    <span class="field-num">1.</span>
    <span class="field-label">Date of the reservation</span>
    <span class="field-colon">:</span>
    <span class="field-value">${b.date ? fmtDate(b.date) : ''}</span>
  </div>
  <div class="field-row">
    <span class="field-num">2.</span>
    <span class="field-label">Time range</span>
    <span class="field-colon">:</span>
    <span class="field-value">${b.checkIn ? fmtTime(b.checkIn) : ''} – ${b.checkOut ? fmtTime(b.checkOut) : ''}</span>
  </div>
  <div class="field-row">
    <span class="field-num">3.</span>
    <span class="field-label">Name of the institute</span>
    <span class="field-colon">:</span>
    <span class="field-value">${b.institute || ''}</span>
  </div>
  <div class="field-row">
    <span class="field-num">4.</span>
    <span class="field-label">Address of the institute</span>
    <span class="field-colon">:</span>
    <span class="field-value">${b.address || ''}</span>
  </div>
  <div class="field-row">
    <span class="field-num">5.</span>
    <span class="field-label">Applicant's Name</span>
    <span class="field-colon">:</span>
    <span class="field-value">${b.bookedBy || ''}</span>
  </div>
  <div class="field-row">
    <span class="field-num">6.</span>
    <span class="field-label">National Identity card No</span>
    <span class="field-colon">:</span>
    <span class="field-value">${b.nic || ''}</span>
  </div>
  <div class="field-row">
    <span class="field-num">7.</span>
    <span class="field-label">Telephone No</span>
    <span class="field-colon">:</span>
    <span class="field-value">${b.phone || ''}</span>
  </div>
  <div class="field-row">
    <span class="field-num">8.</span>
    <span class="field-label">Nature of the programme</span>
    <span class="field-colon">:</span>
    <span class="field-value">${b.purpose || ''}</span>
  </div>
  <div class="field-row">
    <span class="field-num">9.</span>
    <span class="field-label">Participating group</span>
    <span class="field-colon">:</span>
    <span class="field-value">${b.group || ''}</span>
  </div>

  <!-- FIELD 10 — FACILITIES -->
  <div class="field-row" style="align-items:center;">
    <span class="field-num">10.</span>
    <span class="field-label">Other facilities</span>
    <span class="field-colon">:</span>
    <span class="field-value">
      <div class="fac-row">
        <div class="fac-box">
          <span>Multimedia</span>
          <span class="checkbox-drawn">${b.hasMM ? '✓' : ''}</span>
        </div>
        <div class="fac-box">
          <span>Canteen</span>
          <span class="checkbox-drawn">${b.hasCanteen ? '✓' : ''}</span>
        </div>
      </div>
    </span>
  </div>

  <!-- FIELD 11 — CHIEF GUEST -->
  <div class="field-row">
    <span class="field-num">11.</span>
    <span class="field-label">Chief Guest Name</span>
    <span class="field-colon">:</span>
    <span class="field-value">${b.chiefGuest || ''}</span>
  </div>

  <!-- FIELD 12 — SPECIAL GUESTS -->
  <div class="field-row" style="align-items:flex-start;">
    <span class="field-num">12.</span>
    <span class="field-label">Other Special Guests Name</span>
    <span class="field-colon">:</span>
    <span class="field-value">
      <div class="guests-area" style="border:none;padding:0;">
        <div class="guest-line"><span class="guest-num">1.</span><span class="guest-field">${(g[0])||''}</span></div>
        <div class="guest-line"><span class="guest-num">2.</span><span class="guest-field">${(g[1])||''}</span></div>
        <div class="guest-line"><span class="guest-num">3.</span><span class="guest-field">${(g[2])||''}</span></div>
      </div>
    </span>
  </div>

  <!-- DECLARATION -->
  <p class="declaration">It is declared that agreed with the conditions mentioned overleaf after reading them.</p>

  <!-- DATE & SIGNATURE -->
  <div class="sign-row">
    <div class="sign-box">
      <div class="sign-label">Date:</div>
      <div class="sign-line"></div>
    </div>
    <div class="sign-box">
      <div class="sign-label">Signature:</div>
      <div class="sign-line"></div>
    </div>
  </div>

  <!-- SECTION DIVIDER -->
  <div class="section-divider"></div>

  <!-- FEE TABLE -->
  <table class="fee-table">
    <tr>
      <td class="fee-label">Auditorium fee</td>
      <td class="fee-colon">:</td>
      <td class="fee-val">${aud_fee ? fmtCur(aud_fee) : ''}</td>
    </tr>
    <tr>
      <td class="fee-label">Multimedia facility fee</td>
      <td class="fee-colon">:</td>
      <td class="fee-val">${mmFee  ? fmtCur(mmFee)  : ''}</td>
    </tr>
    <tr>
      <td class="fee-label">Canteen facility fee</td>
      <td class="fee-colon">:</td>
      <td class="fee-val">${canFee ? fmtCur(canFee) : ''}</td>
    </tr>
    <tr>
      <td class="fee-label">Service charges</td>
      <td class="fee-colon">:</td>
      <td class="fee-val">${fmtCur(svcFee)}</td>
    </tr>
    <tr>
      <td class="fee-label">Refundable deposit amount</td>
      <td class="fee-colon">:</td>
      <td class="fee-val">${fmtCur(DEPOSIT)}</td>
    </tr>
    <tr style="font-weight:bold;">
      <td class="fee-label">Total fee</td>
      <td class="fee-colon">:</td>
      <td class="fee-val">${fmtCur(total)}</td>
    </tr>
    <tr>
      <td class="fee-label">Cash Receipt Number</td>
      <td class="fee-colon">:</td>
      <td class="fee-val"></td>
    </tr>
  </table>

  <!-- APPROVAL SIGNATURES -->
  <div class="sig-section">
    <div class="sig-block">
      <div class="sig-dotted"></div>
      <div class="sig-title">Recommended.</div>
      <div class="sig-sub">Assistant Superintendent (HQ)</div>
    </div>
    <div class="sig-block">
      <div class="sig-dotted"></div>
      <div class="sig-title">Approved.</div>
      <div class="sig-sub">Deputy Post Master (Operation)</div>
    </div>
  </div>

</div>
<script>window.onload=()=>{ window.print(); }</script>
</body></html>`;
}

function printOfficialForm() {
    if (!currentViewSnap) return;
    const w = window.open('','_blank');
    w.document.write(buildOfficialFormHTML(currentViewSnap));
    w.document.close();
}

function printAdminForm() {
    if (!currentViewSnap) return;
    const w = window.open('','_blank');
    w.document.write(buildOfficialFormHTML(currentViewSnap));
    w.document.close();
}

// ════════════════════════════════════════════
// PDF GUIDE VIEWER & DOWNLOAD
// ════════════════════════════════════════════
function openPdf()  { document.getElementById('pdfModal').style.display='flex'; }
function closePdf() { document.getElementById('pdfModal').style.display='none'; }

function downloadPdfGuide() {
    const w = window.open('','_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Auditorium Booking Guide</title>
      <style>
        @page{size:A4;margin:20mm 18mm}
        body{font-family:Arial,sans-serif;color:#333;max-width:680px;margin:auto;padding:30px}
        h1{color:#1a5490;text-align:center;font-size:20px}
        h2{text-align:center;color:#555;font-size:13px;font-weight:normal;margin-bottom:20px}
        h3{color:#1a5490;font-size:12px;text-transform:uppercase;letter-spacing:.4px;
           border-left:4px solid #1a5490;padding-left:10px;margin:18px 0 8px}
        p{line-height:1.8;font-size:12px;margin:4px 0}
        .footer{margin-top:36px;padding-top:12px;border-top:1px solid #ddd;
                text-align:center;color:#9ca3af;font-size:10px}
        .logo{text-align:center;font-size:14px;font-weight:700;color:#1a5490;
              letter-spacing:2px;margin-bottom:8px}
        hr{border:none;border-top:2px solid #1a5490;margin:14px 0}
      </style></head><body>
      ${document.getElementById('pdfBody').innerHTML}
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>`);
    w.document.close();
}

// ════════════════════════════════════════════
// STAFF LOGIN / LOGOUT
// ════════════════════════════════════════════
function openAdminLogin() {
    document.getElementById('adminLoginModal').style.display = 'flex';
    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
    document.getElementById('loginErr').style.display = 'none';
    setTimeout(()=>document.getElementById('adminUser').focus(), 120);
}

function cancelAdminLogin() {
    document.getElementById('adminLoginModal').style.display = 'none';
}

function attemptLogin() {
    const u = document.getElementById('adminUser').value.trim();
    const p = document.getElementById('adminPass').value;

    let matchedRole = null;
    for (const [, cred] of Object.entries(CREDS)) {
        if (u === cred.user && p === cred.pass) { matchedRole = cred.role; break; }
    }

    if (!matchedRole) {
        document.getElementById('loginErr').style.display = 'block';
        return;
    }

    currentRole = matchedRole;
    currentUser = u;
    cancelAdminLogin();
    updateHeaderBadge();
    document.getElementById('adminGate').style.display = 'none';
    showRoleView();
}

function staffLogout() {
    currentRole = null;
    currentUser = '';
    currentViewSnap = null;
    document.getElementById('adminHeaderBadge').innerHTML = '';
    showGate();
}

function updateHeaderBadge() {
    const icon  = currentRole==='admin' ? '🛡️' : '🔧';
    const label = currentRole==='admin' ? 'Admin' : 'Maintenance';
    document.getElementById('adminHeaderBadge').innerHTML =
        `<div class="admin-hdr-pill">${icon} ${label}: <strong>${currentUser}</strong>
         <button class="hdr-logout" onclick="staffLogout()">Logout</button></div>`;
}

// ════════════════════════════════════════════
// MAINTENANCE CALENDAR (time slots only, no personal info)
// ════════════════════════════════════════════
let maintCalDateObj = new Date();

function initMaintCalendar() {
    maintCalDateObj = new Date();
    renderMaintCal();
    document.getElementById('maintPrevBtn').onclick  = ()=>{ maintCalDateObj.setMonth(maintCalDateObj.getMonth()-1); renderMaintCal(); };
    document.getElementById('maintNextBtn').onclick  = ()=>{ maintCalDateObj.setMonth(maintCalDateObj.getMonth()+1); renderMaintCal(); };
    document.getElementById('maintTodayBtn').onclick = ()=>{ maintCalDateObj=new Date(); renderMaintCal(); };
}

function renderMaintCal() {
    renderCalBase(maintCalDateObj, 'maintMonthYear', 'maintDaysContainer', false);
}

function closeMaintDayPanel() { document.getElementById('maintDayPanel').style.display='none'; }

function showMaintDayDetail(ds, list) {
    const panel = document.getElementById('maintDayPanel');
    document.getElementById('maintDayPanelTitle').textContent = `📅 ${fmtDate(ds)}`;

    if (!list || list.length === 0) {
        document.getElementById('maintDayPanelContent').innerHTML =
            '<div class="panel-empty"><span>✅</span><p>No bookings on this date.</p></div>';
    } else {
        // Maintenance: show auditorium + time only — NO personal/contact info
        document.getElementById('maintDayPanelContent').innerHTML = list.map(b => `
          <div class="panel-booking-card maint-card">
            <div class="panel-card-hdr">
              <span class="panel-ref">${b.auditorium}</span>
              <span class="st-badge st-${(b.status||'pending').toLowerCase()}">${b.status}</span>
            </div>
            <div class="panel-card-body">
              <div class="panel-row"><span>🕐 Time Booked</span><strong>${fmtTime(b.checkIn)} – ${fmtTime(b.checkOut)}</strong></div>
              <div class="panel-row"><span>🎯 Programme Type</span><strong>${b.purpose}</strong></div>
              <div class="panel-row"><span>👥 Participants</span><strong>${b.attendees}</strong></div>
              <div class="panel-row maint-restricted"><span>ℹ️ Further Details</span><strong><em>Contact Admin</em></strong></div>
            </div>
          </div>`).join('');
    }
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// ════════════════════════════════════════════
// ADMIN CALENDAR (full detail on click)
// ════════════════════════════════════════════
let adminCalDateObj = new Date();

function initAdminCalendar() {
    adminCalDateObj = new Date();
    renderAdminCal();
    document.getElementById('adminPrevBtn').onclick  = ()=>{ adminCalDateObj.setMonth(adminCalDateObj.getMonth()-1); renderAdminCal(); };
    document.getElementById('adminNextBtn').onclick  = ()=>{ adminCalDateObj.setMonth(adminCalDateObj.getMonth()+1); renderAdminCal(); };
    document.getElementById('adminTodayBtn').onclick = ()=>{ adminCalDateObj=new Date(); renderAdminCal(); };
}

function renderAdminCal() {
    const filter = document.getElementById('cmsFilter')?.value || 'all';
    renderCalBase(adminCalDateObj, 'adminMonthYear', 'adminDaysContainer', true, filter);
}

function closeAdminDayPanel() { document.getElementById('adminDayPanel').style.display='none'; }

function showAdminDayDetail(ds, list) {
    const panel = document.getElementById('adminDayPanel');
    document.getElementById('adminDayPanelTitle').textContent = `📅 ${fmtDate(ds)}`;

    if (!list || list.length === 0) {
        document.getElementById('adminDayPanelContent').innerHTML =
            '<div class="panel-empty"><span>✅</span><p>No bookings on this date.</p></div>';
    } else {
        document.getElementById('adminDayPanelContent').innerHTML = list.map(b => `
          <div class="panel-booking-card">
            <div class="panel-card-hdr">
              <span class="panel-ref">${b.ref}</span>
              <span class="st-badge st-${(b.status||'pending').toLowerCase()}">${b.status}</span>
            </div>
            <div class="panel-card-body">
              <div class="panel-row"><span>🏛️ Auditorium</span><strong>${b.auditorium}</strong></div>
              <div class="panel-row"><span>🕐 Time</span><strong>${fmtTime(b.checkIn)} – ${fmtTime(b.checkOut)}</strong></div>
              <div class="panel-row"><span>🏢 Institute</span><strong>${b.institute||'—'}</strong></div>
              <div class="panel-row"><span>👤 Applicant</span><strong>${b.bookedBy}</strong></div>
              <div class="panel-row"><span>🪪 NIC</span><strong>${b.nic||'—'}</strong></div>
              <div class="panel-row"><span>📞 Phone</span><strong>${b.phone}</strong></div>
              <div class="panel-row"><span>📧 Email</span><strong>${b.email}</strong></div>
              <div class="panel-row"><span>🎯 Programme</span><strong>${b.purpose}</strong></div>
              <div class="panel-row"><span>👥 Participants</span><strong>${b.attendees}</strong></div>
              <button class="btn-view-detail" style="margin:8px 0 4px;" onclick="openAdminDetail('${b.ref}')">👁 View Full Detail + Print</button>
            </div>
          </div>`).join('');
    }
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// ════════════════════════════════════════════
// SHARED CALENDAR RENDERER
// ════════════════════════════════════════════
function renderCalBase(dateObj, monthYearId, containerId, isAdmin, filter='all') {
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const year  = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const el    = document.getElementById(monthYearId);
    if (el) el.textContent = `${MONTHS[month]} ${year}`;

    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const todayStr    = new Date().toISOString().split('T')[0];
    const firstDay    = new Date(year,month,1).getDay();
    const daysInMonth = new Date(year,month+1,0).getDate();

    // Index bookings by date
    const idx = {};
    bookingsDB.forEach(b => {
        if (filter !== 'all' && b.auditorium !== filter) return;
        if (!idx[b.date]) idx[b.date] = [];
        idx[b.date].push(b);
    });

    // Empty cells
    for (let i=0; i<firstDay; i++) {
        const e=document.createElement('div'); e.className='day empty'; container.appendChild(e);
    }

    for (let d=1; d<=daysInMonth; d++) {
        const ds  = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dow = new Date(year,month,d).getDay();
        const isWknd  = dow===0||dow===6;
        const isToday = ds===todayStr;
        const list    = idx[ds];
        const booked  = !!(list&&list.length);

        const el = document.createElement('div');
        el.style.cursor = 'pointer';

        if      (isToday&&booked)  { el.className='day today booked-today'; el.innerHTML=`${d}<br><small>Today ●${list.length}</small>`; }
        else if (isToday)          { el.className='day today';              el.innerHTML=`${d}<br><small>Today</small>`; }
        else if (booked&&isWknd)   { el.className='day booked-wknd';        el.innerHTML=`${d}<br><small>Wknd ●${list.length}</small>`; }
        else if (booked)           { el.className='day booked';             el.innerHTML=`${d}<br><small>●${list.length} booked</small>`; }
        else if (isWknd)           { el.className='day weekend';            el.innerHTML=`${d}<br><small>Weekend</small>`; }
        else                       { el.className='day available';          el.innerHTML=`${d}<br><small>Free</small>`; }

        el.addEventListener('click', () => {
            if (isAdmin) showAdminDayDetail(ds, list||[]);
            else         showMaintDayDetail(ds, list||[]);
        });
        container.appendChild(el);
    }
}

// ════════════════════════════════════════════
// ADMIN CMS TABLE
// ════════════════════════════════════════════
function renderBookingsTable() {
    const filter = document.getElementById('cmsFilter')?.value || 'all';
    const rows   = filter==='all' ? bookingsDB : bookingsDB.filter(b=>b.auditorium===filter);
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
    const b = bookingsDB.find(x=>x.ref===ref);
    if (!b) return;
    currentViewSnap = b;

    document.getElementById('adminDetailRef').textContent = ref;

    const mmFee  = b.hasMM      ? 9000 : 0;
    const canFee = b.hasCanteen ? 4000 : 0;
    const subTot = mmFee+canFee;
    const svcFee = subTot*SERVICE_RATE;
    const total  = subTot+svcFee+DEPOSIT;

    const g = b.guests||['','',''];

    document.getElementById('adminDetailBody').innerHTML = `
      <div class="conf-section">
        <h4>📅 Reservation</h4>
        <div class="conf-grid">
          <span>Auditorium</span><span>${b.auditorium}</span>
          <span>Date</span><span>${fmtDate(b.date)}</span>
          <span>Time</span><span>${fmtTime(b.checkIn)} – ${fmtTime(b.checkOut)}</span>
        </div>
      </div>
      <div class="conf-section">
        <h4>🏢 Institute</h4>
        <div class="conf-grid">
          <span>Name</span><span>${b.institute||'—'}</span>
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
          <span>Designation</span><span>${b.desig||'—'}</span>
          <span>Programme</span><span>${b.purpose}</span>
          <span>Group</span><span>${b.group||'—'}</span>
          <span>Participants</span><span>${b.attendees}</span>
        </div>
      </div>
      <div class="conf-section">
        <h4>🌟 Guests</h4>
        <div class="conf-grid">
          <span>Chief Guest</span><span>${b.chiefGuest||'—'}</span>
          <span>Guest 1</span><span>${g[0]||'—'}</span>
          <span>Guest 2</span><span>${g[1]||'—'}</span>
          <span>Guest 3</span><span>${g[2]||'—'}</span>
        </div>
      </div>
      <div class="conf-section fee-conf-box">
        <h4>💰 Fees</h4>
        <div class="conf-grid">
          ${mmFee  ? `<span>Multimedia Fee</span><span>${fmtCur(mmFee)}</span>` : ''}
          ${canFee ? `<span>Canteen Fee</span><span>${fmtCur(canFee)}</span>`   : ''}
          <span>Service Charges (15%)</span><span>${fmtCur(svcFee)}</span>
          <span>Refundable Deposit</span><span>${fmtCur(DEPOSIT)}</span>
          <span><strong>Total Fee</strong></span><span class="conf-total">${fmtCur(total)}</span>
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

// ════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════
function fmtDate(ds) {
    if (!ds) return '';
    const d = new Date(ds+'T00:00:00');
    return d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

function fmtTime(ts) {
    if (!ts) return '';
    const [h,m] = ts.split(':');
    const hr=parseInt(h), ap=hr>=12?'PM':'AM', h12=hr%12||12;
    return `${h12}:${m} ${ap}`;
}
