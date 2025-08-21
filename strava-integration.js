// Strava Integration for Manhattan Running Map
// This file handles all Strava API interactions and run visualization

class StravaIntegration {
    constructor(map, manhattanBoundary) {
        this.map = map;
        this.manhattanBoundary = manhattanBoundary;
        this.clientId = 'YOUR_STRAVA_CLIENT_ID'; // Replace with your Strava Client ID: this stuff is only useful for manual checker
        this.clientSecret = 'YOUR_STRAVA_CLIENT_SECRET'; // Replace with your Strava Client Secret
        this.redirectUri = window.location.origin + window.location.pathname;
        this.accessToken = localStorage.getItem('strava_access_token');
        this.refreshToken = localStorage.getItem('strava_refresh_token');
        this.athleteId = localStorage.getItem('strava_athlete_id');
        
        this.initializeUI();
        this.checkAuthStatus();

        this.loadCachedRuns();
    }

    // Initialize UI elements
    initializeUI() {
        // No UI elements - runs load automatically from cached file
        console.log('Strava integration initialized - loading cached runs only');
    }
    // Attach event listeners to UI elements
    attachEventListeners() {
    // No UI elements to attach listeners to
    }
    //Uncomment below for including the mannual connect
    /*
    // Initialize UI elements
    initializeUI() {
        // Add Strava connect button to the page
        const controlsDiv = document.createElement('div');
        controlsDiv.style.position = 'absolute';
        controlsDiv.style.top = '10px';
        controlsDiv.style.right = '10px';
        controlsDiv.style.zIndex = '1000';
        controlsDiv.id = 'strava-controls';
        
        if (!this.accessToken) {
            controlsDiv.innerHTML = `
                <button id="strava-connect" style="
                    background: #FC4C02;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                ">
                    Connect with Strava
                </button>
            `;
        } else {
            controlsDiv.innerHTML = `
                <div style="background: white; padding: 10px; border-radius: 5px;">
                    <button id="load-runs" style="
                        background: #FC4C02;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 3px;
                        cursor: pointer;
                        margin-right: 10px;
                    ">Load Recent Runs</button>
                    <button id="logout" style="
                        background: #666;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 3px;
                        cursor: pointer;
                    ">Disconnect</button>
                    <div id="run-stats" style="margin-top: 10px; font-size: 12px;"></div>
                </div>
            `;
        }
        
        document.body.appendChild(controlsDiv);
        this.attachEventListeners();
    }
    

    // Attach event listeners to UI elements
    attachEventListeners() {
        const connectBtn = document.getElementById('strava-connect');
        const loadRunsBtn = document.getElementById('load-runs');
        const logoutBtn = document.getElementById('logout');
        
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectStrava());
        }
        
        if (loadRunsBtn) {
            loadRunsBtn.addEventListener('click', () => this.loadRecentRuns());
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    // Check if returning from Strava OAuth
    checkAuthStatus() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code && !this.accessToken) {
            this.exchangeCodeForToken(code);
        }
    }
    */
    // Initiate Strava OAuth flow
    connectStrava() {
        const authUrl = `https://www.strava.com/oauth/authorize?` +
            `client_id=${this.clientId}` +
            `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
            `&response_type=code` +
            `&scope=activity:read_all`;
        
        window.location.href = authUrl;
    }

    // Exchange authorization code for access token
    async exchangeCodeForToken(code) {
        try {
            // Note: This should ideally be done on a backend server to keep client_secret secure
            const response = await fetch('https://www.strava.com/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    code: code,
                    grant_type: 'authorization_code'
                })
            });
            
            const data = await response.json();
            
            if (data.access_token) {
                this.accessToken = data.access_token;
                this.refreshToken = data.refresh_token;
                this.athleteId = data.athlete.id;
                
                localStorage.setItem('strava_access_token', this.accessToken);
                localStorage.setItem('strava_refresh_token', this.refreshToken);
                localStorage.setItem('strava_athlete_id', this.athleteId);
                
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // Refresh UI
                this.initializeUI();
            }
        } catch (error) {
            console.error('Error exchanging token:', error);
        }
    }

    // Load recent runs from Strava
    async loadRecentRuns() {
        try {
            const response = await fetch(
                `https://www.strava.com/api/v3/athlete/activities?type=Run&per_page=30`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            
            if (response.status === 401) {
                // Token expired, need to refresh or re-authenticate
                this.logout();
                return;
            }
            
            const activities = await response.json();
            console.log(`Found ${activities.length} runs`);
            
            // Process each run
            for (const activity of activities) {
                if (activity.start_latlng) {
                    await this.processRun(activity);
                }
            }
            
            this.updateStats();
            
        } catch (error) {
            console.error('Error loading runs:', error);
        }
    }

    async loadCachedRuns() {
        try {
            const response = await fetch('manhattan-runs.json');
            if (!response.ok) {
                console.log('No cached runs file found');
                return;
            }
            
            const runs = await response.json();
            console.log(`Loading ${runs.length} cached Manhattan runs`);
            
            for (const run of runs) {
                this.addRunToMap({
                    id: run.id,
                    name: run.name,
                    start_date: run.date,
                    distance: run.distance,
                    moving_time: run.moving_time
                }, run.coordinates);
            }
            
            this.updateStats();
        } catch (error) {
            console.error('Error loading cached runs:', error);
        }
    }

    // Process individual run
    async processRun(activity) {
        // Get detailed activity data with polyline
        try {
            const response = await fetch(
                `https://www.strava.com/api/v3/activities/${activity.id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            
            const detailedActivity = await response.json();
            
            if (detailedActivity.map && detailedActivity.map.polyline) {
                const coordinates = this.decodePolyline(detailedActivity.map.polyline);
                
                // Check if run intersects with Manhattan
                if (this.isRunInManhattan(coordinates)) {
                    this.addRunToMap(detailedActivity, coordinates);
                }
            }
        } catch (error) {
            console.error(`Error processing run ${activity.id}:`, error);
        }
    }

    // Decode Google polyline format
    decodePolyline(encoded) {
        const points = [];
        let index = 0, lat = 0, lng = 0;
        
        while (index < encoded.length) {
            let shift = 0, result = 0;
            let byte;
            
            do {
                byte = encoded.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);
            
            const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lat += dlat;
            
            shift = 0;
            result = 0;
            
            do {
                byte = encoded.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);
            
            const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lng += dlng;
            
            points.push([lng / 1e5, lat / 1e5]);
        }
        
        return points;
    }

    // Check if run is within Manhattan boundary
    isRunInManhattan(coordinates) {
        // Check if any point of the run is within Manhattan
        // Using turf.js would be ideal here, but we'll do a simple check
        for (const coord of coordinates) {
            if (this.isPointInManhattan(coord)) {
                return true;
            }
        }
        return false;
    }

    // Simple point-in-polygon check for Manhattan
    isPointInManhattan(point) {
        const [x, y] = point;
        const polygon = this.manhattanBoundary.geometry.coordinates[0];
        let inside = false;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];
            
            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }
        
        return inside;
    }

    // Add run to map
    addRunToMap(activity, coordinates) {
        const runId = `run-${activity.id}`;
        
        // Check if source already exists
        if (!this.map.getSource(runId)) {
            // Add the run as a new source
            this.map.addSource(runId, {
                'type': 'geojson',
                'data': {
                    'type': 'Feature',
                    'properties': {
                        'name': activity.name,
                        'date': activity.start_date,
                        'distance': activity.distance,
                        'moving_time': activity.moving_time
                    },
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': coordinates
                    }
                }
            });
            
            // Add the run as a layer
            this.map.addLayer({
                'id': runId,
                'type': 'line',
                'source': runId,
                'layout': {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': '#FC4C02', // Strava orange
                    'line-width': 3,
                    'line-opacity': 0.7
                }
            });
            
            console.log(`Added run: ${activity.name} from ${activity.start_date}`);
        }
    }

    // Update statistics display
    updateStats() {
        const statsDiv = document.getElementById('run-stats');
        if (statsDiv) {
            const sources = this.map.getStyle().sources;
            const runCount = Object.keys(sources).filter(key => key.startsWith('run-')).length;
            statsDiv.innerHTML = `<strong>${runCount}</strong> Manhattan runs loaded`;
        }
    }

    // Logout and clear tokens
    logout() {
        localStorage.removeItem('strava_access_token');
        localStorage.removeItem('strava_refresh_token');
        localStorage.removeItem('strava_athlete_id');
        this.accessToken = null;
        this.refreshToken = null;
        this.athleteId = null;
        
        // Remove all run layers
        const style = this.map.getStyle();
        if (style && style.layers) {
            const runLayers = style.layers.filter(layer => layer.id.startsWith('run-'));
            runLayers.forEach(layer => {
                this.map.removeLayer(layer.id);
                this.map.removeSource(layer.id);
            });
        }
        
        // Refresh UI
        this.initializeUI();
    }
}

// Export for use in main file
window.StravaIntegration = StravaIntegration;
