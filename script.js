// ============================================================
// ATHENI LYNN REAL ESTATE — Frontend Script
// Connects to: server.js via WebSocket (Socket.io) + REST API
// Admin auth token is stored in sessionStorage after login
// ─────────────────────────────────────────────────────────
// CONFIGURATION: update BACKEND_URL after deploying backend
// ─────────────────────────────────────────────────────────
const RAILWAY_URL = 'https://athenilynn-production.up.railway.app'; // ← PASTE YOUR URL HERE

let BACKEND_URL = (() => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  // Replace with your Railway/Render backend URL after deploying:
  return RAILWAY_URL;
})();
// ============================================================

// ── Admin state ───────────────────────────────────────────────────────────────
let isAdmin = sessionStorage.getItem('isAdmin') === '1';
const adminToken = () => sessionStorage.getItem('adminToken') || '';

// ── WebSocket / Real-time ─────────────────────────────────────────────────────
let socket = null;
let isConnected = false;
let updateQueue = [];
let isSyncing = false;

function loadUpdateQueue() {
    try { updateQueue = JSON.parse(localStorage.getItem('updateQueue') || '[]'); }
    catch (e) { updateQueue = []; }
}
function saveUpdateQueue() {
    localStorage.setItem('updateQueue', JSON.stringify(updateQueue));
}
function queueUpdate(action, data) {
    updateQueue.push({ id: Date.now() + Math.random(), action, data, timestamp: new Date().toISOString() });
    saveUpdateQueue();
}

async function processUpdateQueue() {
    if (!isConnected || updateQueue.length === 0 || isSyncing) return;
    isSyncing = true;
    const toProcess = [...updateQueue];
    for (const update of toProcess) {
        try {
            socket.emit(update.action, update.data);
            const idx = updateQueue.indexOf(update);
            if (idx !== -1) updateQueue.splice(idx, 1);
        } catch (err) {
            console.error('Error processing queue:', err);
        }
    }
    saveUpdateQueue();
    isSyncing = false;
    if (toProcess.length) showNotification(`${toProcess.length} offline change(s) synced`);
}

function initializeWebSocket() {
    loadUpdateQueue();

    socket = io(BACKEND_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity
    });

    socket.on('connect', async () => {
        isConnected = true;
        updateConnectionStatus('connected');
        socket.emit('sync-listings', listings);
        await processUpdateQueue();
    });

    socket.on('disconnect', () => {
        isConnected = false;
        updateConnectionStatus('disconnected');
    });

    socket.on('reconnect', () => {
        isConnected = true;
        updateConnectionStatus('connected');
        processUpdateQueue();
    });

    socket.on('update-listings', (data) => {
        if (data.action === 'added') {
            if (!listings.find(l => l.id === data.listing.id)) {
                listings.unshift(data.listing);
                showNotification(`New listing added: ${data.listing.title}`);
            }
        } else if (data.action === 'deleted') {
            listings = listings.filter(l => l.id !== data.listingId);
            showNotification('A listing was removed');
        } else if (data.action === 'updated') {
            const idx = listings.findIndex(l => l.id === data.listing.id);
            if (idx !== -1) {
                listings[idx] = data.listing;
                showNotification(`Listing updated: ${data.listing.title}`);
            }
        }
        renderListings();
    });

    socket.on('sync-all-listings', (synced) => {
        listings = synced;
        renderListings();
    });

    socket.on('users-count', (count) => {
        const statusText = document.getElementById('statusText');
        if (statusText && isConnected) {
            statusText.textContent = `🟢 ${count} user${count !== 1 ? 's' : ''} online`;
        }
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err);
        updateConnectionStatus('error');
    });
}

function updateConnectionStatus(status) {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    if (!indicator || !text) return;
    indicator.className = 'status-dot';
    if (status === 'connected') {
        indicator.classList.add('connected');
        text.textContent = 'Connected';
    } else if (status === 'disconnected') {
        indicator.classList.add('disconnected');
        text.textContent = 'Offline — Sync paused';
    } else {
        indicator.classList.add('error');
        text.textContent = 'Connection error';
    }
}

