import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * LiveMap renders a Leaflet map inside a WebView.
 * This avoids react-native-maps entirely, which requires a native
 * build and does NOT work inside Expo Go. Leaflet + OpenStreetMap
 * tiles run as plain HTML/JS, so this works immediately in Expo Go.
 */
export default function LiveMap({ officerLocation, assignment }) {
  const webviewRef = useRef(null);

  const html = buildHtml(officerLocation);

  // Push live position + assignment updates into the already-loaded
  // WebView via injectJavaScript, instead of reloading the whole page
  // (reloading would cause flicker and lose the user's pan/zoom).
  useEffect(() => {
    if (!webviewRef.current || !officerLocation) return;
    const js = `
      if (window.updateOfficerPosition) {
        window.updateOfficerPosition(${officerLocation.lat}, ${officerLocation.lng});
      }
      true;
    `;
    webviewRef.current.injectJavaScript(js);
  }, [officerLocation]);

  useEffect(() => {
    if (!webviewRef.current) return;
    const js = assignment
      ? `
        if (window.setAssignmentMarker) {
          window.setAssignmentMarker(${assignment.lat}, ${assignment.lng}, ${JSON.stringify(assignment.junction)}, ${JSON.stringify(assignment.risk_level)});
        }
        true;
      `
      : `
        if (window.clearAssignmentMarker) { window.clearAssignmentMarker(); }
        true;
      `;
    webviewRef.current.injectJavaScript(js);
  }, [assignment]);

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
      />
    </View>
  );
}

function riskColor(level) {
  return { Critical: '#A0141E', High: '#C05000', Moderate: '#C08000', Low: '#2E7D32' }[level] || '#777';
}

function buildHtml(initialLocation) {
  const lat = initialLocation?.lat ?? 12.9716;
  const lng = initialLocation?.lng ?? 77.5946;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .officer-dot {
      width: 18px; height: 18px; border-radius: 50%;
      background: #A0141E; border: 3px solid #fff;
      box-shadow: 0 0 0 2px rgba(160,20,30,0.4);
    }
    .leaflet-popup-content { font-family: Georgia, serif; font-size: 13px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    var officerIcon = L.divIcon({ className: '', html: '<div class="officer-dot"></div>', iconSize: [18,18] });
    var officerMarker = L.marker([${lat}, ${lng}], { icon: officerIcon }).addTo(map);
    officerMarker.bindPopup('You');

    var assignmentMarker = null;
    var assignmentCircle = null;
    var hasCenteredOnAssignment = false;

    window.updateOfficerPosition = function(newLat, newLng) {
      officerMarker.setLatLng([newLat, newLng]);
      if (!hasCenteredOnAssignment) {
        map.panTo([newLat, newLng]);
      }
    };

    window.setAssignmentMarker = function(aLat, aLng, junction, riskLevel) {
      var color = ${JSON.stringify({Critical:'#A0141E',High:'#C05000',Moderate:'#C08000',Low:'#2E7D32'})}[riskLevel] || '#777';

      if (assignmentMarker) { map.removeLayer(assignmentMarker); }
      if (assignmentCircle) { map.removeLayer(assignmentCircle); }

      assignmentMarker = L.marker([aLat, aLng]).addTo(map);
      assignmentMarker.bindPopup('<b>' + junction + '</b><br/>Risk: ' + riskLevel).openPopup();

      assignmentCircle = L.circle([aLat, aLng], {
        radius: 300, color: color, weight: 2,
        fillColor: color, fillOpacity: 0.15,
      }).addTo(map);

      var bounds = L.latLngBounds([officerMarker.getLatLng(), [aLat, aLng]]);
      map.fitBounds(bounds, { padding: [60, 60] });
      hasCenteredOnAssignment = true;
    };

    window.clearAssignmentMarker = function() {
      if (assignmentMarker) { map.removeLayer(assignmentMarker); assignmentMarker = null; }
      if (assignmentCircle) { map.removeLayer(assignmentCircle); assignmentCircle = null; }
      hasCenteredOnAssignment = false;
    };
  </script>
</body>
</html>
`;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#e8e4dc' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
