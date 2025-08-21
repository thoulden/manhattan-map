const fs = require('fs').promises;
const https = require('https');

// Function to make HTTPS requests
function httpsRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    // Log the status code for debugging
                    console.log(`Response status: ${res.statusCode}`);
                    
                    if (res.statusCode !== 200 && res.statusCode !== 201) {
                        console.error(`HTTP Error ${res.statusCode}: ${data}`);
                    }
                    
                    // Try to parse JSON
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    console.error('Failed to parse response:', data);
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

async function refreshToken() {
    console.log('Attempting to refresh token...');
    console.log('Client ID exists:', !!process.env.STRAVA_CLIENT_ID);
    console.log('Client Secret exists:', !!process.env.STRAVA_CLIENT_SECRET);
    console.log('Refresh Token exists:', !!process.env.STRAVA_REFRESH_TOKEN);
    
    if (!process.env.STRAVA_REFRESH_TOKEN) {
        console.error('STRAVA_REFRESH_TOKEN is missing!');
        return null;
    }
    
    const postData = JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: process.env.STRAVA_REFRESH_TOKEN,
        grant_type: 'refresh_token'
    });

    const options = {
        hostname: 'www.strava.com',
        path: '/oauth/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': postData.length
        }
    };

    const response = await httpsRequest(options, postData);
    console.log('Token refresh response:', response);
    
    return response; // Return the full response object
}

// Decode polyline
function decodePolyline(encoded) {
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

// Check if point is in Manhattan
function isPointInManhattan(point, boundary) {
    const [x, y] = point;
    const polygon = boundary.geometry.coordinates[0];
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

// Main function
async function syncStravaRuns() {
    try {
        // Load Manhattan boundary
        const boundaryData = await fs.readFile('manhattan-boundary.json', 'utf8');
        let manhattanBoundary = JSON.parse(boundaryData);
        if (manhattanBoundary.type === 'FeatureCollection') {
            manhattanBoundary = manhattanBoundary.features[0];
        }

        // Get fresh access token
        console.log('Refreshing access token...');
        const tokenResponse = await refreshToken();

        if (!tokenResponse || !tokenResponse.access_token) {
            console.error('Failed to get access token. Response:', tokenResponse);
            process.exit(1);
        }

        const accessToken = tokenResponse.access_token;
        console.log('Successfully got access token');
        
        // Fetch recent runs (last 90 days)
        const afterDate = Math.floor(Date.now() / 1000) - (200 * 24 * 60 * 60);
        
        const options = {
            hostname: 'www.strava.com',
            path: `/api/v3/athlete/activities?type=Run&after=${afterDate}&per_page=100`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };

        console.log('Fetching activities from Strava...');
        const activities = await httpsRequest(options);
        
        // Check if activities is an array
        if (!Array.isArray(activities)) {
            console.error('Unexpected response from Strava:', activities);
            if (activities.message) {
                console.error('Error message:', activities.message);
            }
            if (activities.errors) {
                console.error('Errors:', activities.errors);
            }
            process.exit(1);
        }
        
        console.log(`Found ${activities.length} runs`);

        const manhattanRuns = [];

        // Process each activity
        for (const activity of activities) {
            if (!activity.start_latlng) continue;

            // Get detailed activity with polyline
            const detailOptions = {
                hostname: 'www.strava.com',
                path: `/api/v3/activities/${activity.id}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            };

            const detailed = await httpsRequest(detailOptions);
            
            if (detailed.map && detailed.map.polyline) {
                const coordinates = decodePolyline(detailed.map.polyline);
                
                // Check if run is in Manhattan
                const inManhattan = coordinates.some(coord => 
                    isPointInManhattan(coord, manhattanBoundary)
                );

                if (inManhattan) {
                    manhattanRuns.push({
                        id: detailed.id,
                        name: detailed.name,
                        date: detailed.start_date,
                        distance: detailed.distance,
                        moving_time: detailed.moving_time,
                        coordinates: coordinates
                    });
                    console.log(`Added Manhattan run: ${detailed.name}`);
                }
            }
        }

        // Save to JSON file
        await fs.writeFile(
            'manhattan-runs.json',
            JSON.stringify(manhattanRuns, null, 2)
        );

        console.log(`Saved ${manhattanRuns.length} Manhattan runs`);

    } catch (error) {
        console.error('Error syncing runs:', error);
        console.error('Error details:', error.message);
        process.exit(1);
    }
}
syncStravaRuns();