function showNotification(message) {
    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => {
        notif.classList.add('fade-out');
        setTimeout(() => notif.remove(), 500);
    }, 4000);
}

// ── Smooth scroll ─────────────────────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});

// ── Contact button ────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('contact-btn')) {
        alert('Thank you for your interest! Please call +639088878040 or email atheni@realestate.com to schedule a showing.');
    }
});

// ── Listings storage ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'featured_listings_v1';
let listings = [];

const defaults = [
    {
        id: '1770614171070',
        title: 'Auria Residences',
        description: 'Where living close to the city center does not need to with hassle or noise and congestion.',
        location: 'Nivel Hills, Veterans Drive, Brgy. Lahug, Cebu City',
        locationDetails: 'Auria Residences Lahug is nestled in the picturesque uphill location in Nivel Hills, Cebu City. It is a mixed-use condo development set to redefine urban living with its stunning blend of modern design and breathtaking panoramic views.',
        beds: 1, baths: 1,
        mainImage: 'auria.jpg',
        gallery: ['bedroom.jpg', 'bathroom.jpg', 'livingroom.jpg', 'kitchen.jpg', 'diningroom.jpg'],
        amenities: ['Infinity Pool', '100% Back-up Power', '6 elevators', 'CCTV', 'WiFi'],
        pricing: [
            { title: 'STUDIO UNIT - 22.1 sqm', type: 'East Mandaue/City View', items: ['Total Selling Price: ₱4,381,104', 'Reservation Fee: ₱20,000', '15% Downpayment payable in 60 months: ₱8,000/month', '85% Balance payable through bank financing'] },
            { title: '1BR UNIT - 45.27 sqm', type: 'West/Mountain View', items: ['Total Selling Price: ₱8,264,491', 'Reservation Fee: ₱20,000', '15% Downpayment payable in 60 months: ₱22,600/month', '85% Balance payable through bank financing'] },
            { title: '2BR UNIT - 66.52 sqm', type: 'South West/Corner Mountain View & City View', items: ['Total Selling Price: ₱12,814,412', 'Reservation Fee: ₱20,000', '15% Downpayment payable in 60 months: ₱35,000/month', '85% Balance payable through bank financing'] }
        ],
        locations: ['340 m Marco Polo Plaza Cebu', '760 m Mercedes-Benz Cebu', '1.4 km Camp Lapu-Lapu Station Hospital', '1.5 km JY Square Mall', '1.87 km University of Southern Philippines Foundation', '1.9 km Cebu IT Park', '2.4 km University of the Philippines Cebu', '2.5 km Waterfront Hotel & Casino Cebu City', '2.9 km Cebu Business Park', '2.9 km Ayala Center Cebu', '3.6 km Temple of Leah', '3.8 km TOPS Cebu', '6.2 km Cebu City Link Expressway Bridge', '9.8 km Mactan Cebu International Airport']
    }
];

function loadListings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        listings = raw ? JSON.parse(raw) : defaults.slice();
    } catch (e) {
        listings = defaults.slice();
    }
}

function saveListings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
    if (socket && isConnected) socket.emit('sync-listings', listings);
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
}

