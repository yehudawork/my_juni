(function() {
  function debounce(fn, wait) {
    let timeoutId = null;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function createMapPicker(options) {
    const { mapContainerId, searchInputId, latitudeInputId, longitudeInputId, initialCenter } = options;
    const mapEl = document.getElementById(mapContainerId);
    const searchEl = document.getElementById(searchInputId);
    const latEl = document.getElementById(latitudeInputId);
    const lngEl = document.getElementById(longitudeInputId);

    if (!mapEl || !searchEl || !latEl || !lngEl) return null;
    if (typeof L === 'undefined') {
      console.error('Leaflet not loaded for map picker');
      return null;
    }

    const center = Array.isArray(initialCenter) && initialCenter.length === 2 ? initialCenter : [32.0853, 34.7818];
    const map = L.map(mapContainerId, { zoomControl: true }).setView(center, 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Ensure proper rendering when initialized in hidden containers
    // 1) Invalidate size right after init
    setTimeout(() => { try { map.invalidateSize(false); } catch (e) {} }, 0);
    // 2) Invalidate on window resize
    window.addEventListener('resize', () => {
      try { map.invalidateSize(false); } catch (e) {}
    });
    // 3) Observe visibility changes of the map container and refresh when it becomes visible
    try {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setTimeout(() => { try { map.invalidateSize(false); } catch (e) {} }, 50);
          }
        });
      }, { threshold: 0.1 });
      io.observe(mapEl);
    } catch (e) {
      // IntersectionObserver not available; skip
    }

    let marker = null;

    // Instruction overlay on the map
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '10px';
    overlay.style.left = '10px';
    overlay.style.zIndex = '1000';
    overlay.style.padding = '8px 10px';
    overlay.style.borderRadius = '8px';
    overlay.style.fontSize = '12px';
    overlay.style.background = 'var(--elev-bg, rgba(0,0,0,0.7))';
    overlay.style.color = 'var(--text, #fff)';
    overlay.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
    overlay.textContent = (window.JI18N && window.JI18N.getLang && window.JI18N.getLang() === 'he')
      ? 'ניתן להזיז את הסמן ידנית כדי להתאים את המיקום'
      : 'You can drag the marker to fine‑tune the job location';
    mapEl.style.position = mapEl.style.position || 'relative';
    mapEl.appendChild(overlay);

    function setMarker(lat, lng) {
      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          latEl.value = pos.lat.toFixed(6);
          lngEl.value = pos.lng.toFixed(6);
          updateOverlayMessage();
        });
      }
      latEl.value = Number(lat).toFixed(6);
      lngEl.value = Number(lng).toFixed(6);
      updateOverlayMessage();
    }

    function updateOverlayMessage() {
      const titleInput = document.getElementById(options.titleInputId || 'title') || document.getElementById('titleManagement');
      const cityInput = document.getElementById(options.cityInputId || 'location') || document.getElementById('locationManagement');
      const title = titleInput && titleInput.value ? titleInput.value.trim() : '';
      const city = cityInput && cityInput.value ? cityInput.value.trim() : '';
      if (!overlay) return;
      const isHe = window.JI18N && window.JI18N.getLang && window.JI18N.getLang() === 'he';
      if (title || city) {
        overlay.textContent = isHe
          ? `המיקום של המשרה שנבחר הוא: ${title || 'משרה'} – ${city || ''}. ניתן להזיז את המיקום ידנית בהתאם לצורך`
          : `Selected job location: ${title || 'Position'} – ${city || ''}. You can drag the marker if needed`;
      }
    }

    map.on('click', function(e) {
      const { lat, lng } = e.latlng;
      setMarker(lat, lng);
    });

    const doSearch = debounce(async function(query) {
      if (!query || query.length < 3) return;
      try {
        // Use CORS-friendly geocoding limited to cities
        // Open-Meteo Geocoding API
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=${(window.JI18N && window.JI18N.getLang && window.JI18N.getLang()) || 'en'}&format=json`;
        const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!resp.ok) throw new Error(`Geocoding failed: ${resp.status}`);
        const results = await resp.json();
        const candidates = Array.isArray(results.results) ? results.results : [];
        // Keep only city/town/village and prefer highest population
        const filtered = candidates
          .filter(r => ['city', 'town', 'village'].includes((r.feature_code || '').toLowerCase()) || ['city','town','village'].includes((r.admin1 || '').toLowerCase()))
          .sort((a,b) => (b.population||0) - (a.population||0));
        const best = filtered[0] || candidates[0];
        if (best && typeof best.latitude === 'number' && typeof best.longitude === 'number') {
          const lat = best.latitude;
          const lon = best.longitude;
          map.setView([lat, lon], 12);
          setMarker(lat, lon);
          // If a city/location input exists, populate it with City, Country
          const cityInput = document.getElementById(options.cityInputId || 'location') || document.getElementById('locationManagement');
          if (cityInput) {
            const cityName = best.name || '';
            const countryName = best.country || '';
            if (cityName) cityInput.value = countryName ? `${cityName}, ${countryName}` : cityName;
          }
        }
      } catch (e) {
        console.error('Search failed', e);
      }
    }, 350);

    searchEl.addEventListener('input', (e) => doSearch(e.target.value.trim()))

    return { map, setMarker };
  }

  window.initMapPicker = function(mapContainerId, searchInputId, latitudeInputId, longitudeInputId, initialCenter, extraOptions = {}) {
    return createMapPicker({ mapContainerId, searchInputId, latitudeInputId, longitudeInputId, initialCenter, ...extraOptions });
  };
})();

