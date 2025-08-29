(function() {
  // Theme toggle
  const themeToggle = document.querySelector('.theme-toggle');
  const themeIcon = document.querySelector('.theme-toggle__icon');
  
  function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
  }
  
  function updateThemeIcon(theme) {
    if (!themeIcon) return;
    if (theme === 'light') {
      themeIcon.innerHTML = '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>';
    } else {
      themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
  }
  
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  }
  
  if (themeToggle && themeIcon) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Theme will be initialized when DOM is ready

  // Initialize i18n
  if (window.JI18N) {
    window.JI18N.init();
  }
  
  // Language toggle
  const languageButtons = document.querySelectorAll('.language-toggle__btn');
  if (languageButtons.length > 0 && window.JI18N) {
    languageButtons.forEach(btn => {
      btn.addEventListener('click', function() {
        const lang = this.dataset.lang;
        window.JI18N.setLang(lang);
        
        // Update active state
        document.querySelectorAll('.language-toggle__btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
      });
    });
    
    // Set initial active language
    const currentLang = window.JI18N.getLang();
    const activeBtn = document.querySelector(`[data-lang="${currentLang}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  }

  // Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyAJiCEIR8vsPtm5wE4duinpyKKpYV584fw",
    authDomain: "junicornjobs.firebaseapp.com",
    projectId: "junicornjobs",
    storageBucket: "junicornjobs.firebasestorage.app",
    messagingSenderId: "379742849424",
    appId: "1:379742849424:web:1c1b35d393a5b880714b15",
    measurementId: "G-MSWKTZF7J0",
  };

  // Initialize Firebase
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
  } else {
    console.error('Firebase not available');
  }

  // Map functionality
  let map;
  let markers = [];
  let jobs = [];

  // Initialize map
  function initMap() {
    // Check if map element exists
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('Map element not found');
      return;
    }

    // Check if Leaflet is available
    if (typeof L === 'undefined') {
      console.error('Leaflet not available');
      showError('Map library not available');
      return;
    }

    map = L.map('map').setView([32.0853, 34.7818], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add event listener for map movement
    map.on('moveend', function() {
      const bounds = map.getBounds();
      const jobsInView = jobs.filter(job => bounds.contains([job.latitude, job.longitude]));
      updateJobsList(jobsInView);
    });

    loadJobs();
  }

  // Load jobs
  async function loadJobs() {
    try {
      const response = await fetch('data/jobs.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch jobs.json');
      const all = await response.json();

      jobs = (Array.isArray(all) ? all : [])
        .filter(j => j && j.status === 'approved' && typeof j.latitude === 'number' && typeof j.longitude === 'number')
        .map(j => ({
          id: j.id,
          title: j.title,
          company: j.company,
          locationText: j.location || '',
          latitude: j.latitude,
          longitude: j.longitude,
          workMode: j.workMode || '',
          employmentType: j.employmentType || '',
          description: j.description || '',
          applyEmail: j.applyEmail || '',
          applyUrl: j.applyUrl || '',
          tags: Array.isArray(j.tags) ? j.tags : []
        }));

      addMarkersToMap();
      updateJobsList();

      const countElement = document.getElementById('mapJobsCount');
      if (countElement) {
        countElement.textContent = `${jobs.length} job${jobs.length !== 1 ? 's' : ''}`;
      }
    } catch (error) {
      console.error('Error loading jobs:', error);
      showError('Failed to load jobs list');
    }
  }

  // Add markers to map
  function addMarkersToMap() {
    if (!map) {
      console.error('Map not initialized');
      return;
    }

    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    jobs.forEach(job => {
      const icon = L.divIcon({
        className: 'map-label',
        html: `<div class="map-label__box"><span class="map-label__title">${escapeHtml(job.title)}</span></div>`,
        iconSize: [140, 40],
        iconAnchor: [70, 20]
      });
      const marker = L.marker([job.latitude, job.longitude], { icon })
        .on('click', () => showJobModal(job.id))
        .addTo(map);
      marker.jobId = job.id;
      markers.push(marker);
    });
  }

  // Create popup content
  function createPopupContent(job) {
    return `
      <div class="map-popup">
        <h3>${escapeHtml(job.title)}</h3>
        <p><strong>${escapeHtml(job.company)}</strong></p>
        <p>${escapeHtml(job.locationText)}</p>
        <button onclick="showJobModal('${job.id}')" class="btn btn--small">View Details</button>
      </div>
    `;
  }

  // Filter jobs
  function filterJobs() {
    const searchTerm = document.getElementById('mapSearch')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('mapTypeFilter')?.value || '';
    const workModeFilter = document.getElementById('mapWorkModeFilter')?.value || '';

    const filteredJobs = jobs.filter(job => {
      const matchesSearch = !searchTerm || 
        job.title.toLowerCase().includes(searchTerm) ||
        job.company.toLowerCase().includes(searchTerm) ||
        (job.description && job.description.toLowerCase().includes(searchTerm));

      const matchesType = !typeFilter || (job.employmentType && job.employmentType.toLowerCase() === typeFilter);
      const matchesWorkMode = !workModeFilter || (job.workMode && job.workMode.toLowerCase() === workModeFilter);

      return matchesSearch && matchesType && matchesWorkMode;
    });

    // Update jobs list with filtered results
    const jobsList = document.getElementById('mapJobsList');
    const countElement = document.getElementById('mapJobsCount');
    
    if (!jobsList) return;

    if (filteredJobs.length === 0) {
      jobsList.innerHTML = '<div class="map-jobs-list__empty"><p>No jobs match your filters</p></div>';
      if (countElement) countElement.textContent = '0 jobs';
      return;
    }

    const jobsHTML = filteredJobs.map(job => `
      <div class="map-job-item" onclick="showJobModal('${job.id}')">
        <div class="map-job-item__header">
          <h4>${escapeHtml(job.title)}</h4>
          <span class="map-job-item__company">${escapeHtml(job.company)}</span>
        </div>
        <div class="map-job-item__meta">
          <span class="map-job-item__location">${escapeHtml(job.locationText)}</span>
          <span class="map-job-item__type">${escapeHtml(job.employmentType)}</span>
        </div>
      </div>
    `).join('');

    jobsList.innerHTML = jobsHTML;
    if (countElement) countElement.textContent = `${filteredJobs.length} job${filteredJobs.length !== 1 ? 's' : ''}`;
  }

  // Update jobs list
  function updateJobsList(jobsToShow = null) {
    const jobsList = document.getElementById('mapJobsList');
    const countElement = document.getElementById('mapJobsCount');
    
    if (!jobsList) {
      console.error('Jobs list element not found');
      return;
    }

    const jobsToDisplay = jobsToShow || jobs;

    if (jobsToDisplay.length === 0) {
      jobsList.innerHTML = '<div class="map-jobs-list__empty"><p>No jobs available</p></div>';
      if (countElement) countElement.textContent = '0 jobs';
      return;
    }

    const jobsHTML = jobsToDisplay.map(job => `
      <div class="map-job-item" onclick="showJobModal('${job.id}')">
        <div class="map-job-item__header">
          <h4>${escapeHtml(job.title)}</h4>
          <span class="map-job-item__company">${escapeHtml(job.company)}</span>
        </div>
        <div class="map-job-item__meta">
          <span class="map-job-item__location">${escapeHtml(job.locationText)}</span>
          <span class="map-job-item__type">${escapeHtml(job.employmentType)}</span>
        </div>
      </div>
    `).join('');

    jobsList.innerHTML = jobsHTML;
    if (countElement) countElement.textContent = `${jobsToDisplay.length} job${jobsToDisplay.length !== 1 ? 's' : ''}`;
  }

  // Show job modal
  window.showJobModal = function(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      console.error('Job not found:', jobId);
      return;
    }

    const modal = document.getElementById('jobModal');
    const title = document.getElementById('modalTitle');
    const company = document.getElementById('modalCompany');
    const meta = document.getElementById('modalMeta');
    const tags = document.getElementById('modalTags');
    const desc = document.getElementById('modalDescription');
    const actions = document.getElementById('modalActions');

    if (!modal) {
      console.error('Job modal not found');
      return;
    }

    if (title) title.textContent = job.title;
    if (company) company.textContent = job.company;
    if (meta) meta.textContent = `${job.locationText} • ${job.employmentType} • ${job.workMode}`;
    if (tags) tags.innerHTML = (job.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    if (desc) desc.textContent = job.description || '';
    if (actions) {
      const mail = job.applyEmail ? `<a class="btn" href="mailto:${encodeURI(job.applyEmail)}">Email</a>` : '';
      const link = job.applyUrl ? `<a class="btn btn--primary" target="_blank" rel="noopener" href="${encodeURI(job.applyUrl)}">Apply</a>` : '';
      actions.innerHTML = `${mail} ${link}`;
    }

    modal.classList.add('is-active');
  };

  // Close job modal
  window.closeJobModal = function() {
    const modal = document.getElementById('jobModal');
    if (modal) {
      modal.classList.remove('is-active');
    }
  };

  // Close modal on backdrop click
  const modalBackdrop = document.querySelector('.job-modal__backdrop');
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', closeJobModal);
  }

  // Close modal on close button click
  const closeButton = document.getElementById('closeJobModal');
  if (closeButton) {
    closeButton.addEventListener('click', closeJobModal);
  }

  // Close modal on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeJobModal();
    }
  });

  // Show error message
  function showError(message) {
    const jobsList = document.getElementById('mapJobsList');
    if (jobsList) {
      jobsList.innerHTML = `<div class="map-jobs-list__error"><p>${message}</p></div>`;
    }
    console.error('Map error:', message);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(() => {
        initTheme();
        initMap();
        
        // Add search and filter event listeners
        const searchInput = document.getElementById('mapSearch');
        if (searchInput) {
          searchInput.addEventListener('input', filterJobs);
        }

        const typeFilter = document.getElementById('mapTypeFilter');
        if (typeFilter) {
          typeFilter.addEventListener('change', filterJobs);
        }

        const workModeFilter = document.getElementById('mapWorkModeFilter');
        if (workModeFilter) {
          workModeFilter.addEventListener('change', filterJobs);
        }
      }, 100);
    });
  } else {
    setTimeout(() => {
      initTheme();
      initMap();
      
      // Add search and filter event listeners
      const searchInput = document.getElementById('mapSearch');
      if (searchInput) {
        searchInput.addEventListener('input', filterJobs);
      }

      const typeFilter = document.getElementById('mapTypeFilter');
      if (typeFilter) {
        typeFilter.addEventListener('change', filterJobs);
      }

      const workModeFilter = document.getElementById('mapWorkModeFilter');
      if (workModeFilter) {
        workModeFilter.addEventListener('change', filterJobs);
      }
    }, 100);
  }



})();