// ── Render listings ───────────────────────────────────────────────────────────
function renderListings() {
    const container = document.getElementById('featuredList');
    if (!container) return;
    container.innerHTML = '';

    const adminControls = document.querySelector('.admin-controls');
    if (adminControls) adminControls.style.display = isAdmin ? 'flex' : 'none';

    listings.forEach(listing => {
        const card = el('div', { class: 'listing-card' });
        const imgWrap = el('div', { class: 'listing-image' });
        imgWrap.appendChild(el('img', { src: listing.mainImage || '', alt: listing.title }));

        const details = el('div', { class: 'listing-details' });
        const info = el('div', { class: 'property-info' });
        info.appendChild(el('span', { class: 'info-item' }, [listing.beds + ' Bedroom']));
        info.appendChild(el('span', { class: 'info-item' }, [listing.baths + ' Bathroom']));

        const actions = el('div', { class: 'listing-actions' });
        const detailsBtn = el('button', { class: 'details-btn', 'data-id': listing.id }, ['Details']);
        const contactBtn = el('button', { class: 'contact-btn' }, ['Schedule a Showing']);

        actions.appendChild(detailsBtn);
        actions.appendChild(contactBtn);

        if (isAdmin) {
            const editBtn = el('button', { class: 'details-btn edit-btn', 'data-id': listing.id }, ['Edit']);
            const delBtn = el('button', { class: 'details-btn delete-btn', 'data-id': listing.id }, ['Delete']);
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
        }

        details.appendChild(el('h3', {}, [listing.title]));
        details.appendChild(info);
        details.appendChild(el('p', { class: 'description' }, [listing.description || '']));
        details.appendChild(actions);

        card.appendChild(imgWrap);
        card.appendChild(details);
        container.appendChild(card);
    });

    // Attach click listeners
    container.querySelectorAll('[data-id]').forEach(btn => {
        const id = btn.getAttribute('data-id');
        if (btn.classList.contains('edit-btn')) btn.addEventListener('click', () => openEditModal(id));
        else if (btn.classList.contains('delete-btn')) btn.addEventListener('click', () => handleDeleteListing(id));
        else btn.addEventListener('click', () => openDetailsModal(id));
    });
}

// ── Delete listing ────────────────────────────────────────────────────────────
function handleDeleteListing(id) {
    if (!confirm('Delete this listing?')) return;
    listings = listings.filter(l => l.id !== id);
    saveListings();
    renderListings();
    if (socket && isConnected) {
        socket.emit('listing-deleted', id);
    } else {
        queueUpdate('listing-deleted', id);
    }
}

// ── Edit / Create modal ───────────────────────────────────────────────────────
const addBtn = document.getElementById('addFeaturedBtn');
const editModal = document.getElementById('editModal');
const detailsModal = document.getElementById('detailsModal');
let currentEditingPricing = [];

function openEditModal(id) {
    if (!sessionStorage.getItem('isAdmin')) {
        alert('Admin only — please log in via the admin page.');
        return;
    }
    const form = document.getElementById('editForm');
    document.getElementById('listingId').value = id || '';
    document.getElementById('mainPreview').innerHTML = '';
    document.getElementById('galleryPreview').innerHTML = '';
    currentEditingPricing = [];
    renderPricingUnits();

    if (!id) {
        document.getElementById('editTitle').textContent = 'Add Featured Listing';
        ['titleInput', 'descInput', 'locationInput', 'locationDetailsInput', 'amenitiesInput', 'locationsInput'].forEach(i => document.getElementById(i).value = '');
        document.getElementById('bedsInput').value = 0;
        document.getElementById('bathsInput').value = 0;
    } else {
        const listing = listings.find(l => l.id === id);
        if (!listing) return;
        document.getElementById('editTitle').textContent = 'Edit Listing';
        document.getElementById('titleInput').value = listing.title || '';
        document.getElementById('descInput').value = listing.description || '';
        document.getElementById('locationInput').value = listing.location || '';
        document.getElementById('locationDetailsInput').value = listing.locationDetails || '';
        document.getElementById('bedsInput').value = listing.beds || 0;
        document.getElementById('bathsInput').value = listing.baths || 0;
        document.getElementById('amenitiesInput').value = (listing.amenities || []).join('\n');
        document.getElementById('locationsInput').value = (listing.locations || []).join('\n');
        currentEditingPricing = JSON.parse(JSON.stringify(Array.isArray(listing.pricing) ? listing.pricing : []));
        renderPricingUnits();
        if (listing.mainImage) {
            document.getElementById('mainPreview').appendChild(el('img', { src: listing.mainImage }));
        }
        if (Array.isArray(listing.gallery)) {
            listing.gallery.forEach(src => document.getElementById('galleryPreview').appendChild(el('img', { src })));
        }
    }
    openModal(editModal);
}

function openModal(modal) { if (!modal) return; modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
function closeModal(modal) { if (!modal) return; modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }

// ── Pricing units ─────────────────────────────────────────────────────────────
function renderPricingUnits() {
    const container = document.getElementById('pricingUnitsContainer');
    container.innerHTML = '';
    currentEditingPricing.forEach((unit, idx) => {
        const unitDiv = el('div', { class: 'pricing-unit' });
        unitDiv.appendChild(el('div', { class: 'pricing-unit-title' }, [unit.title || '']));
        unitDiv.appendChild(el('div', { class: 'pricing-unit-type' }, [unit.type || '']));
        const itemsDiv = el('div', { class: 'pricing-unit-items' });
        (unit.items || []).forEach(item => itemsDiv.appendChild(el('div', { class: 'pricing-item' }, [item])));
        unitDiv.appendChild(itemsDiv);
        const removeBtn = el('button', { type: 'button', class: 'details-btn remove-unit-btn' }, ['Remove']);
        removeBtn.addEventListener('click', () => { currentEditingPricing.splice(idx, 1); renderPricingUnits(); });
        unitDiv.appendChild(removeBtn);
        container.appendChild(unitDiv);
    });
}

document.getElementById('addPricingUnitBtn').addEventListener('click', (e) => {
    e.preventDefault();
    currentEditingPricing.push({ title: '', type: '', items: [] });
    renderPricingUnits();
    promptEditPricingUnit(currentEditingPricing.length - 1);
});

function promptEditPricingUnit(idx) {
    const unit = currentEditingPricing[idx];
    const title = prompt('Unit title (e.g., STUDIO UNIT - 22.1 sqm):', unit.title || '');
    if (title === null) return;
    unit.title = title;
    const type = prompt('Unit type/view (e.g., East Mandaue/City View):', unit.type || '');
    if (type === null) return;
    unit.type = type;
    const itemsText = prompt('Items (one per line):', (unit.items || []).join('\n'));
    if (itemsText === null) return;
    unit.items = itemsText.split('\n').map(s => s.trim()).filter(Boolean);
    renderPricingUnits();
}

// ── File reading ──────────────────────────────────────────────────────────────
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(file);
    });
}

// ── Upload image to server (with admin token) ─────────────────────────────────
async function uploadImageToServer(file) {
    try {
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch(BACKEND_URL + '/api/upload-image', {
            method: 'POST',
            headers: { 'x-admin-token': adminToken() },
            body: formData
        });
        if (res.ok) {
            const data = await res.json();
            return data.url;
        }
    } catch (err) {
        console.warn('Server upload failed, using local data URL:', err);
    }
    // Fallback: local data URL
    return readFileAsDataURL(file);
}

// ── Form submit ───────────────────────────────────────────────────────────────
document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sessionStorage.getItem('isAdmin')) { alert('Admin only.'); return; }

    const id = document.getElementById('listingId').value;
    const title = document.getElementById('titleInput').value.trim();
    const description = document.getElementById('descInput').value.trim();
    const location = document.getElementById('locationInput').value.trim();
    const locationDetails = document.getElementById('locationDetailsInput').value.trim();
    const beds = Number(document.getElementById('bedsInput').value) || 0;
    const baths = Number(document.getElementById('bathsInput').value) || 0;
    const amenitiesText = document.getElementById('amenitiesInput').value || '';
    const locationsText = document.getElementById('locationsInput').value || '';
    const mainFile = document.getElementById('mainImageInput').files[0];
    const galleryFiles = Array.from(document.getElementById('galleryInput').files || []);

    const amenities = amenitiesText.split('\n').map(s => s.trim()).filter(Boolean);
    const locations = locationsText.split('\n').map(s => s.trim()).filter(Boolean);

    let mainImage;
    let gallery = [];

    if (mainFile) mainImage = await uploadImageToServer(mainFile);
    for (const f of galleryFiles) {
        try { gallery.push(await uploadImageToServer(f)); } catch (_) {}
    }

    if (id) {
        const idx = listings.findIndex(l => l.id === id);
        if (idx === -1) return;
        listings[idx] = {
            ...listings[idx], title, description, location, locationDetails,
            beds, baths, amenities, locations, pricing: currentEditingPricing,
            ...(mainImage ? { mainImage } : {}),
            ...(gallery.length ? { gallery: (listings[idx].gallery || []).concat(gallery) } : {})
        };
        saveListings();
        renderListings();
        if (socket && isConnected) socket.emit('listing-updated', listings[idx]);
        else queueUpdate('listing-updated', listings[idx]);
    } else {
        const newListing = {
            id: Date.now().toString(),
            title, description, location, locationDetails,
            beds, baths, amenities, locations, pricing: currentEditingPricing,
            mainImage: mainImage || '',
            gallery
        };
        listings.unshift(newListing);
        saveListings();
        renderListings();
        if (socket && isConnected) socket.emit('listing-added', newListing);
        else queueUpdate('listing-added', newListing);
    }

    closeModal(editModal);
    document.getElementById('mainImageInput').value = '';
    document.getElementById('galleryInput').value = '';
});

// ── File previews ─────────────────────────────────────────────────────────────
document.getElementById('mainImageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById('mainPreview');
    preview.innerHTML = '';
    if (file) { const src = await readFileAsDataURL(file); preview.appendChild(el('img', { src })); }
});

document.getElementById('galleryInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    const preview = document.getElementById('galleryPreview');
    preview.innerHTML = '';
    for (const f of files) { const src = await readFileAsDataURL(f); preview.appendChild(el('img', { src })); }
});

// ── Modal buttons ─────────────────────────────────────────────────────────────
document.querySelectorAll('#editModal .modal-close, #cancelEdit').forEach(btn =>
    btn.addEventListener('click', () => closeModal(editModal)));

if (addBtn) addBtn.addEventListener('click', () => { if (isAdmin) openEditModal(); });

// ── Admin logout button in navbar ─────────────────────────────────────────────
if (isAdmin) {
    const nav = document.querySelector('.nav-links');
    if (nav) {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.id = 'adminLogout';
        btn.textContent = 'Logout';
        btn.className = 'nav-logout-btn';
        btn.addEventListener('click', () => {
            if (confirm('Log out of admin mode?')) {
                sessionStorage.removeItem('isAdmin');
                sessionStorage.removeItem('adminToken');
                location.reload();
            }
        });
        li.appendChild(btn);
        nav.appendChild(li);
    }
}

// ── Details modal ─────────────────────────────────────────────────────────────
let currentGallery = [];
let currentIndex = 0;
const modalImage = document.getElementById('modalImage');
const thumbsContainer = document.querySelector('.modal-thumbs');
const modalPrev = document.querySelector('.modal-prev');
const modalNext = document.querySelector('.modal-next');
const modalCloseBtns = document.querySelectorAll('#detailsModal .modal-close');

function openDetailsModal(id) {
    const listing = listings.find(l => l.id === id);
    if (!listing) return;
    currentGallery = (listing.gallery && listing.gallery.length) ? listing.gallery.slice() : (listing.mainImage ? [listing.mainImage] : []);
    currentIndex = 0;
    renderDetailsContent(listing);
    openModal(detailsModal);
}

function renderDetailsContent(listing) {
    if (modalImage) modalImage.src = currentGallery[currentIndex] || listing.mainImage || '';

    if (thumbsContainer) {
        thumbsContainer.innerHTML = '';
        currentGallery.forEach((src, i) => {
            const t = el('img', { class: 'thumb', src, alt: 'thumb' });
            t.addEventListener('click', () => { currentIndex = i; modalImage.src = src; updateActiveThumb(); });
            thumbsContainer.appendChild(t);
        });
        updateActiveThumb();
    }

    const infoContent = document.getElementById('infoContent');
    if (infoContent) {
        let html = `<h3>${listing.title}</h3><p>${listing.description || ''}</p>`;
        if (listing.location || listing.locationDetails) {
            html += `<h4>LOCATION</h4><p>${listing.location || ''}</p>`;
            if (listing.locationDetails) html += `<p>${listing.locationDetails}</p>`;
        }
        if (listing.locations && listing.locations.length) {
            html += `<h4>NEARBY</h4><ul class="amenity-list">${listing.locations.map(loc => `<li>${loc}</li>`).join('')}</ul>`;
        }
        infoContent.innerHTML = html;
    }

    const amenitiesContent = document.getElementById('amenitiesContent');
    if (amenitiesContent) {
        amenitiesContent.innerHTML = (listing.amenities && listing.amenities.length)
            ? `<ul class="amenity-list">${listing.amenities.map(a => `<li>${a}</li>`).join('')}</ul>`
            : '<p>No amenities provided.</p>';
    }

    const pricingContent = document.getElementById('pricingContent');
    if (pricingContent) {
        if (listing.pricing && listing.pricing.length && typeof listing.pricing[0] === 'object') {
            let html = '<h4>RFO UNITS — SAMPLE COMPUTATION</h4>';
            listing.pricing.forEach(unit => {
                html += `<div class="unit-pricing"><h5>${unit.title || ''}</h5><p class="unit-type">${unit.type || ''}</p><ul class="pricing-list">`;
                (unit.items || []).forEach(item => { html += `<li>${item}</li>`; });
                html += `</ul></div>`;
            });
            pricingContent.innerHTML = html;
        } else {
            pricingContent.innerHTML = (listing.pricing && listing.pricing.length)
                ? `<ul class="pricing-list">${listing.pricing.map(p => `<li>${p}</li>`).join('')}</ul>`
                : '<p>No pricing details.</p>';
        }
    }
}

function updateActiveThumb() {
    document.querySelectorAll('.modal-thumbs .thumb').forEach((t, i) =>
        t.classList.toggle('active', i === currentIndex));
}

if (modalPrev) modalPrev.addEventListener('click', () => {
    if (!currentGallery.length) return;
    currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length;
    modalImage.src = currentGallery[currentIndex];
    updateActiveThumb();
});

if (modalNext) modalNext.addEventListener('click', () => {
    if (!currentGallery.length) return;
    currentIndex = (currentIndex + 1) % currentGallery.length;
    modalImage.src = currentGallery[currentIndex];
    updateActiveThumb();
});

modalCloseBtns.forEach(b => b.addEventListener('click', () => closeModal(detailsModal)));
if (detailsModal) detailsModal.addEventListener('click', (e) => { if (e.target === detailsModal) closeModal(detailsModal); });
if (editModal) editModal.addEventListener('click', (e) => { if (e.target === editModal) closeModal(editModal); });

document.addEventListener('keydown', (e) => {
    if (detailsModal && detailsModal.getAttribute('aria-hidden') === 'false') {
        if (e.key === 'Escape') closeModal(detailsModal);
        if (e.key === 'ArrowRight' && currentGallery.length) { currentIndex = (currentIndex + 1) % currentGallery.length; modalImage.src = currentGallery[currentIndex]; updateActiveThumb(); }
        if (e.key === 'ArrowLeft' && currentGallery.length) { currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length; modalImage.src = currentGallery[currentIndex]; updateActiveThumb(); }
    }
    if (editModal && editModal.getAttribute('aria-hidden') === 'false' && e.key === 'Escape') closeModal(editModal);
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('tab-btn')) {
        const tabName = e.target.getAttribute('data-tab');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        const tab = document.getElementById(`${tabName}-tab`);
        if (tab) tab.classList.add('active');
    }
});

// ── Admin keyboard shortcut (Shift+A+L+A) ────────────────────────────────────
function setupAdminControls() {
    let keySequence = [];
    document.addEventListener('keydown', (e) => {
        keySequence.push(e.key);
        keySequence = keySequence.slice(-3);
        if (keySequence.join('').toLowerCase() === 'ala' && e.shiftKey) {
            e.preventDefault();
            window.location.href = 'admin.html';
        }
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
    loadListings();
    renderListings();
    initializeWebSocket();
    setupAdminControls();
});
